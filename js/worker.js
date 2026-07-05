// ============================================================================
// Analysis worker — streams the user's games and detects achievements.
//
// Message in:  { type:'analyze', username, userId, token, account }
// Messages out:
//   { type:'unlock', id, gameId, color, ply }   (gameId null for account scope)
//   { type:'progress', count }
//   { type:'partial', id, progress }            (per-member progress, e.g. collections)
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
  const extraAchievements = [];
  for (const a of ALL) {
    if (a.scope === 'account') {
      if (a.tiered) {
        try { post({ type: 'partial', id: a.id, progress: a.progress(a.measure(account)) }); } catch { /* ignore */ }
      } else {
        try { if (a.unlock(account)) post({ type: 'unlock', id: a.id, gameId: null }); }
        catch { /* ignore a bad detector */ }
      }
    } else if (a.scope === 'extra') {
      extraAchievements.push(a);
    } else {
      gameAchievements.push({ def: a, state: a.init ? a.init() : null });
    }
  }

  // 1b) Extra-scope achievements — fetched from supplementary endpoints in
  // parallel with (and independently of) the game stream. Their unlocks may
  // arrive after the 'done' of the game pass; main.js reveals them regardless.
  if (extraAchievements.length) evaluateExtra(username, token, extraAchievements, account).catch(() => {});

  // Nothing game-based left to find? We're done.
  const allGame = gameAchievements; // kept whole so partials survive early-exit filtering
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

  const finish = async () => { try { await reader.cancel(); } catch {} controller.abort(); sendPartials(allGame); post({ type: 'done', count }); };

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

  sendPartials(allGame);
  post({ type: 'done', count });
}

// Emit per-member progress for any game achievement that exposes a `progress()`
// (opening collections, Encyclopedia). Completed ones keep their final full state
// even after being filtered out of `locked`, so this is accurate at stream end.
function sendPartials(allGame) {
  for (const g of allGame) {
    if (!g.def.progress) continue;
    try { post({ type: 'partial', id: g.def.id, progress: g.def.progress(g.state) }); }
    catch { /* ignore a bad progress fn */ }
  }
}

// ---------------------------------------------------------------------------
// Extra-scope achievements: teams joined, tournaments played/created, studies
// authored, players followed. Each source is fetched best-effort — a missing
// scope or a 4xx just yields an empty list, so its achievements stay locked
// rather than breaking the others.
// ---------------------------------------------------------------------------

const LI = 'https://lichess.org';

// Time controls whose per-format performance stats we mine for peak rating,
// play-session length and berserk counts (GET /api/user/{u}/perf/{perf}).
const PERF_KEYS = ['ultraBullet', 'bullet', 'blitz', 'rapid', 'classical', 'correspondence'];

async function evaluateExtra(username, token, achievements, account) {
  const auth = token ? { Authorization: `Bearer ${token}` } : {};
  const u = encodeURIComponent(username);

  // Lichess caps concurrent API requests (429 "Please only run 2 request(s) at a
  // time"). The game stream already holds one connection open the whole time, so
  // every supplementary call here is made strictly one at a time to stay within
  // the cap. These are best-effort background lookups, so the extra latency of
  // running them sequentially is fine.
  const teams = await fetchJsonArray(`${LI}/api/team/of/${u}`, auth);
  const tournaments = await fetchNdjson(`${LI}/api/user/${u}/tournament/played?nb=1000`, auth);
  const created = await fetchNdjson(`${LI}/api/user/${u}/tournament/created`, auth);
  const studies = await fetchNdjson(`${LI}/api/study/by/${u}`, auth);
  const following = await fetchNdjson(`${LI}/api/rel/following`, auth);

  let arenaPoints = 0;
  for (const t of tournaments) arenaPoints += t.player?.score || 0;

  // Per-format performance stats (public) — one call per time control the user has
  // actually played, likewise strictly sequential. We keep the best across formats.
  const playedPerfs = PERF_KEYS.filter((k) => (account?.perfs?.[k]?.games || 0) > 0);
  const peak = { int: 0, gameId: null };
  const peakByPerf = {};   // per-format highest rating, for the per-format rating ladders
  let sessionGames = 0;
  let sessionTime = 0;
  let berserk = 0;
  for (const k of playedPerfs) {
    const st = (await fetchJson(`${LI}/api/user/${u}/perf/${k}`, auth))?.stat;
    if (!st) continue;
    const hi = st.highest?.int || 0;
    peakByPerf[k] = hi;
    if (hi > peak.int) { peak.int = hi; peak.gameId = st.highest?.gameId || null; }
    sessionGames = Math.max(sessionGames, st.playStreak?.nb?.max?.v || 0);
    sessionTime = Math.max(sessionTime, st.playStreak?.time?.max?.v || 0);
    berserk += st.count?.berserk || 0;
  }

  // Puzzle dashboard (needs the puzzle:read scope) — best-effort. A long window so
  // per-theme counts accumulate; missing scope just leaves these achievements locked.
  let puzzleThemeMax = 0;
  let puzzlePerformance = 0;
  const dash = await fetchJson(`${LI}/api/puzzle/dashboard/1000`, auth);
  if (dash) {
    puzzlePerformance = dash.global?.performance || 0;
    const themes = dash.themes || {};
    for (const key of Object.keys(themes)) {
      puzzleThemeMax = Math.max(puzzleThemeMax, themes[key]?.results?.nb || 0);
    }
  }

  const extra = {
    teams, tournaments, created, studies, following, arenaPoints,
    peak, peakByPerf, sessionGames, sessionTime, berserk, puzzleThemeMax, puzzlePerformance,
  };
  for (const a of achievements) {
    if (a.tiered) {
      try { post({ type: 'partial', id: a.id, progress: a.progress(a.measure(extra)) }); } catch { /* ignore */ }
      continue;
    }
    try {
      const r = a.unlock(extra);
      if (r) post({ type: 'unlock', id: a.id, gameId: (r && r.gameId) || null });
    } catch { /* ignore a bad detector */ }
  }
}

