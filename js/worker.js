// ============================================================================
// Analysis worker — streams the user's games and detects achievements.
//
// Message in:  { type:'analyze', username, userId, token, account }
// Messages out:
//   { type:'unlock', id, gameId, color, ply }   (gameId null for account scope)
//   { type:'progress', count }
//   { type:'partial', id, progress }            (per-member progress, e.g. collections)
//   { type:'done', count }
//   { type:'error', message, key }           (key: an i18n string id, if known)
// ============================================================================

import { ALL } from './achievements.js';
import { Chess } from './chess.js';

// `accuracy=true` adds players[color].analysis.accuracy on games Lichess has
// analysed — the rest of that object (acpl, blunders, phases) comes along with it
// and powers the Precision category. Unanalysed games simply carry no `analysis`,
// so this costs nothing for everyone else.
// `division` is passed explicitly: the OpenAPI spec documents it as default false
// even though the live export returns it anyway, and two achievements depend on it.
const GAMES_URL = (username) =>
  `https://lichess.org/api/games/user/${encodeURIComponent(username)}` +
  `?moves=true&opening=true&tags=false&pgnInJson=false&clocks=false&evals=false` +
  `&accuracy=true&division=true&sort=dateAsc`;

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'analyze') {
    run(msg).catch((err) => post({ type: 'error', message: err.message || String(err), key: err.key }));
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
  if (!res.ok || !res.body) throw Object.assign(new Error('Could not stream your games from Lichess.'), { key: 'err.stream' });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let count = 0;

  const finish = async () => { try { await reader.cancel(); } catch {} controller.abort(); sendPartials(allGame); post({ type: 'done', count }); };

  // One NDJSON line is one game. Returns true once nothing is left to find.
  const handle = (raw) => {
    const line = raw.trim();
    if (!line) return false;
    let game;
    try { game = JSON.parse(line); } catch { return false; }
    count++;

    analyseGame(game, uid, locked);

    // Drop unlocked achievements; global early-exit when nothing is left.
    if (locked.some((l) => l.done)) {
      locked = locked.filter((l) => !l.done);
      if (!locked.length) return true;
    }

    if (count % 25 === 0) post({ type: 'progress', count });
    return false;
  };

  while (true) {
    let chunk;
    try { chunk = await reader.read(); }
    catch {
      // The connection dropped mid-history. Keep what was found so far, but say so
      // rather than posting 'done' — that would present a partial run as complete.
      sendPartials(allGame);
      throw Object.assign(new Error('The connection to Lichess dropped before all your games were analysed.'), { key: 'err.streamBroken' });
    }
    if (chunk.done) break;

    buffer += decoder.decode(chunk.value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (handle(line)) { await finish(); return; }
    }
  }

  // The last game may arrive without a trailing newline.
  if (handle(buffer + decoder.decode())) { await finish(); return; }

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

// Formats whose per-format performance stats we mine for peak rating, play-session
// length, berserk counts, loss streaks and best wins (GET /api/user/{u}/perf/{perf}).
// The variants are in the list because those stats are not about standard chess:
// berserking a Crazyhouse arena or grinding a Chess960 session counts just as much.
// Only formats the user has actually played are fetched, so this costs a variant
// player one extra call per variant and everyone else nothing.
const PERF_KEYS = [
  'ultraBullet', 'bullet', 'blitz', 'rapid', 'classical', 'correspondence',
  'crazyhouse', 'chess960', 'kingOfTheHill', 'threeCheck',
  'antichess', 'atomic', 'horde', 'racingKings',
];

async function evaluateExtra(username, token, achievements, account) {
  const auth = token ? { Authorization: `Bearer ${token}` } : {};
  const u = encodeURIComponent(username);

  // Lichess caps concurrent API requests (429 "Please only run 2 request(s) at a
  // time"). The game stream already holds one connection open the whole time, so
  // every supplementary call here is made strictly one at a time to stay within
  // the cap. These are best-effort background lookups, so the extra latency of
  // running them sequentially is fine.
  const teams = await fetchJsonArray(`${LI}/api/team/of/${u}`, auth);
  // High cap so cumulative sums (arena points) aren't truncated for very active
  // players; nb is a ceiling, so ordinary users still fetch only what they have.
  const tournaments = await fetchNdjson(`${LI}/api/user/${u}/tournament/played?nb=10000`, auth);
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
  let lossStreak = 0;      // longest run of consecutive losses, best (worst) across formats
  let bestWinRating = 0;   // highest-rated opponent ever beaten, across formats
  let tourGames = 0;       // games played inside a tournament, summed over formats
  let disconnects = 0;     // games left by losing the connection, summed over formats
  for (const k of playedPerfs) {
    const st = (await fetchJson(`${LI}/api/user/${u}/perf/${k}`, auth))?.stat;
    if (!st) continue;
    const hi = st.highest?.int || 0;
    peakByPerf[k] = hi;
    if (hi > peak.int) { peak.int = hi; peak.gameId = st.highest?.gameId || null; }
    sessionGames = Math.max(sessionGames, st.playStreak?.nb?.max?.v || 0);
    sessionTime = Math.max(sessionTime, st.playStreak?.time?.max?.v || 0);
    berserk += st.count?.berserk || 0;
    lossStreak = Math.max(lossStreak, st.resultStreak?.loss?.max?.v || 0);
    for (const w of (st.bestWins?.results || [])) bestWinRating = Math.max(bestWinRating, w.opRating || 0);
    // Both are per-format totals, so they sum rather than max: playing tournament
    // blitz and tournament rapid is twice the tournament experience.
    tourGames += st.count?.tour || 0;
    disconnects += st.count?.disconnects || 0;
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

  // Puzzle Storm dashboard (public, no scope). `days` is capped at 365 by the API
  // and the per-day rows only exist for that window, so the combo / highest-solved
  // / runs-per-day figures below are "best in the last year", not lifetime — a
  // player who last stormed two years ago gets an empty `days` array and keeps
  // those tiles locked. The all-time score already comes from /api/account, so we
  // only fetch this for someone who has actually played Storm.
  let stormCombo = 0;      // longest solve combo in a run
  let stormHighest = 0;    // highest puzzle rating solved in a run
  let stormRunsDay = 0;    // most runs played in a single day
  if ((account?.perfs?.storm?.runs || 0) > 0) {
    const storm = await fetchJson(`${LI}/api/storm/dashboard/${u}?days=365`, auth);
    for (const d of (storm?.days || [])) {
      stormCombo = Math.max(stormCombo, d.combo || 0);
      stormHighest = Math.max(stormHighest, d.highest || 0);
      stormRunsDay = Math.max(stormRunsDay, d.runs || 0);
    }
  }

  const extra = {
    teams, tournaments, created, studies, following, arenaPoints,
    peak, peakByPerf, sessionGames, sessionTime, berserk, puzzleThemeMax, puzzlePerformance,
    lossStreak, bestWinRating, tourGames, disconnects,
    stormCombo, stormHighest, stormRunsDay,
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

const ZERO_BOARD = { maxQueens: 0, epMate: false, epAny: false, minMaterialDiff: 0, minMaterialDiffPly: -1 };
const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// An en-passant capture is a pawn capture landing on the sixth rank (White) or
// the third (Black). Plenty of ordinary captures do too; this only rules games out.
const EP_CANDIDATE = { white: /^[a-h]x[a-h]6/, black: /^[a-h]x[a-h]3/ };

// For each board achievement: whether it needs the per-ply material/queen scan or
// just the replay (en passant is a flag on the move itself), and a cheap test of
// whether THIS game could fire it at all. The replay costs ~97% of the worker's CPU,
// and each of these can only fire on a small slice of games, so most games skip it.
const BOARD_USES = {
  // Only a won game counts (track() returns null otherwise).
  'comeback': { scan: true, when: (c) => c.won },
  'swindle': { scan: true, when: (c) => c.status === 'stalemate' },
  // A second user queen can only come from promoting to one.
  'queen-party': { scan: true, when: (c) => c.userSan.some((m) => m.includes('=Q')) },
  'en-passant': { scan: false, when: (c) => c.userSan.some((m) => EP_CANDIDATE[c.color].test(m)) },
  // The user's own last move, and it mates.
  'en-passant-mate': { scan: false, when: (c) => c.won && c.status === 'mate' && EP_CANDIDATE[c.color].test(c.lastSan) },
};

// Decide the cheapest board pass this game needs, given still-locked achievements.
//   { replay:false }          -> no chess.js replay at all
//   { replay:true, scan:bool } -> replay; scan=true also walks the board each ply
// A needsBoard achievement missing from BOARD_USES always gets the full scan:
// correct, just slower — give it an entry.
function boardPlan(locked, ctx) {
  let replay = false;
  for (const l of locked) {
    if (!l.def.needsBoard) continue;
    const use = BOARD_USES[l.def.id];
    if (!use) return { replay: true, scan: true };
    if (!use.when(ctx)) continue;
    if (use.scan) return { replay: true, scan: true }; // the full walk covers en passant too
    replay = true;
  }
  return { replay, scan: false };
}

function analyseGame(game, uid, locked) {
  const variant = typeof game.variant === 'string' ? game.variant : game.variant?.key;
  // SAN and board detectors assume standard chess, so they only ever see standard
  // games. Detectors flagged `anyVariant` describe how the game was created
  // (source, casual/rated, human/AI) and are meaningful in every variant — notably
  // "from a custom position", which Lichess always tags as variant 'fromPosition'
  // and would otherwise be unreachable.
  const standard = variant === 'standard';
  if (!standard && !locked.some((l) => !l.done && l.def.anyVariant)) return;

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
    // Colour to move after the last ply. White moves on even plies, so on a
    // `stalemate` finish this is the side left without a legal move. It assumes
    // the game started with White to move, which is why the detectors that read it
    // are not flagged anyVariant (a `fromPosition` game can start either way).
    toMove: san.length % 2 === 0 ? 'white' : 'black',
    checksByOpp: oppSan.reduce((n, m) => n + (m.endsWith('+') || m.endsWith('#') ? 1 : 0), 0),
    checksByUser: userSan.reduce((n, m) => n + (m.endsWith('+') || m.endsWith('#') ? 1 : 0), 0),
    anyCapture: san.some((m) => m.includes('x')),
    createdAt: game.createdAt,
    myRating: me.rating || null,
    oppRating: opp.rating || null,
    oppTitle: opp.user?.title || null, // 'GM', 'IM', ... or 'BOT'
    oppId: opp.user?.id?.toLowerCase() || null, // account id; bots are ordinary accounts
    oppAi: opp.aiLevel || null,        // Stockfish level (1-8) when the opponent is the AI
    // Rating won or lost on this game; only present on rated games.
    ratingDiff: Number.isInteger(me.ratingDiff) ? me.ratingDiff : null,
    // A provisional rating (too few games, high deviation) still swings by hundreds
    // of points and can sit far from the player's real strength.
    myProvisional: me.provisional === true,
    oppProvisional: opp.provisional === true,
    // Computer-analysis summary per side: { inaccuracy, mistake, blunder, acpl,
    // accuracy, phases: { opening, middlegame, endgame } }. Present only on games
    // that have been analysed, and `accuracy`/`phases` only because GAMES_URL asks
    // for them. Detectors must treat a missing object as "unknown", not as zero.
    analysis: me.analysis || null,
    oppAnalysis: opp.analysis || null,
    // Extra per-game facets (all fail-safe: a missing field just leaves the
    // achievement locked). source: 'simul' | 'position' | 'friend' | 'arena' | …
    source: typeof game.source === 'string' ? game.source : null,
    variant,                            // 'standard' | 'fromPosition' | 'chess960' | …
    rated: game.rated === true,
    eco: game.opening?.eco || null,
    // Ply at which Lichess's opening classification stops (the last book move).
    openingPly: Number.isInteger(game.opening?.ply) ? game.opening.ply : null,
    // Clock summary (seconds); absent for correspondence.
    clockInitial: game.clock?.initial ?? null,
    clockIncrement: game.clock?.increment ?? null,
    // Game-phase boundaries in plies (present only when Lichess computed them).
    divMiddle: game.division ? (game.division.middle ?? null) : null,
    divEnd: game.division ? (game.division.end ?? null) : null,
    hasDivision: !!game.division,
    // Tournament membership straight from the game (covers Swiss, which the
    // extra-scope endpoints don't). Support both current and legacy field names.
    inArena: !!(game.arenaTour || game.tournament),
    inSwiss: !!(game.swissTour || game.swiss),
    board: ZERO_BOARD,
  };

  if (standard) {
    const plan = boardPlan(locked, ctx);
    if (plan.replay) ctx.board = computeBoard(san, userWhite, plan.scan);
  }

  for (const l of locked) {
    if (l.done) continue;
    if (!standard && !l.def.anyVariant) continue;
    let res;
    try { res = l.def.detect(ctx, l.state); } catch { res = false; }
    if (l.def.tiered) {
      // Game-scope ladders only accumulate (their `detect` returns false and the
      // final value is posted by sendPartials). Retire one once every tier is
      // reached so it stops holding the stream open / forcing the board scan.
      const top = l.def.steps[l.def.steps.length - 1].at;
      if (l.state && l.state.max >= top) l.done = true;
      continue;
    }
    if (!res) continue;
    // Lichess's #ply anchor counts from the game's real starting ply, which is not
    // 0 for a game played from a custom position — and "the deciding move" is
    // meaningless for the game-type detectors anyway. Link to the game itself.
    const ply = !standard ? null
      : res && typeof res === 'object' && Number.isInteger(res.ply) ? res.ply
      : san.length - 1;
    l.done = true;
    post({ type: 'unlock', id: l.def.id, gameId: ctx.gameId, color, ply });
  }
}

// chess.js BITS.EP_CAPTURE — the bit set on an internal move that captures en
// passant. (Kept in sync with the vendored chess.js.)
const EP_CAPTURE = 8;

// Replay through chess.js, tracking material and queens INCREMENTALLY
// so we never allocate and walk a fresh 64-square board every ply. This is the
// per-game hot path for accounts with thousands of games, so it deliberately
// uses chess.js's internal `_moveFromSan` + `_makeMove` to skip the public
// move()'s per-ply SAN and FEN regeneration (which we don't use) — ~2.75x faster
// than move()+board() while producing identical results. `scan` gates the
// board-state work; when false we only look for en-passant captures.
function computeBoard(san, userWhite, scan) {
  const chess = new Chess();
  let maxQueens = 0;
  let epMate = false;
  let epAny = false;
  let minMaterialDiff = 0; // most negative (user material − opponent material) over the game
  let minMaterialDiffPly = -1; // the ply at which that deepest deficit was reached
  const last = san.length - 1;

  // Running deltas from the (materially even) start position.
  let diff = 0;        // user material − opponent material
  let userQueens = 1;  // both sides start with one queen; we track only the user's

  for (let i = 0; i <= last; i++) {
    let mv;
    try { mv = chess._moveFromSan(san[i]); } catch { mv = null; }
    if (!mv) break;
    chess._makeMove(mv);

    const byUser = (i % 2 === 0) === userWhite;
    if (byUser && (mv.flags & EP_CAPTURE)) epAny = true;

    if (scan) {
      // Material: a capture removes the captured piece from the side NOT moving;
      // a promotion swaps the mover's pawn (value 1) for the promoted piece.
      if (mv.captured) {
        const v = PIECE_VALUE[mv.captured] || 0;
        if (byUser) diff += v;
        else { diff -= v; if (mv.captured === 'q') userQueens--; } // a user queen was taken
      }
      if (mv.promotion) {
        const gain = (PIECE_VALUE[mv.promotion] || 0) - 1;
        if (byUser) { diff += gain; if (mv.promotion === 'q') userQueens++; }
        else diff -= gain;
      }
      if (userQueens > maxQueens) maxQueens = userQueens;
      // Sample the material deficit only after the user's own moves, so a queen
      // trade in progress (down a queen until the recapture) isn't mistaken for a
      // sacrifice — only a genuine standing deficit counts.
      if (byUser && diff < minMaterialDiff) { minMaterialDiff = diff; minMaterialDiffPly = i; }
    }

    if (i === last) {
      if (byUser && (mv.flags & EP_CAPTURE) && chess.isCheckmate()) epMate = true;
    }
  }
  return { maxQueens, epMate, epAny, minMaterialDiff, minMaterialDiffPly };
}
