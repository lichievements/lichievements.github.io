// ============================================================================
// Lichievements — achievement registry (single source of truth)
//
// Imported by BOTH main.js (metadata + rendering) and worker.js (detection).
//
// Each achievement has a `scope`:
//   'account'  -> unlock(account)            evaluated once from /api/account
//   'extra'    -> unlock(extra)              evaluated once from supplementary
//                                            endpoints (teams, tournaments,
//                                            studies, following) — see worker.js
//   'game'     -> detect(ctx, state)         evaluated per streamed game
//
// A game `detect` returns:
//   falsy            -> not (yet) unlocked
//   true             -> unlocked (link points at the deciding/last move)
//   { ply }          -> unlocked, link jumps to this ply (0-based)
//
// `needsBoard: true` marks detectors that read ctx.board.* (en passant, king
// journey, multiple queens). The worker only reconstructs the board when at
// least one still-locked achievement needs it (see worker.js).
//
// `state` is a per-achievement scratch object the worker persists across games
// (used by aggregate achievements such as opening collections).
// ============================================================================

const W = 'white';
const B = 'black';

// The twenty legal first moves for White (16 pawn pushes + 4 knight moves),
// used by the "Encyclopedia" collection and its hints-page progress breakdown.
const FIRST_MOVES = [
  'a3', 'a4', 'b3', 'b4', 'c3', 'c4', 'd3', 'd4', 'e3', 'e4',
  'f3', 'f4', 'g3', 'g4', 'h3', 'h4', 'Na3', 'Nc3', 'Nf3', 'Nh3',
];