async function fetchJson(url, auth) {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', ...auth } });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function fetchJsonArray(url, auth) {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', ...auth } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function fetchNdjson(url, auth) {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/x-ndjson', ...auth } });
    if (!res.ok || !res.body) return [];
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const out = [];
    let buffer = '';
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) { try { out.push(JSON.parse(line)); } catch { /* skip */ } }
      }
    }
    const tail = buffer.trim();
    if (tail) { try { out.push(JSON.parse(tail)); } catch { /* skip */ } }
    return out;
  } catch { return []; }
}

// ---------------------------------------------------------------------------

const ZERO_BOARD = { maxQueens: 0, kingCrossed: false, epMate: false, epAny: false, minMaterialDiff: 0 };
const EP_LAST = /^[a-h]x[a-h][36]$/; // a pawn capture landing on the en-passant rank
const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// Decide the cheapest board pass this game needs, given still-locked achievements.
//   { replay:false }          -> no chess.js replay at all
//   { replay:true, scan:bool } -> replay; scan=true also walks the board each ply
function boardPlan(locked, lastBare) {
  let scan = false;
  let epMate = false;
  let epAny = false;
  for (const l of locked) {
    if (!l.def.needsBoard) continue;
    if (l.def.id === 'en-passant-mate') epMate = true;
    else if (l.def.id === 'en-passant') epAny = true;
    else scan = true; // queen-party, king's journey, comeback, houdini need per-ply board state
  }
  if (scan) return { replay: true, scan: true };       // full walk covers ep too
  if (epAny) return { replay: true, scan: false };      // any move might be en passant
  if (epMate && EP_LAST.test(lastBare)) return { replay: true, scan: false };
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

  const me = players[color] || {};
  const opp = players[color === 'white' ? 'black' : 'white'] || {};

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
    createdAt: game.createdAt,
    myRating: me.rating || null,
    oppRating: opp.rating || null,
    oppTitle: opp.user?.title || null, // 'GM', 'IM', ... or 'BOT'
    oppAi: opp.aiLevel || null,        // Stockfish level (1-8) when the opponent is the AI
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
  let epAny = false;
  let minMaterialDiff = 0; // most negative (user material − opponent material) over the game
  const last = san.length - 1;

  for (let i = 0; i <= last; i++) {
    let mv;
    try { mv = chess.move(san[i]); } catch { break; }
    if (!mv) break;

    const byUser = (i % 2 === 0) === userWhite;
    if (byUser && mv.flags.includes('e')) epAny = true; // 'e' = en-passant capture

    if (scan) {
      const b = chess.board();
      let q = 0;
      let kingRank = null;
      let userMat = 0;
      let oppMat = 0;
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          const p = b[r][f];
          if (!p) continue;
          const isUser = (p.color === 'w') === userWhite;
          if (p.type === 'k') { if (isUser) kingRank = 8 - r; continue; } // rows run rank 8 -> 1
          if (p.type === 'q' && isUser) q++;
          if (isUser) userMat += PIECE_VALUE[p.type] || 0;
          else oppMat += PIECE_VALUE[p.type] || 0;
        }
      }
      if (q > maxQueens) maxQueens = q;
      // "Far side" = the opponent's back rank: rank 8 for White, rank 1 for Black.
      if (kingRank != null && (userWhite ? kingRank === 8 : kingRank === 1)) kingCrossed = true;
      // Sample the material deficit only after the user's own moves, so a queen
      // trade in progress (down a queen until the recapture) isn't mistaken for a
      // sacrifice — only a genuine standing deficit counts.
      if (byUser) {
        const diff = userMat - oppMat;
        if (diff < minMaterialDiff) minMaterialDiff = diff;
      }
    }

    if (i === last) {
      if (byUser && mv.flags.includes('e') && chess.isCheckmate()) epMate = true;
    }
  }
  return { maxQueens, kingCrossed, epMate, epAny, minMaterialDiff };
}
