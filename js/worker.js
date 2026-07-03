// ============================================================================
// Analysis worker — streams the user's games and detects achievements.
//
// Message in:  { type:'analyze', username, userId, token, account }
// Messages out:
//   { type:'unlock', id, gameId, color, ply }   (gameId null for account scope)
//   { type:'progress', count }
//   { type:'done', count }
//   { type:'error', message }
// ============================================================================

import { ALL } from './achievements.js';
import { Chess } from './chess.js';

const GAMES_URL = (username) =>
  `https://lichess.org/api/games/user/${encodeURIComponent(username)}` +
  `?moves=true&opening=true&tags=false&pgnInJson=false&clocks=false&evals=false&sort=dateAsc`;

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'analyze') {
    run(msg).catch((err) => post({ type: 'error', message: err.message || String(err) }));
  }
};

function post(m) { self.postMessage(m); }

async function run({ username, userId, token, account }) {
  const uid = (userId || username).toLowerCase();

  // 1) Account-scope achievements — instant, no game data needed.
  const gameAchievements = [];
  for (const a of ALL) {
    if (a.scope === 'account') {
      try { if (a.unlock(account)) post({ type: 'unlock', id: a.id, gameId: null }); }
      catch { /* ignore a bad detector */ }
    } else {
      gameAchievements.push({ def: a, state: a.init ? a.init() : null });
    }
  }

  // Nothing game-based left to find? We're done.
  let locked = gameAchievements;
  if (!locked.length) { post({ type: 'done', count: 0 }); return; }

  // 2) Stream games.
  const controller = new AbortController();
  const res = await fetch(GAMES_URL(username), {
    headers: { Accept: 'application/x-ndjson', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal: controller.signal,
  });
  if (!res.ok || !res.body) throw new Error('Could not stream your games from Lichess.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let count = 0;

  const finish = async () => { try { await reader.cancel(); } catch {} controller.abort(); post({ type: 'done', count }); };

  while (true) {
    let chunk;
    try { chunk = await reader.read(); }
    catch { break; }
    if (chunk.done) break;

    buffer += decoder.decode(chunk.value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;

      let game;
      try { game = JSON.parse(line); } catch { continue; }
      count++;

      analyseGame(game, uid, locked);

      // Drop unlocked achievements; global early-exit when nothing is left.
      if (locked.some((l) => l.done)) {
        locked = locked.filter((l) => !l.done);
        if (!locked.length) { await finish(); return; }
      }

      if (count % 25 === 0) post({ type: 'progress', count });
    }
  }

  post({ type: 'done', count });
}

// ---------------------------------------------------------------------------

const ZERO_BOARD = { maxQueens: 0, kingCrossed: false, epMate: false };
const EP_LAST = /^[a-h]x[a-h][36]$/; // a pawn capture landing on the en-passant rank

// Decide the cheapest board pass this game needs, given still-locked achievements.
//   { replay:false }          -> no chess.js replay at all
//   { replay:true, scan:bool } -> replay; scan=true also walks the board each ply
function boardPlan(locked, lastBare) {
  let scan = false;
  let ep = false;
  for (const l of locked) {
    if (!l.def.needsBoard) continue;
    if (l.def.id === 'en-passant-mate') ep = true;
    else scan = true; // queen-party, king's journey need per-ply board state
  }
  if (scan) return { replay: true, scan: true };
  if (ep && EP_LAST.test(lastBare)) return { replay: true, scan: false };
  return { replay: false };
}

function analyseGame(game, uid, locked) {
  const variant = typeof game.variant === 'string' ? game.variant : game.variant?.key;
  if (variant !== 'standard') return; // game detectors target standard chess only

  const players = game.players || {};
  const whiteId = players.white?.user?.id?.toLowerCase();
  const blackId = players.black?.user?.id?.toLowerCase();
  const color = whiteId === uid ? 'white' : blackId === uid ? 'black' : null;
  if (!color) return;

  const san = (game.moves || '').split(/\s+/).filter(Boolean);
  if (!san.length) return;

  const userWhite = color === 'white';
  const userSan = san.filter((_, i) => (i % 2 === 0) === userWhite);
  const oppSan = san.filter((_, i) => (i % 2 === 0) !== userWhite);
  const winner = game.winner || null;

  const ctx = {
    gameId: game.id,
    color,
    won: winner === color,
    winner,
    status: game.status,
    san,
    userSan,
    lastSan: san[san.length - 1],
    checksByOpp: oppSan.reduce((n, m) => n + (m.endsWith('+') || m.endsWith('#') ? 1 : 0), 0),
    anyCapture: san.some((m) => m.includes('x')),
    board: ZERO_BOARD,
  };

  const plan = boardPlan(locked, ctx.lastSan.replace(/[+#]/g, ''));
  if (plan.replay) ctx.board = computeBoard(san, userWhite, plan.scan);

  for (const l of locked) {
    if (l.done) continue;
    let res;
    try { res = l.def.detect(ctx, l.state); } catch { res = false; }
    if (!res) continue;
    const ply = res && typeof res === 'object' && Number.isInteger(res.ply) ? res.ply : san.length - 1;
    l.done = true;
    post({ type: 'unlock', id: l.def.id, gameId: ctx.gameId, color, ply });
  }
}

// Replay through chess.js. `scan` walks the board every ply (for queen/king
// achievements); when false we only replay far enough to test en-passant mate.
function computeBoard(san, userWhite, scan) {
  const chess = new Chess();
  let maxQueens = 0;
  let kingCrossed = false;
  let epMate = false;
  const last = san.length - 1;

  for (let i = 0; i <= last; i++) {
    let mv;
    try { mv = chess.move(san[i]); } catch { break; }
    if (!mv) break;

    if (scan) {
      const b = chess.board();
      let q = 0;
      let kingRank = null;
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          const p = b[r][f];
          if (!p) continue;
          const isUser = (p.color === 'w') === userWhite;
          if (!isUser) continue;
          if (p.type === 'q') q++;
          else if (p.type === 'k') kingRank = 8 - r; // rows run rank 8 -> 1
        }
      }
      if (q > maxQueens) maxQueens = q;
      if (kingRank != null && (userWhite ? kingRank >= 5 : kingRank <= 4)) kingCrossed = true;
    }

    if (i === last) {
      const byUser = (i % 2 === 0) === userWhite;
      if (byUser && mv.flags.includes('e') && chess.isCheckmate()) epMate = true;
    }
  }
  return { maxQueens, kingCrossed, epMate };
}