// Strip SAN annotations so opening lines compare cleanly.
const bare = (s) => (s ? s.replace(/[+#!?]/g, '') : s);
const startsWith = (arr, ch) => arr.some((m) => m[0] === ch);
const castled = (arr) => arr.some((m) => m.startsWith('O-O'));
const isMate = (ctx) => ctx.won && ctx.status === 'mate';

function prefixMatch(san, target) {
  if (san.length < target.length) return false;
  for (let i = 0; i < target.length; i++) {
    if (bare(san[i]) !== bare(target[i])) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Opening definitions: [id, title, details, image, color, moves]
// ---------------------------------------------------------------------------
const OPENINGS = [
  // White
  ['opening-italian', 'Italian', '1. e4 e5 2. Nf3 Nc6 3. Bc4', 'opening-italian', W, 'e4 e5 Nf3 Nc6 Bc4'],
  ['opening-ruylopez', 'Ruy Lopez', '1. e4 e5 2. Nf3 Nc6 3. Bb5', 'opening-ruylopez', W, 'e4 e5 Nf3 Nc6 Bb5'],
  ['opening-scotch', 'Scotch', '1. e4 e5 2. Nf3 Nc6 3. d4', 'opening-scotch', W, 'e4 e5 Nf3 Nc6 d4'],
  ['opening-queensgambit', "Queen's Gambit", '1. d4 d5 2. c4', 'opening-queensgambit', W, 'd4 d5 c4'],
  ['opening-kingsgambit', "King's Gambit", '1. e4 e5 2. f4', 'opening-kingsgambit', W, 'e4 e5 f4'],
  ['opening-english', 'English', '1. c4', 'opening-english', W, 'c4'],
  ['opening-reti', 'Réti', '1. Nf3', 'opening-reti', W, 'Nf3'],
  ['opening-grob', 'Grob', '1. g4', 'opening-grob', W, 'g4'],
  ['opening-bongcloud', 'Bongcloud', '1. e4 e5 2. Ke2', 'opening-bongcloud', W, 'e4 e5 Ke2'],
  ['opening-huebschgambit', 'Hübsch Gambit', '1. d4 d5 2. Nc3 Nf6 3. e4', 'opening-huebschgambit', W, 'd4 d5 Nc3 Nf6 e4'],
  ['opening-chameleon', 'Sicilian: Chameleon', '1. e4 c5 2. Nc3 Nc6 3. Nge2', 'opening-chameleon', W, 'e4 c5 Nc3 Nc6 Nge2'],
  ['opening-crab', 'Crab Opening', '1. a4 e5 2. h4', 'opening-crab', W, 'a4 e5 h4'],
  ['opening-lion', "Lion's Jaw", '1. e4 d6 2. d4 Nf6 3. f3', 'opening-lion', W, 'e4 d6 d4 Nf6 f3'],
  ['opening-porcupine', 'English: Porcupine', '1. c4 f5 2. Nc3 Nf6 3. e4 fxe4 4. g4', 'opening-porcupine', W, 'c4 f5 Nc3 Nf6 e4 fxe4 g4'],
  ['opening-orangutan', 'English Orangutan', '1. c4 Nf6 2. b4', 'opening-orangutan', W, 'c4 Nf6 b4'],
  ['opening-giraffe', 'Giraffe Attack', '1. e4 e5 2. Nc3 Bc5 3. Qg4', 'opening-giraffe', W, 'e4 e5 Nc3 Bc5 Qg4'],
  ['opening-crocodile', 'Crocodile Variation', '1. e4 e5 2. d4 exd4 3. f4 Bc5 4. Nf3 Nc6 5. c3', 'opening-crocodile', W, 'e4 e5 d4 exd4 f4 Bc5 Nf3 Nc6 c3'],
  ['opening-lobster', 'Lobster Gambit', '1. e4 e5 2. Nf3 f5 3. g4', 'opening-lobster', W, 'e4 e5 Nf3 f5 g4'],
  ['opening-penguin', 'Penguin Variation', '1. Nf3 d5 2. c4 d4 3. Rg1', 'opening-penguin', W, 'Nf3 d5 c4 d4 Rg1'],
  ['opening-clam', 'Clam Gambit', '1. e4 e5 2. Nf3 Nc6 3. d3 f5 4. exf5', 'opening-clam', W, 'e4 e5 Nf3 Nc6 d3 f5 exf5'],
  ['opening-dog', 'Mad Dog Attack', '1. d4 d5 2. e4 dxe4 3. Nc3 Nf6 4. f3 exf3 5. Nxf3 g6 6. Bc4 Bg7 7. h4', 'opening-dog', W, 'd4 d5 e4 dxe4 Nc3 Nf6 f3 exf3 Nxf3 g6 Bc4 Bg7 h4'],
  ['opening-scorpion', 'Scorpion-Horus Gambit', '1. e4 c6 2. Nc3 d5 3. d3 dxe4 4. Bg5', 'opening-scorpion', W, 'e4 c6 Nc3 d5 d3 dxe4 Bg5'],
  ['opening-tortoise', 'Tortoise Opening', '1. e4 e5 2. Bd3', 'opening-tortoise', W, 'e4 e5 Bd3'],
  ['opening-whale', 'English: The Whale', '1. e4 e5 2. c4', 'opening-whale', W, 'e4 e5 c4'],

  // Common mainstream openings (White)
  ['opening-london', 'London System', '1. d4 d5 2. Bf4', 'opening-london', W, 'd4 d5 Bf4'],
  ['opening-vienna', 'Vienna Game', '1. e4 e5 2. Nc3', 'opening-vienna', W, 'e4 e5 Nc3'],
  ['opening-bishopsopening', "Bishop's Opening", '1. e4 e5 2. Bc4', 'opening-bishopsopening', W, 'e4 e5 Bc4'],
  ['opening-catalan', 'Catalan', '1. d4 Nf6 2. c4 e6 3. g3', 'opening-catalan', W, 'd4 Nf6 c4 e6 g3'],
  ['opening-bird', "Bird's Opening", '1. f4', 'opening-bird', W, 'f4'],
  ['opening-larsen', 'Nimzo-Larsen Attack', '1. b3', 'opening-larsen', W, 'b3'],
  ['opening-trompowsky', 'Trompowsky Attack', '1. d4 Nf6 2. Bg5', 'opening-trompowsky', W, 'd4 Nf6 Bg5'],
  ['opening-fourknights', 'Four Knights Game', '1. e4 e5 2. Nf3 Nc6 3. Nc3 Nf6', 'opening-fourknights', W, 'e4 e5 Nf3 Nc6 Nc3 Nf6'],

  // Black
  ['opening-sicilian', 'Sicilian', '1. e4 c5', 'opening-sicilian', B, 'e4 c5'],
  ['opening-carokann', 'Caro-Kann', '1. e4 c6', 'opening-carokann', B, 'e4 c6'],
  ['opening-scandinavian', 'Scandinavian', '1. e4 d5', 'opening-scandinavian', B, 'e4 d5'],
  ['opening-pirc', 'Pirc', '1. e4 d6', 'opening-pirc', B, 'e4 d6'],
  ['opening-french', 'French', '1. e4 e6', 'opening-french', B, 'e4 e6'],
  ['opening-indiandefense', 'Indian Defense', '1. d4 Nf6', 'opening-indiandefense', B, 'd4 Nf6'],
  ['opening-doublebongcloud', 'Double Bongcloud', '1. e4 e5 2. Ke2 Ke7', 'opening-doublebongcloud', B, 'e4 e5 Ke2 Ke7'],
  ['opening-mosquito', 'Mosquito Gambit', '1. d4 e5 2. dxe5 Qh4', 'opening-mosquito', B, 'd4 e5 dxe5 Qh4'],
  ['opening-hedgehog-system', 'English: Hedgehog', '1. c4 Nf6 2. Nc3 e6', 'opening-hedgehog-system', B, 'c4 Nf6 Nc3 e6'],
  ['opening-rat', 'English Rat', '1. d4 d6 2. c4 e5', 'opening-rat', B, 'd4 d6 c4 e5'],
  ['opening-hippopotamus', 'Hippopotamus', '1. e4 Nh6', 'opening-hippopotamus', B, 'e4 Nh6'],
  ['opening-monkeysbum', "Monkey's Bum", '1. e4 g6 2. Bc4 Bg7 3. Qf3 e6 4. d4 Bxd4', 'opening-monkeysbum', B, 'e4 g6 Bc4 Bg7 Qf3 e6 d4 Bxd4'],
  ['opening-kangaroo', 'Kangaroo Defense', '1. d4 e6 2. c4 Bb4+', 'opening-kangaroo', B, 'd4 e6 c4 Bb4+'],
  ['opening-squirrel', 'The Squirrel', '1. e4 Nf6 2. e5 Nd5 3. c4 Nf4', 'opening-squirrel', B, 'e4 Nf6 e5 Nd5 c4 Nf4'],
  ['opening-elephant', 'Elephant Gambit', '1. e4 e5 2. Nf3 d5', 'opening-elephant', B, 'e4 e5 Nf3 d5'],
  ['opening-wasp', 'Elephant: Wasp', '1. e4 e5 2. Nf3 d5 3. Nxe5 dxe4 4. Bc4 Qg5', 'opening-wasp', B, 'e4 e5 Nf3 d5 Nxe5 dxe4 Bc4 Qg5'],
  ['opening-lamb', 'Lamb Defense', '1. d4 d5 2. e4 dxe4 3. Nc3 Nf6 4. f3 Nc6', 'opening-lamb', B, 'd4 d5 e4 dxe4 Nc3 Nf6 f3 Nc6'],
  ['opening-doubleduck', 'Double Duck', '1. f4 f5 2. d4 d5', 'opening-doubleduck', B, 'f4 f5 d4 d5'],
  ['opening-friedfox', 'Fried Fox', '1. e4 f6 2. d4 Kf7', 'opening-friedfox', B, 'e4 f6 d4 Kf7'],
  ['opening-snake', 'English: Great Snake', '1. c4 g6', 'opening-snake', B, 'c4 g6'],
  ['opening-hawk', 'Benoni: Hawk', '1. d4 Nf6 2. Nf3 c5 3. d5 c4', 'opening-hawk', B, 'd4 Nf6 Nf3 c5 d5 c4'],
  ['opening-lizard', 'Lizard Defense', '1. e4 g6 2. d4 Bg7 3. Nc3 d5', 'opening-lizard', B, 'e4 g6 d4 Bg7 Nc3 d5'],
  ['opening-mongoose', 'Sicilian: Mongoose', '1. e4 c5 2. Nf3 Qa5', 'opening-mongoose', B, 'e4 c5 Nf3 Qa5'],
  ['opening-snail', 'Benoni: Snail', '1. d4 c5 2. d5 Na6', 'opening-snail', B, 'd4 c5 d5 Na6'],
  ['opening-vulture', 'Vulture Defense', '1. d4 Nf6 2. c4 c5 3. d5 Ne4', 'opening-vulture', B, 'd4 Nf6 c4 c5 d5 Ne4'],

  // Common mainstream defenses (Black)
  ['opening-kingsindian', "King's Indian Defense", '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7', 'opening-kingsindian', B, 'd4 Nf6 c4 g6 Nc3 Bg7'],
  ['opening-nimzoindian', 'Nimzo-Indian Defense', '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4', 'opening-nimzoindian', B, 'd4 Nf6 c4 e6 Nc3 Bb4'],
  ['opening-grunfeld', 'Grünfeld Defense', '1. d4 Nf6 2. c4 g6 3. Nc3 d5', 'opening-grunfeld', B, 'd4 Nf6 c4 g6 Nc3 d5'],
  ['opening-qgd', "Queen's Gambit Declined", '1. d4 d5 2. c4 e6', 'opening-qgd', B, 'd4 d5 c4 e6'],
  ['opening-slav', 'Slav Defense', '1. d4 d5 2. c4 c6', 'opening-slav', B, 'd4 d5 c4 c6'],
  ['opening-alekhine', "Alekhine's Defense", '1. e4 Nf6', 'opening-alekhine', B, 'e4 Nf6'],
  ['opening-philidor', 'Philidor Defense', '1. e4 e5 2. Nf3 d6', 'opening-philidor', B, 'e4 e5 Nf3 d6'],
  ['opening-petrov', 'Petrov Defense', '1. e4 e5 2. Nf3 Nf6', 'opening-petrov', B, 'e4 e5 Nf3 Nf6'],
];

function openingAchievement([id, title, details, image, color, movesStr]) {
  const moves = movesStr.split(' ');
  return {
    id,
    title,
    details,
    image: `images/${image}.png`,
    scope: 'game',
    color,
    detect: (ctx) => (ctx.color === color && prefixMatch(ctx.san, moves) ? { ply: moves.length } : false),
  };
}

// Aggregate collection: the user must have had every member opening on the board
// across their games (either colour). Members are SAN move lines.
function collection(id, title, details, image, memberLines) {
  const members = memberLines.map((line) => line.split(' '));
  return {
    id,
    title,
    details,
    image: `images/${image}.png`,
    scope: 'game',
    init: () => ({ done: new Array(members.length).fill(false), left: members.length }),
    detect: (ctx, state) => {
      for (let i = 0; i < members.length; i++) {
        if (state.done[i]) continue;
        if (prefixMatch(ctx.san, members[i])) { state.done[i] = true; state.left--; }
      }
      return state.left === 0;
    },
    // Partial progress for the hints page: which member lines are done so far.
    progress: (state) => ({
      have: members.length - state.left,
      need: members.length,
      items: memberLines.map((line, i) => ({ key: line, done: state.done[i] })),
    }),
  };
}

// Speed / variant helpers over /api/account perfs.
const perfPlayed = (account, key) => (account.perfs?.[key]?.games || 0) > 0;

// Highest *established* (non-provisional) rating across the standard time controls.
const STD_PERFS = ['bullet', 'blitz', 'rapid', 'classical'];
const bestRating = (a) => Math.max(0, ...STD_PERFS.map((p) => {
  const x = a.perfs?.[p];
  return x && !x.prov ? (x.rating || 0) : 0;
}));
const hasEstablished = (a) => STD_PERFS.some((p) => {
  const x = a.perfs?.[p];
  return x && !x.prov && (x.games || 0) > 0;
});

// ---------------------------------------------------------------------------
// Registry, grouped into rendered categories.
// ---------------------------------------------------------------------------
export const CATEGORIES = [
  {
    name: 'Checkmates',
    items: [
      { id: 'queen-mate', title: "Queen's Quest", details: 'Deliver checkmate with a queen', image: 'images/mate-queen.png', scope: 'game', detect: (c) => isMate(c) && c.lastSan[0] === 'Q' },
      { id: 'rook-mate', title: 'Raging Rook', details: 'Deliver checkmate with a rook', image: 'images/mate-rook.png', scope: 'game', detect: (c) => isMate(c) && c.lastSan[0] === 'R' },
      { id: 'bishop-mate', title: 'Bold Bishop', details: 'Deliver checkmate with a bishop', image: 'images/mate-bishop.png', scope: 'game', detect: (c) => isMate(c) && c.lastSan[0] === 'B' },
      { id: 'knight-mate', title: 'Knight Knockout', details: 'Deliver checkmate with a knight', image: 'images/mate-knight.png', scope: 'game', detect: (c) => isMate(c) && c.lastSan[0] === 'N' },
      { id: 'short-castle-mate', title: 'Oh-Oh', details: 'Deliver checkmate by castling short', image: 'images/mate-caslte-short.png', scope: 'game', detect: (c) => isMate(c) && c.lastSan === 'O-O#' },
      { id: 'long-castle-mate', title: 'Oh-Oh-Oh', details: 'Deliver checkmate by castling long', image: 'images/mate-castle-long.png', scope: 'game', detect: (c) => isMate(c) && c.lastSan === 'O-O-O#' },
      { id: 'en-passant-mate', title: 'French Move', details: 'Deliver checkmate by capturing en passant', image: 'images/mate-en-passant.png', scope: 'game', needsBoard: true, detect: (c) => c.board.epMate },
      { id: 'pawn-finish', title: 'Pawn Finish', details: 'Checkmate by promoting a pawn to a queen', image: 'images/pawn-finish.png', scope: 'game', detect: (c) => isMate(c) && /=Q#$/.test(c.lastSan) },
      { id: 'pawn-finish-deluxe', title: 'Pawn Finish Deluxe', details: 'Checkmate by underpromoting a pawn', image: 'images/pawn-finish-deluxe.png', scope: 'game', detect: (c) => isMate(c) && /=[RBN]#$/.test(c.lastSan) },
      { id: 'pacifist-win', title: 'Pacifist', details: 'Checkmate with no capture by either side all game', image: 'images/pacifist.png', scope: 'game', detect: (c) => isMate(c) && !c.anyCapture },
      { id: 'check-check-mate', title: 'Check, Check, Mate', details: 'Give check, check, then checkmate on three moves in a row', image: 'images/check-check-mate.png', scope: 'game', detect: (c) => {
        if (!isMate(c)) return false;
        const u = c.userSan; const n = u.length;
        return n >= 3 && u[n - 1].endsWith('#') && u[n - 2].endsWith('+') && u[n - 3].endsWith('+');
      } },
      { id: 'lazy-king', title: 'Lazy King', details: 'Checkmate without your king ever moving', image: 'images/lazy-king.png', scope: 'game', detect: (c) => isMate(c) && !startsWith(c.userSan, 'K') && !castled(c.userSan) },
      { id: 'lazy-queen', title: 'Lazy Queen', details: 'Checkmate without your queen ever moving', image: 'images/lazy-queen.png', scope: 'game', detect: (c) => isMate(c) && !startsWith(c.userSan, 'Q') },
      { id: 'lazy-rook', title: 'Lazy Rooks', details: 'Checkmate without your rooks ever moving', image: 'images/lazy-rook.png', scope: 'game', detect: (c) => isMate(c) && !startsWith(c.userSan, 'R') && !castled(c.userSan) },
      { id: 'lazy-bishop', title: 'Lazy Bishops', details: 'Checkmate without your bishops ever moving', image: 'images/lazy-bishop.png', scope: 'game', detect: (c) => isMate(c) && !startsWith(c.userSan, 'B') },
      { id: 'lazy-knight', title: 'Lazy Knights', details: 'Checkmate without your knights ever moving', image: 'images/lazy-knight.png', scope: 'game', detect: (c) => isMate(c) && !startsWith(c.userSan, 'N') },
    ],
  },
  {
    name: 'Winning Feats',
    items: [
      { id: 'flag-opponent', title: 'Be Quick', details: 'Win by flagging your opponent on time', image: 'images/flag-opponent.png', scope: 'game', detect: (c) => c.won && c.status === 'outoftime' },
      { id: 'survivor', title: 'Survivor', details: 'Win a game after being checked at least five times', image: 'images/survivor.png', scope: 'game', detect: (c) => c.won && c.checksByOpp >= 5 },
      { id: 'underachiever', title: 'Underachiever', details: 'Win a game in which you underpromoted a pawn', image: 'images/underachiever.png', scope: 'game', detect: (c) => c.won && c.userSan.some((m) => /=[RBN]/.test(m)) },
      { id: 'kings-journey', title: "King's Journey", details: "Win after your king reaches the opponent's back rank (8th for White, 1st for Black)", image: 'images/kings-journey.png', scope: 'game', needsBoard: true, detect: (c) => c.won && c.board.kingCrossed },
      { id: 'underdog', title: 'Underdog', details: 'Beat an opponent rated at least 200 points above you', svg: 'chart', color: '#0ea5e9', scope: 'game', detect: (c) => c.won && c.oppRating && c.myRating && (c.oppRating - c.myRating) >= 200 },
      { id: 'giant-slayer', title: 'Giant Slayer', details: 'Beat a titled player', svg: 'cap', color: '#0891b2', scope: 'game', detect: (c) => c.won && !!c.oppTitle && c.oppTitle !== 'BOT' },
      { id: 'comeback', title: 'Comeback King', details: 'Win after being down at least a rook (5 points of material) at some point', svg: 'trophy', color: '#f59e0b', scope: 'game', needsBoard: true, detect: (c) => c.won && c.board.minMaterialDiff <= -5 },
      { id: 'houdini', title: 'The Great Escape', details: 'Win after being down at least a full queen (9 points of material) at some point', svg: 'sparkles', color: '#ef4444', scope: 'game', needsBoard: true, detect: (c) => c.won && c.board.minMaterialDiff <= -9 },
      { id: 'win-streak-5', title: 'On Fire', details: 'Win five standard games in a row', svg: 'fire', color: '#f97316', scope: 'game', init: () => ({ cur: 0 }), detect: (c, s) => { s.cur = c.won ? s.cur + 1 : 0; return s.cur >= 5; } },
      { id: 'win-streak-10', title: 'Unstoppable', details: 'Win ten standard games in a row', svg: 'bolt', color: '#dc2626', scope: 'game', init: () => ({ cur: 0 }), detect: (c, s) => { s.cur = c.won ? s.cur + 1 : 0; return s.cur >= 10; } },
    ],
  },
  {
    name: 'Board Antics',
    items: [
      { id: 'queen-party', title: 'Queen Party', details: 'Have more than one of your queens on the board at once', image: 'images/queen-party.png', scope: 'game', needsBoard: true, detect: (c) => c.board.maxQueens >= 2 },
      { id: 'underpromote-knight', title: 'Knighthood', details: 'Underpromote a pawn to a knight', image: 'images/underpromote-knight.png', scope: 'game', detect: (c) => c.userSan.some((m) => /=N/.test(m)) },
      { id: 'underpromote-bishop', title: 'Cleric', details: 'Underpromote a pawn to a bishop', image: 'images/underpromote-bishop.png', scope: 'game', detect: (c) => c.userSan.some((m) => /=B/.test(m)) },
      { id: 'underpromote-rook', title: 'Fortress', details: 'Underpromote a pawn to a rook', image: 'images/underpromote-rook.png', scope: 'game', detect: (c) => c.userSan.some((m) => /=R/.test(m)) },
      { id: 'promotion-party', title: 'Promotion Party', details: 'Promote to a queen, rook, bishop and knight in one game', image: 'images/promotion-party.png', scope: 'game', detect: (c) => {
        const s = new Set();
        for (const m of c.userSan) { const mm = m.match(/=([QRBN])/); if (mm) s.add(mm[1]); }
        return s.size === 4;
      } },
      { id: 'takes-takes-takes', title: 'Takes, Takes, Takes', details: 'Capture on three of your moves in a row', image: 'images/takes-takes-takes.png', scope: 'game', detect: (c) => {
        let run = 0;
        for (const m of c.userSan) { if (m.includes('x')) { if (++run >= 3) return true; } else run = 0; }
        return false;
      } },
      { id: 'en-passant', title: 'En Passant', details: 'Capture a pawn en passant', svg: 'bolt', color: '#22c55e', scope: 'game', needsBoard: true, detect: (c) => c.board.epAny },
      { id: 'promote-three', title: 'Promotion Spree', details: 'Promote three or more pawns in a single game', svg: 'sparkles', color: '#8b5cf6', scope: 'game', detect: (c) => c.userSan.filter((m) => m.includes('=')).length >= 3 },
      { id: 'promote-eight', title: 'Eight is Enough', details: 'Promote all eight of your pawns in a single game', svg: 'crown', color: '#a855f7', scope: 'game', detect: (c) => c.userSan.filter((m) => m.includes('=')).length >= 8 },
    ],
  },
  {
    name: 'Openings: White',
    items: OPENINGS.filter((o) => o[4] === W).map(openingAchievement),
  },
  {
    name: 'Openings: Black',
    items: OPENINGS.filter((o) => o[4] === B).map(openingAchievement),
  },
  {
    name: 'Opening Collections',
    items: [
      { id: 'openings-allwhite', title: 'Encyclopedia', details: 'Play all twenty possible first moves as White', image: 'images/openings-all20.png', scope: 'game', init: () => ({ moves: new Set() }),
        detect: (c, s) => {
          if (c.color === W && c.san.length) s.moves.add(bare(c.san[0]));
          return s.moves.size >= 20;
        },
        progress: (s) => ({
          have: s.moves.size,
          need: 20,
          items: FIRST_MOVES.map((m) => ({ key: m, done: s.moves.has(m) })),
        }) },
      // The Union — one opening per EU member state.
      collection('openings-eu', 'The Union', 'Play an opening corresponding to each EU member state', 'openings-eu', [
        'e4 e5 Nc3',                                          // AT Vienna Game
        'e4 c5 Nf3 f5',                                       // BE Sicilian: Brussels Gambit
        'e4 e5 Nf3 Nc6 Bb5 a5',                               // BG Ruy Lopez: Bulgarian
        'e4 e6 d4 Nf6',                                       // CY French: Mediterranean
        'e4 d6 d4 Nf6 Nc3 c6',                                // CZ Czech Defense
        'e4 e5 Nf3 Nc6 Bb5 Nf6',                              // DE Ruy Lopez: Berlin
        'e4 e5 d4 exd4 c3',                                   // DK Danish Gambit
        'd4 d5 c4 Bf5',                                       // EE QGD: Baltic Defense
        'e4 e5 Nf3 Nc6 Bb5',                                  // ES Ruy Lopez
        'e4 c6 d4 d5 Nd2 dxe4 Nxe4 h6',                       // FI Caro-Kann: Finnish
        'e4 e6',                                              // FR French Defense
        'e4 b6',                                              // GR Greek / Owen's Defense
        'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 g3',           // HR Sicilian Najdorf: Zagreb
        'g3',                                                 // HU Hungarian Opening
        'e4 e5 Nf3 Nc6 Nxe5',                                 // IE Irish Gambit
        'e4 e5 Nf3 Nc6 Bc4',                                  // IT Italian Game
        'd4 Nc6 c4 e5 d5 Nce7',                               // LT Mikenas: Lithuanian
        'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Bc5 c3 O-O d4 Bb6',       // LU Ruy Lopez: Benelux
        'e4 e5 Nf3 f5',                                       // LV Latvian Gambit
        'd4 Nf6 g4 Nxg4 f3 Nf6 e4',                           // MT Maltese Falcon
        'd4 f5',                                              // NL Dutch Defense
        'd4 b5',                                              // PL Polish Defense
        'e4 e5 Bb5',                                          // PT Portuguese Opening
        'e4 c5 b4 cxb4 a3 d5 exd5 Qxd5 Nf3 e5 Bb2 Nc6 c4 Qe6', // RO Sicilian Wing: Romanian
        'd4 d5 c4 e6 Nc3 c5 cxd5 exd5 Nf3 Nc6 g3 c4',        // SE Tarrasch: Swedish
        'd4 Nf6 c4 c6',                                       // SI Slav Indian
        'd4 d5 c4 c6',                                        // SK Slav Defense
      ]),
      collection('openings-scary', 'Scary Stuff', 'Play very scary openings', 'openings-scary', [
        'e4 e5 Nf3 Nc6 Bb5 Nf6 Nxe5',                         // Ruy Lopez: Halloween Attack
        'e4 e5 Nf3 Nc6 Nc3 Nf6 Nxe5',                         // Four Knights: Halloween Gambit
        'e4 e5 Nc3 Nf6 Bc4 Nxe4',                             // Vienna: Frankenstein-Dracula
        'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4 Qb6', // Najdorf: Poisoned Pawn
        'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7 Qg4 Qc7', // French Winawer: Poisoned Pawn
        'd4 Nf6 Bg5 c5 d5 Qb6 Nc3',                           // Trompowsky: Poisoned Pawn
      ]),
      collection('openings-fantasy', 'Fierce Fantasy', 'Play fantasy-themed openings', 'openings-fantasy', [
        'e4 f6 d4 b6 c4 Bb7',                                 // Owen: Unicorn Variation
        'e4 e5 Nf3 Nc6 c4 Nf6 Nxe5',                          // Dresden: The Goblin
        'd4 Nf6 c4 g5',                                       // Indian: Medusa Gambit
        'e4 c6 d4 d5 Nf3 dxe4 Ng5',                           // Caro-Kann: Ulysses Gambit
        'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Ng5 h6 Nxf7',         // Caro-Kann: Alien Gambit
        'e4 e5 Nc3 Nf6 Bc4 Nxe4 Qh5 Nd6 Bb3 Be7',            // Vienna: Monster Declined
      ]),
      // The Zoo — one opening per animal. Includes every animal-named opening that
      // also appears as an individual tile in Openings: White / Openings: Black.
      collection('openings-zoo', 'The Zoo', 'Play an opening for each animal', 'openings-zoo', [
        'e4 e5 Nf3 d5',                                       // Elephant Gambit
        'd4 Nf6 Nf3 c5 d5 c4',                                // Benoni: Hawk
        'd4 e5 dxe5 Qh4',                                     // Englund: Mosquito Gambit
        'e4 g6 d4 Bg7 Nc3 d5',                                // Modern: Lizard Defense
        'd4 Nf6 Bg5 Ne4 h4',                                  // Trompowsky: Raptor
        'e4 f6 d4 Kf7',                                       // Fried Fox Defense
        'c4 Nf6 b4',                                          // English Orangutan
        'd4 e6 c4 Bb4+',                                      // Kangaroo Defense
        'e4 Nh6',                                             // Hippopotamus Defense
        'a4 e5 h4',                                           // Ware: Crab Variation
        'e4 e5 c4',                                           // English: The Whale
        'd4 g6 c4 Bg7 e4 c5 d5 Qa5+',                         // Pterodactyl: Central
        'e4 c5 Nc3 Nc6 Nge2',                                // Sicilian: Chameleon
        'e4 d6 d4 Nf6 f3',                                    // Lion's Jaw
        'c4 f5 Nc3 Nf6 e4 fxe4 g4',                           // English: Porcupine
        'e4 e5 Nc3 Bc5 Qg4',                                  // Giraffe Attack
        'e4 e5 d4 exd4 f4 Bc5 Nf3 Nc6 c3',                    // Crocodile Variation
        'e4 e5 Nf3 f5 g4',                                    // Lobster Gambit
        'Nf3 d5 c4 d4 Rg1',                                  // Penguin Variation
        'e4 e5 Nf3 Nc6 d3 f5 exf5',                           // Clam Gambit
        'd4 d5 e4 dxe4 Nc3 Nf6 f3 exf3 Nxf3 g6 Bc4 Bg7 h4',  // Mad Dog Attack
        'e4 c6 Nc3 d5 d3 dxe4 Bg5',                           // Scorpion-Horus Gambit
        'e4 e5 Bd3',                                          // Tortoise Opening
        'c4 Nf6 Nc3 e6',                                      // English: Hedgehog
        'd4 d6 c4 e5',                                        // English Rat
        'e4 g6 Bc4 Bg7 Qf3 e6 d4 Bxd4',                       // Monkey's Bum
        'e4 Nf6 e5 Nd5 c4 Nf4',                               // The Squirrel
        'e4 e5 Nf3 d5 Nxe5 dxe4 Bc4 Qg5',                     // Elephant: Wasp
        'd4 d5 e4 dxe4 Nc3 Nf6 f3 Nc6',                       // Lamb Defense
        'f4 f5 d4 d5',                                        // Double Duck
        'c4 g6',                                              // English: Great Snake
        'e4 c5 Nf3 Qa5',                                      // Sicilian: Mongoose
        'd4 c5 d5 Na6',                                       // Benoni: Snail
        'd4 Nf6 c4 c5 d5 Ne4',                                // Vulture Defense
      ]),
      // Champions — one opening named after each undisputed World Champion.
      collection('openings-champions', 'Hall of Champions', 'Play an opening named after each World Champion', 'openings-champions', [
        'e4 e6 e5',                                           // Steinitz Attack
        'd4 Nf6 c4 e6 Nc3 d5 Bg5 Be7 e3 Ne4',                // Lasker Defense
        'd4 Nf6 c4 e6 Nf3 d5 Bg5 h6',                         // Capablanca Variation
        'e4 Nf6',                                             // Alekhine Defense
        'e4 c6 b3',                                           // Euwe Attack
        'e4 c6 d4 d5 e5 c5',                                  // Botvinnik-Carls Defense
        'Nf3 Nf6 g3 g6 b4',                                  // Smyslov Variation
        'e4 c5 f4 d5 exd5 Nf6',                               // Tal Gambit
        'd4 Nf6 c4 e6 Nf3 b6 a3',                             // Petrosian Variation
        'Nf3 Nf6 g3 b5',                                      // Spassky Variation
        'e4 e5 f4 exf4 Nf3 d6',                               // Fischer Defense
        'e4 c6 d4 d5 Nd2 dxe4 Nxe4 Nd7',                      // Karpov Variation
        'd4 Nf6 c4 e6 Nf3 b6 Nc3',                            // Kasparov Variation
        'c4 e5 Nc3 Bb4',                                      // Kramnik-Shirov Counterattack
        'e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 Nce2',                  // Shirov-Anand Variation
        'e4 c5 Nc3 d6 d4 cxd4 Qxd4 Nc6 Qd2',                 // Carlsen Variation
      ]),
      collection('openings-beverages', 'Blissful Beverages', 'Play beverage-themed openings', 'openings-beverages', [
        'd4 Nf6 c4 c5 d5 b5 cxb5 a6 Nc3 axb5 e4 b4 Nb5 d6 Bc4', // Benko: Nescafe Frappe Attack
        'g4 g5 f4',                                           // Grob: Coca-Cola Gambit
        'e4 e5 Nf3 Nc6 d4 exd4 Bc4',                          // Scotch Gambit
        'Nf3 Na6 e4 Nh6',                                     // Zukertort: Drunken Cavalry
      ]),
    ],
  },
  {
    name: 'Time Controls',
    items: [
      { id: 'play-ultrabullet', title: 'UltraBullet', details: 'Play an UltraBullet game', image: 'images/rated-ultrabullet.png', scope: 'account', unlock: (a) => perfPlayed(a, 'ultraBullet') },
      { id: 'play-bullet', title: 'Bullet', details: 'Play a Bullet game', image: 'images/rated-bullet.png', scope: 'account', unlock: (a) => perfPlayed(a, 'bullet') },
      { id: 'play-blitz', title: 'Blitz', details: 'Play a Blitz game', image: 'images/rated-blitz.png', scope: 'account', unlock: (a) => perfPlayed(a, 'blitz') },
      { id: 'play-rapid', title: 'Rapid', details: 'Play a Rapid game', image: 'images/rated-rapid.png', scope: 'account', unlock: (a) => perfPlayed(a, 'rapid') },
      { id: 'play-classical', title: 'Classical', details: 'Play a Classical game', image: 'images/rated-classical.png', scope: 'account', unlock: (a) => perfPlayed(a, 'classical') },
      { id: 'play-correspondence', title: 'Correspondence', details: 'Play a Correspondence game', image: 'images/rated-correspondence.png', scope: 'account', unlock: (a) => perfPlayed(a, 'correspondence') },
    ],
  },
  {
    name: 'Variants',
    items: [
      { id: 'variant-crazyhouse', title: 'Crazyhouse', details: 'Play a game of Crazyhouse', image: 'images/variant-crazyhouse.png', scope: 'account', unlock: (a) => perfPlayed(a, 'crazyhouse') },
      { id: 'variant-chess960', title: 'Chess960', details: 'Play a game of Chess960', image: 'images/variant-chess960.png', scope: 'account', unlock: (a) => perfPlayed(a, 'chess960') },
      { id: 'variant-kingofthehill', title: 'King of the Hill', details: 'Play a game of King of the Hill', image: 'images/variant-kingOfTheHill.png', scope: 'account', unlock: (a) => perfPlayed(a, 'kingOfTheHill') },
      { id: 'variant-threecheck', title: 'Three-Check', details: 'Play a game of Three-Check', image: 'images/variant-threeCheck.png', scope: 'account', unlock: (a) => perfPlayed(a, 'threeCheck') },
      { id: 'variant-antichess', title: 'Antichess', details: 'Play a game of Antichess', image: 'images/variant-antichess.png', scope: 'account', unlock: (a) => perfPlayed(a, 'antichess') },
      { id: 'variant-atomic', title: 'Atomic', details: 'Play a game of Atomic', image: 'images/variant-atomic.png', scope: 'account', unlock: (a) => perfPlayed(a, 'atomic') },
      { id: 'variant-horde', title: 'Horde', details: 'Play a game of Horde', image: 'images/variant-horde.png', scope: 'account', unlock: (a) => perfPlayed(a, 'horde') },
      { id: 'variant-racingkings', title: 'Racing Kings', details: 'Play a game of Racing Kings', image: 'images/variant-racingKings.png', scope: 'account', unlock: (a) => perfPlayed(a, 'racingKings') },
    ],
  },
  {
    name: 'Milestones',
    items: [
      { id: 'play-1', title: 'First Blood', details: 'Play your first game', image: 'images/play-1.png', scope: 'account', unlock: (a) => (a.count?.all || 0) >= 1 },
      { id: 'play-10', title: 'Getting Started', details: 'Play 10 games', image: 'images/play-10.png', scope: 'account', unlock: (a) => (a.count?.all || 0) >= 10 },
      { id: 'play-100', title: 'Centurion', details: 'Play 100 games', image: 'images/play-100.png', scope: 'account', unlock: (a) => (a.count?.all || 0) >= 100 },
      { id: 'play-1000', title: 'Devotee', details: 'Play 1,000 games', image: 'images/play-1000.png', scope: 'account', unlock: (a) => (a.count?.all || 0) >= 1000 },
      { id: 'play-10000', title: 'Veteran', details: 'Play 10,000 games', image: 'images/play-10000.png', scope: 'account', unlock: (a) => (a.count?.all || 0) >= 10000 },
      { id: 'play-100000', title: 'Legend', details: 'Play 100,000 games', image: 'images/play-100000.png', scope: 'account', unlock: (a) => (a.count?.all || 0) >= 100000 },
      { id: 'play-computer', title: 'Machine Challenger', details: 'Play a game against the computer', image: 'images/play-computer.png', scope: 'account', unlock: (a) => (a.count?.ai || 0) >= 1 },
      { id: 'account-age', title: 'Happy Birthday!', details: 'Have a Lichess account at least one year old', image: 'images/birthday.png', scope: 'account', unlock: (a) => a.createdAt && Date.now() - a.createdAt >= 365 * 864e5 },
    ],
  },

  // ---- Categories below use coloured SVG placeholder tiles (real art later) ----
  {
    name: 'Ratings',
    items: [
      { id: 'rating-1500', title: 'Rising Star', details: 'Reach an established rating of 1500', svg: 'star', color: '#3b82f6', scope: 'account', unlock: (a) => bestRating(a) >= 1500 },
      { id: 'rating-1800', title: 'Sharpshooter', details: 'Reach an established rating of 1800', svg: 'chart', color: '#6366f1', scope: 'account', unlock: (a) => bestRating(a) >= 1800 },
      { id: 'rating-2000', title: 'Expert', details: 'Reach an established rating of 2000', svg: 'trophy', color: '#8b5cf6', scope: 'account', unlock: (a) => bestRating(a) >= 2000 },
      { id: 'rating-2200', title: 'Master Class', details: 'Reach an established rating of 2200', svg: 'cap', color: '#a855f7', scope: 'account', unlock: (a) => bestRating(a) >= 2200 },
      { id: 'rating-established', title: 'Established', details: 'Clear a provisional rating in any format', svg: 'verified', color: '#0ea5e9', scope: 'account', unlock: (a) => hasEstablished(a) },
      { id: 'peak-2000', title: 'New Heights', details: 'Reach a peak rating of 2000 in any format', svg: 'trophy', color: '#7c3aed', scope: 'extra', unlock: (x) => x.peak.int >= 2000 ? { gameId: x.peak.gameId } : false },
      { id: 'peak-2200', title: 'Mountaineer', details: 'Reach a peak rating of 2200 in any format', svg: 'crown', color: '#6d28d9', scope: 'extra', unlock: (x) => x.peak.int >= 2200 ? { gameId: x.peak.gameId } : false },
      { id: 'peak-2400', title: 'Summit', details: 'Reach a peak rating of 2400 in any format', svg: 'star', color: '#5b21b6', scope: 'extra', unlock: (x) => x.peak.int >= 2400 ? { gameId: x.peak.gameId } : false },
    ],
  },
  {
    name: 'Records',
    items: [
      { id: 'win-1', title: 'First Win', details: 'Win your first game', svg: 'flag', color: '#22c55e', scope: 'account', unlock: (a) => (a.count?.win || 0) >= 1 },
      { id: 'win-100', title: 'Hundred Wins', details: 'Win 100 games', svg: 'trophy', color: '#16a34a', scope: 'account', unlock: (a) => (a.count?.win || 0) >= 100 },
      { id: 'win-1000', title: 'Conqueror', details: 'Win 1,000 games', svg: 'crown', color: '#15803d', scope: 'account', unlock: (a) => (a.count?.win || 0) >= 1000 },
      { id: 'draw-1', title: 'Diplomat', details: 'Draw a game', svg: 'scale', color: '#14b8a6', scope: 'account', unlock: (a) => (a.count?.draw || 0) >= 1 },
      { id: 'draw-100', title: 'Peacemaker', details: 'Draw 100 games', svg: 'scale', color: '#0d9488', scope: 'account', unlock: (a) => (a.count?.draw || 0) >= 100 },
      { id: 'rated-1000', title: 'For the Record', details: 'Play 1,000 rated games', svg: 'chart', color: '#10b981', scope: 'account', unlock: (a) => (a.count?.rated || 0) >= 1000 },
    ],
  },
  {
    name: 'Puzzles',
    items: [
      { id: 'puzzle-solve', title: 'Puzzler', details: 'Solve a Lichess puzzle', svg: 'puzzle', color: '#f59e0b', scope: 'account', unlock: (a) => (a.perfs?.puzzle?.games || 0) >= 1 },
      { id: 'puzzle-2000', title: 'Puzzle Expert', details: 'Reach a puzzle rating of 2000', svg: 'star', color: '#d97706', scope: 'account', unlock: (a) => (a.perfs?.puzzle?.games || 0) > 0 && (a.perfs?.puzzle?.rating || 0) >= 2000 },
      { id: 'storm-play', title: 'Storm Chaser', details: 'Play Puzzle Storm', image: 'images/puzzle-storm.png', scope: 'account', unlock: (a) => (a.perfs?.storm?.runs || 0) >= 1 },
      { id: 'storm-50', title: 'Eye of the Storm', details: 'Score 50 in Puzzle Storm', image: 'images/puzzle-storm-score.png', scope: 'account', unlock: (a) => (a.perfs?.storm?.score || 0) >= 50 },
      { id: 'racer-play', title: 'Puzzle Racer', details: 'Play Puzzle Racer', image: 'images/puzzle-racer.png', scope: 'account', unlock: (a) => (a.perfs?.racer?.runs || 0) >= 1 },
      { id: 'racer-50', title: 'Photo Finish', details: 'Score 50 in Puzzle Racer', image: 'images/puzzle-racer-score.png', scope: 'account', unlock: (a) => (a.perfs?.racer?.score || 0) >= 50 },
      { id: 'streak-play', title: 'On a Streak', details: 'Play Puzzle Streak', image: 'images/puzzle-streak.png', scope: 'account', unlock: (a) => (a.perfs?.streak?.runs || 0) >= 1 },
      { id: 'streak-50', title: 'Unbroken', details: 'Reach a streak of 50', image: 'images/puzzle-streak-score.png', scope: 'account', unlock: (a) => (a.perfs?.streak?.score || 0) >= 50 },
      { id: 'storm-100', title: 'Storm Master', details: 'Score 100 in Puzzle Storm', svg: 'fire', color: '#c2410c', scope: 'account', unlock: (a) => (a.perfs?.storm?.score || 0) >= 100 },
      { id: 'puzzle-theme', title: 'Theme Hunter', details: 'Solve at least 50 puzzles of a single theme', svg: 'puzzle', color: '#ca8a04', scope: 'extra', unlock: (x) => x.puzzleThemeMax >= 50 },
      { id: 'puzzle-performance', title: 'Tactician', details: 'Reach a puzzle performance of 2200', svg: 'star', color: '#a16207', scope: 'extra', unlock: (x) => x.puzzlePerformance >= 2200 },
    ],
  },
  {
    name: 'Profile & Community',
    items: [
      { id: 'profile-flag', title: 'Represent', details: 'Set your country or region flag', svg: 'flag', color: '#ec4899', scope: 'account', unlock: (a) => !!a.profile?.flag },
      { id: 'profile-bio', title: 'Storyteller', details: 'Write a profile bio', svg: 'pencil', color: '#d946ef', scope: 'account', unlock: (a) => !!a.profile?.bio },
      { id: 'profile-name', title: 'Face to the Name', details: 'Add your real name', svg: 'idcard', color: '#c026d3', scope: 'account', unlock: (a) => !!a.profile?.realName },
      { id: 'profile-fide', title: 'Over the Board', details: 'Link a FIDE rating or ID', svg: 'chart', color: '#a21caf', scope: 'account', unlock: (a) => !!(a.profile?.fideRating || a.fideId) },
      { id: 'account-title', title: 'Titled Player', details: 'Hold a Lichess title', svg: 'cap', color: '#7e22ce', scope: 'account', unlock: (a) => !!a.title },
      { id: 'account-verified', title: 'Verified', details: 'Get a verified account', svg: 'verified', color: '#9333ea', scope: 'account', unlock: (a) => !!a.verified },
      { id: 'support-patron', title: 'Patron', details: 'Become a Lichess Patron', image: 'images/patron.png', scope: 'account', unlock: (a) => !!a.patron },
      { id: 'account-flair', title: 'Flair', details: 'Choose a profile flair', svg: 'sparkles', color: '#e879f9', scope: 'account', unlock: (a) => !!a.flair },
      { id: 'count-bookmark', title: 'Collector', details: 'Bookmark a game', svg: 'bookmark', color: '#db2777', scope: 'account', unlock: (a) => (a.count?.bookmark || 0) >= 1 },
      { id: 'count-import', title: 'Archivist', details: 'Import a game', svg: 'import', color: '#be185d', scope: 'account', unlock: (a) => (a.count?.import || 0) >= 1 },
      { id: 'account-streamer', title: 'Broadcaster', details: 'Be a Lichess streamer', svg: 'video', color: '#a21caf', scope: 'account', unlock: (a) => !!a.streamer },
    ],
  },
  {
    name: 'Dedication',
    items: [
      { id: 'playtime', title: 'Time Well Spent', details: 'Spend at least one hour playing chess', image: 'images/playtime.png', scope: 'account', unlock: (a) => (a.playTime?.total || 0) >= 3600 },
      { id: 'playtime-24h', title: 'A Full Day', details: 'Play for a total of 24 hours', image: 'images/play-time.png', scope: 'account', unlock: (a) => (a.playTime?.total || 0) >= 86400 },
      { id: 'playtime-100h', title: 'Centurion of Hours', details: 'Play for a total of 100 hours', svg: 'clock', color: '#0891b2', scope: 'account', unlock: (a) => (a.playTime?.total || 0) >= 360000 },
      { id: 'playtime-1000h', title: 'Timeless', details: 'Play for a total of 1,000 hours', svg: 'hourglass', color: '#0e7490', scope: 'account', unlock: (a) => (a.playTime?.total || 0) >= 3600000 },
      { id: 'tv-time', title: 'Prime Time', details: 'Be featured on Lichess TV', image: 'images/tv.png', scope: 'account', unlock: (a) => (a.playTime?.tv || 0) >= 1 },
      { id: 'session-games', title: 'Grinder', details: 'Play at least 20 games in a single sitting', svg: 'fire', color: '#0e7490', scope: 'extra', unlock: (x) => x.sessionGames >= 20 },
      { id: 'session-time', title: 'Iron Player', details: 'Play for two hours in a single sitting', svg: 'hourglass', color: '#155e75', scope: 'extra', unlock: (x) => x.sessionTime >= 7200 },
    ],
  },
  {
    name: 'Notable Games',
    items: [
      { id: 'miniature', title: 'Miniature', details: 'Win a game in 10 moves or fewer', svg: 'bolt', color: '#ef4444', scope: 'game', detect: (c) => c.won && c.san.length <= 20 },
      { id: 'marathon', title: 'Marathon', details: 'Play a game of at least 60 moves', svg: 'hourglass', color: '#f43f5e', scope: 'game', detect: (c) => c.san.length >= 120 },
      { id: 'scholars-mate', title: "Scholar's Mate", details: 'Checkmate in the first four moves with your queen', svg: 'trophy', color: '#e11d48', scope: 'game', detect: (c) => isMate(c) && c.san.length <= 8 && /^Qx?f[27]#$/.test(c.lastSan) },
      { id: 'fools-mate', title: "Fool's Mate", details: 'Deliver the two-move fool’s mate', svg: 'star', color: '#be123c', scope: 'game', detect: (c) => isMate(c) && c.san.length <= 4 && c.lastSan === 'Qh4#' },
      { id: 'night-owl', title: 'Night Owl', details: 'Play a game between midnight and 5 a.m. your local time', svg: 'clock', color: '#6366f1', scope: 'game', detect: (c) => { const h = new Date(c.createdAt).getHours(); return h >= 0 && h < 5; } },
    ],
  },

  // ---- Extra-scope categories: sourced from supplementary endpoints (worker.js).
  {
    name: 'Social',
    items: [
      { id: 'team-join', title: 'Team Player', details: 'Join a team', svg: 'idcard', color: '#4f46e5', scope: 'extra', unlock: (x) => x.teams.length >= 1 },
      { id: 'team-three', title: 'Social Butterfly', details: 'Be a member of three teams at once', svg: 'sparkles', color: '#6366f1', scope: 'extra', unlock: (x) => x.teams.length >= 3 },
      { id: 'follow-one', title: 'Fan', details: 'Follow another player', svg: 'star', color: '#7c3aed', scope: 'extra', unlock: (x) => x.following.length >= 1 },
      { id: 'follow-ten', title: 'Networker', details: 'Follow ten players', svg: 'chart', color: '#8b5cf6', scope: 'extra', unlock: (x) => x.following.length >= 10 },
      { id: 'study-write', title: 'Scholar', details: 'Create a study', image: 'images/study.png', scope: 'extra', unlock: (x) => x.studies.length >= 1 },
    ],
  },
  {
    name: 'Tournaments',
    items: [
      { id: 'arena-play', title: 'To the Arena', details: 'Play in an arena tournament', svg: 'bolt', color: '#eab308', scope: 'extra', unlock: (x) => x.tournaments.length >= 1 },
      { id: 'arena-host', title: 'Host', details: 'Create your own tournament', svg: 'flag', color: '#f59e0b', scope: 'extra', unlock: (x) => x.created.length >= 1 },
      { id: 'arena-podium', title: 'On the Podium', details: 'Finish in the top three of an arena', svg: 'cap', color: '#d97706', scope: 'extra', unlock: (x) => x.tournaments.some((t) => t.player?.rank >= 1 && t.player.rank <= 3) },
      { id: 'arena-win', title: 'Arena Champion', details: 'Win an arena tournament', svg: 'trophy', color: '#f97316', scope: 'extra', unlock: (x) => x.tournaments.some((t) => t.player?.rank === 1) },
      { id: 'arena-points-100', title: 'Point Collector', details: 'Score 100 arena points in total', svg: 'star', color: '#ea580c', scope: 'extra', unlock: (x) => x.arenaPoints >= 100 },
      { id: 'arena-points-1000', title: 'Point Hoarder', details: 'Score 1,000 arena points in total', svg: 'crown', color: '#b45309', scope: 'extra', unlock: (x) => x.arenaPoints >= 1000 },
      { id: 'berserk-1', title: 'Berserker', details: 'Berserk a tournament game', svg: 'bolt', color: '#dc2626', scope: 'extra', unlock: (x) => x.berserk >= 1 },
      { id: 'berserk-100', title: 'Berserk Fanatic', details: 'Berserk 100 tournament games', svg: 'fire', color: '#b91c1c', scope: 'extra', unlock: (x) => x.berserk >= 100 },
    ],
  },
];

// Flat list, for the worker.
export const ALL = CATEGORIES.flatMap((c) => c.items);

// Static deep links for achievements that aren't tied to a single game (account/
// extra scope). `{u}` is replaced with the logged-in user's id at render time
// (see main.js). Applied onto the achievement objects below.
const LINKS = {
  // Social
  'team-join': 'https://lichess.org/team/me',
  'team-three': 'https://lichess.org/team/me',
  'follow-one': 'https://lichess.org/@/{u}/following',
  'follow-ten': 'https://lichess.org/@/{u}/following',
  'study-write': 'https://lichess.org/study/mine/updated',
  // Puzzles
  'storm-play': 'https://lichess.org/storm',
  'storm-50': 'https://lichess.org/storm',
  'storm-100': 'https://lichess.org/storm',
  'racer-play': 'https://lichess.org/racer',
  'racer-50': 'https://lichess.org/racer',
  'streak-play': 'https://lichess.org/streak',
  'streak-50': 'https://lichess.org/streak',
  // Ratings (Lichess shows where your rating sits in the distribution)
  'rating-1500': 'https://lichess.org/stat/rating/distribution/blitz',
  'rating-1800': 'https://lichess.org/stat/rating/distribution/blitz',
  'rating-2000': 'https://lichess.org/stat/rating/distribution/blitz',
  'rating-2200': 'https://lichess.org/stat/rating/distribution/blitz',
  'rating-established': 'https://lichess.org/stat/rating/distribution/blitz',
  // Profile & Community
  'profile-flag': 'https://lichess.org/@/{u}',
  'profile-bio': 'https://lichess.org/@/{u}',
  'profile-name': 'https://lichess.org/@/{u}',
  'profile-fide': 'https://lichess.org/@/{u}',
  'account-title': 'https://lichess.org/@/{u}',
  'account-verified': 'https://lichess.org/@/{u}',
  'account-flair': 'https://lichess.org/@/{u}',
  'account-streamer': 'https://lichess.org/@/{u}',
  'support-patron': 'https://lichess.org/patron',
};
for (const a of ALL) { const l = LINKS[a.id]; if (l) a.link = l; }

// SVG line icons (heroicons-style) used by the coloured placeholder tiles.
export const ICONS = {
  star: '<path d="M11.48 3.5a.56.56 0 011.04 0l2.12 5.11a.56.56 0 00.48.35l5.52.44c.5.04.7.66.32.99l-4.2 3.6a.56.56 0 00-.18.56l1.28 5.38a.56.56 0 01-.84.61l-4.72-2.88a.56.56 0 00-.6 0L6.98 20.5a.56.56 0 01-.84-.6l1.29-5.4a.56.56 0 00-.18-.55l-4.2-3.6a.56.56 0 01.32-.99l5.52-.44a.56.56 0 00.47-.35L11.48 3.5z"/>',
  chart: '<path d="M3 13.1c0-.62.5-1.13 1.13-1.13h2.24c.62 0 1.13.5 1.13 1.13v6.75c0 .62-.5 1.12-1.13 1.12H4.13A1.13 1.13 0 013 19.87V13.1zM9.75 8.63c0-.62.5-1.13 1.13-1.13h2.25c.62 0 1.12.5 1.12 1.13v11.24c0 .62-.5 1.13-1.12 1.13h-2.25a1.13 1.13 0 01-1.13-1.13V8.63zM16.5 4.13c0-.62.5-1.13 1.13-1.13h2.25c.62 0 1.12.5 1.12 1.13v15.74c0 .62-.5 1.13-1.12 1.13h-2.25a1.13 1.13 0 01-1.13-1.13V4.13z"/>',
  trophy: '<path d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.38c0-.62-.5-1.12-1.12-1.12h-.88M7.5 18.75v-3.38c0-.62.5-1.12 1.13-1.12h.87m5-.01H9.5m5 0a7.45 7.45 0 01-.98-3.17M9.5 14.25a7.45 7.45 0 00.98-3.17M5.25 4.24c-.98.14-1.95.32-2.92.52A6 6 0 007.73 9.73M5.25 4.24V4.5c0 2.1.97 3.99 2.48 5.23M5.25 4.24V2.72C7.46 2.41 9.71 2.25 12 2.25c2.29 0 4.55.16 6.75.47v1.52M7.73 9.73a6.73 6.73 0 002.75 1.35m8.27-6.84V4.5c0 2.1-.97 3.99-2.48 5.23m2.48-5.49c.98.14 1.95.32 2.92.52a6 6 0 01-5.4 4.97m0 0a6.73 6.73 0 01-2.74 1.35m0 0a6.77 6.77 0 01-3.05 0"/>',
  cap: '<path d="M4.26 10.15a60.4 60.4 0 00-.49 6.35A48.6 48.6 0 0112 20.9a48.6 48.6 0 018.23-4.4 60.5 60.5 0 00-.49-6.35m-15.48 0a50.6 50.6 0 00-2.66-.81A59.9 59.9 0 0112 3.49a59.9 59.9 0 0110.4 5.84c-.9.25-1.78.52-2.66.82m-15.48 0A50.7 50.7 0 0112 13.49a50.7 50.7 0 017.74-3.34M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.68A55.4 55.4 0 0112 8.44"/>',
  verified: '<path d="M9 12.75L11.25 15 15 9.75m-3-7.04a12 12 0 01-8.4 3.29A12 12 0 003 9.75c0 5.59 3.82 10.29 9 11.62 5.18-1.33 9-6.03 9-11.62 0-1.31-.21-2.57-.6-3.75h-.15a12 12 0 01-8.25-3.29z"/>',
  scale: '<path d="M12 3v17.25m0 0c-1.47 0-2.88.27-4.19.75M12 20.25c1.47 0 2.88.27 4.19.75M18.75 4.97A48.4 48.4 0 0012 4.5c-2.29 0-4.55.16-6.75.47m13.5 0c1.01.14 2.01.32 3 .52m-3-.52l2.62 10.73c.12.5-.11 1.03-.59 1.2a6 6 0 01-2.03.35 6 6 0 01-2.03-.35c-.48-.17-.71-.7-.59-1.2L18.75 4.97zm-16.5.52c.99-.2 1.99-.38 3-.52m0 0l2.62 10.73c.12.5-.11 1.03-.59 1.2a6 6 0 01-2.03.35 6 6 0 01-2.03-.35c-.48-.17-.71-.7-.59-1.2L5.25 4.97z"/>',
  fire: '<path d="M15.36 5.21A8.25 8.25 0 0112 21 8.25 8.25 0 016.04 7.05 8.29 8.29 0 009 9.6a8.98 8.98 0 013.36-6.87 8.21 8.21 0 003 2.48z"/><path d="M12 18a3.75 3.75 0 00.5-7.47 5.99 5.99 0 00-1.93 3.55 5.97 5.97 0 01-2.13-1A3.75 3.75 0 0012 18z"/>',
  puzzle: '<path d="M14.25 6.09c0-.36.19-.68.4-.96.22-.29.35-.63.35-1 0-1.04-1-1.88-2.25-1.88s-2.25.84-2.25 1.88c0 .37.13.71.35 1 .21.28.4.6.4.96a.64.64 0 01-.66.64c-1.4-.06-2.79-.16-4.16-.3.19 1.61.3 3.25.32 4.91a.66.66 0 01-.66.66c-.36 0-.68-.19-.96-.4-.29-.22-.63-.35-1-.35-1.04 0-1.88 1-1.88 2.25s.84 2.25 1.88 2.25c.37 0 .71-.13 1-.35.28-.21.6-.4.96-.4.3 0 .55.26.53.57-.11 1.7-.33 3.38-.64 5.06 1.52.19 3.06.31 4.62.35a.64.64 0 00.66-.64c0-.36-.19-.68-.4-.96-.22-.29-.35-.63-.35-1 0-1.04 1-1.88 2.25-1.88s2.25.84 2.25 1.88c0 .37-.13.71-.35 1-.21.28-.4.6-.4.96 0 .33.28.6.61.58a48 48 0 005.43-.63 48 48 0 00-.58-4.72.53.53 0 01.53-.57c.36 0 .68.19.96.4.29.22.63.35 1 .35 1.04 0 1.88-1 1.88-2.25s-.84-2.25-1.88-2.25c-.37 0-.71.13-1 .35-.28.21-.6.4-.96.4a.66.66 0 01-.66-.66c.16-1.78.28-3.57.37-5.36-1.89.34-3.81.57-5.77.69a.58.58 0 01-.61-.58z"/>',
  bolt: '<path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/>',
  clock: '<path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>',
  tv: '<path d="M6 20.25h12m-7.5-3v3m3-3v3m-10.13-3h17.25c.62 0 1.13-.5 1.13-1.13V4.88c0-.62-.5-1.13-1.13-1.13H3.37c-.62 0-1.12.5-1.12 1.13v11.25c0 .62.5 1.12 1.13 1.12z"/>',
  flag: '<path d="M3 3v1.5M3 21v-6m0 0l2.77-.69a9 9 0 016.21.68l.11.05a9 9 0 006.09.71l3.11-.73a48.52 48.52 0 01-.01-10.5l-3.11.73a9 9 0 01-6.08-.71l-.11-.05a9 9 0 00-6.21-.68L3 4.5M3 15V4.5"/>',
  pencil: '<path d="M16.86 4.49l1.69-1.69a1.88 1.88 0 112.65 2.65L10.58 16.07a4.5 4.5 0 01-1.9 1.13L6 18l.8-2.69a4.5 4.5 0 011.13-1.9l8.93-8.92zm0 0L19.5 7.13"/>',
  idcard: '<path d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.13a1.88 1.88 0 11-3.75 0 1.88 1.88 0 013.75 0zm1.29 6.34a6.72 6.72 0 01-3.17.79 6.72 6.72 0 01-3.17-.79 3.38 3.38 0 016.34 0z"/>',
  sparkles: '<path d="M9.81 15.9L9 18.75l-.81-2.85a4.5 4.5 0 00-3.09-3.09L2.25 12l2.85-.81a4.5 4.5 0 003.09-3.09L9 5.25l.81 2.85a4.5 4.5 0 003.09 3.09L15.75 12l-2.85.81a4.5 4.5 0 00-3.09 3.09zM18.26 8.72L18 9.75l-.26-1.03a3.38 3.38 0 00-2.46-2.46L14.25 6l1.03-.26a3.38 3.38 0 002.46-2.46L18 2.25l.26 1.03a3.38 3.38 0 002.46 2.46L21.75 6l-1.03.26a3.38 3.38 0 00-2.46 2.46z"/>',
  bookmark: '<path d="M17.59 3.32c1.1.13 1.91 1.08 1.91 2.19V21L12 17.25 4.5 21V5.51c0-1.11.81-2.06 1.91-2.19a48.5 48.5 0 0111.18 0z"/>',
  import: '<path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>',
  video: '<path d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"/>',
  crown: '<path d="M3.5 8.5l3.75 3.5L12 5l4.75 7 3.75-3.5-1.5 10.5H5L3.5 8.5z"/>',
  hourglass: '<path d="M6 3h12M6 21h12M8 3v3.5a4 4 0 004 4 4 4 0 004-4V3M8 21v-3.5a4 4 0 014-4 4 4 0 014 4V21"/>',
};
