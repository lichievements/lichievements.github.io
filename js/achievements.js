// ============================================================================
// Lichievements — achievement registry (single source of truth)
//
// Imported by BOTH main.js (metadata + rendering) and worker.js (detection).
//
// Each achievement has a `scope`:
//   'account'  -> unlock(account)            evaluated once from /api/account
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
  };
}

// Speed / variant helpers over /api/account perfs.
const perfPlayed = (account, key) => (account.perfs?.[key]?.games || 0) > 0;

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
      { id: 'kings-journey', title: "King's Journey", details: 'Win after your king reached the far side of the board', image: 'images/kings-journey.png', scope: 'game', needsBoard: true, detect: (c) => c.won && c.board.kingCrossed },
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
      { id: 'openings-allwhite', title: 'Encyclopedia', details: 'Play all twenty possible first moves as White', image: 'images/openings-all20.png', scope: 'game', init: () => ({ moves: new Set() }), detect: (c, s) => {
        if (c.color === W && c.san.length) s.moves.add(bare(c.san[0]));
        return s.moves.size >= 20;
      } },
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
      ]),
      collection('openings-fantasy', 'Fierce Fantasy', 'Play fantasy-themed openings', 'openings-fantasy', [
        'e4 f6 d4 b6 c4 Bb7',                                 // Owen: Unicorn Variation
        'e4 e5 Nf3 Nc6 c4 Nf6 Nxe5',                          // Dresden: The Goblin
        'd4 Nf6 c4 g5',                                       // Indian: Medusa Gambit
        'e4 c6 d4 d5 Nf3 dxe4 Ng5',                           // Caro-Kann: Ulysses Gambit
        'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Ng5 h6 Nxf7',         // Caro-Kann: Alien Gambit
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
      { id: 'support-patron', title: 'Patron', details: 'Become a Lichess Patron', image: 'images/patron.png', scope: 'account', unlock: (a) => !!a.patron },
      { id: 'account-age', title: 'Happy Birthday!', details: 'Have a Lichess account at least one year old', image: 'images/birthday.png', scope: 'account', unlock: (a) => a.createdAt && Date.now() - a.createdAt >= 365 * 864e5 },
      { id: 'playtime', title: 'Time Well Spent', details: 'Spend at least one hour playing chess', image: 'images/playtime.png', scope: 'account', unlock: (a) => (a.playTime?.total || 0) >= 3600 },
    ],
  },
];

// Flat list, for the worker.
export const ALL = CATEGORIES.flatMap((c) => c.items);
