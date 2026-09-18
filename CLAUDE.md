# Lichievements

A single-page website where a user logs in with their Lichess account (OAuth2 PKCE),
their entire game history is streamed and analyzed **in the browser**, and
achievements they've unlocked are revealed as animated tiles in a grid.

The name is always styled as **li**`chievements` — `li` bold, `chievements` thin.

---

## 1. Product summary

- **Logged-out view:** the title, a "Log in with Lichess" button, and the full set of
  locked tiles grouped under category headers (dark `images/locked.png` in grid view,
  dimmed rows in the default list view).
- **After login:** account data is fetched, then games stream in and are analyzed
  incrementally. As each achievement is detected, its tile flips/fades from
  `locked.png` to the achievement's own image. A live progress indicator shows how
  many games have been analyzed.
- **Languages:** English (the source) and German, switchable live; see §7a.
- **Design:** minimal, responsive. Inter (default) + JetBrains Mono (mono accents).

---

## 2. Architecture (decided)

- **Static site, no build step.** Plain HTML + CSS + vanilla JS ES modules. The user
  copies the folder straight to their server. No backend, no bundler, no npm.
- **All analysis is client-side** in a **Web Worker** (`worker.js`) so the UI stays
  responsive while thousands of games are processed.
- **No server secret needed:** Lichess OAuth2 uses the **Authorization Code flow with
  PKCE** (public client). `client_id` is an arbitrary string (use the site's origin);
  `redirect_uri` must equal the deployed URL.
- **No game-result caching during analysis:** every *analysis run* re-streams and
  re-analyzes the full history, so the pipeline's speed comes from streaming + fast
  detection + early-exit (see §5), not from storing intermediate results.
- **Light client-side persistence (added later):** a plain page reload restores the
  previous tiles instantly without re-analysing, and a **Reload** button re-runs the
  full analysis on demand without a fresh Lichess login. The keys:
  - `localStorage` `li_unlocked:{uid}` — the unlocked set, `[{ id, gameId, color, ply }]`.
  - `localStorage` `li_partial:{uid}` — per-member / per-tier progress for the
    aggregate achievements, `id -> { have, need, value, items }` (§6). This is also
    what `hints.html` reads.
  - `localStorage` `li_meta:{uid}` — `{ name, complete, fresh }`: the username as
    spelled (for the logged-out restore), whether the stored result comes from a run
    that reached `done`, and the ids the last re-run added (the "New" badges).
  - `localStorage` `li_user` — the last logged-in user id, so a reload (and
    `hints.html`, which has no session of its own) knows whose cache to read.
  - `sessionStorage` `li_token` — the access token, so **Reload** needs no new login.
  - `localStorage` `theme` (`light`/`dark`), `li_view` (`grid`/`list`) and `lang`
    (`en`/`de`, only once the reader picks one explicitly) — UI preferences, not user
    data; they deliberately survive logout.

  Logout clears the three per-user keys, `li_user` and the token.

  **Two kinds of run** (`startAnalysis()` in `main.js`):
  - *First run* (nothing stored, or the stored run never finished): the grid starts
    empty, results are written as they arrive (coalesced to one write per second,
    flushed at the end, on error and on `pagehide`) with `complete: false` until
    `done`. A page loaded with a session over an incomplete result simply analyses
    again; without a session it says the last analysis did not finish.
  - *Re-run* (Reload over a finished result): the grid stays as it is, new finds are
    revealed and badged "New" as they arrive (ladders only ever climb mid-run), and
    storage keeps the previous result until `done`. Then `reconcile()` settles the grid
    on exactly what the run found: plain tiles it no longer finds lock again (e.g. after
    a detector got stricter), ladders take their final value up or down, and the
    status line reports how many achievements were added. An interrupted re-run
    therefore loses nothing.

  The worker's `done` waits for the extra-scope lookups too, so it really means "this
  run's results are complete" — `reconcile()` depends on that.

### File layout
```
index.html            # markup: header, login button, achievement grid shell
hints.html            # static hints page: the opening collections' full move lists,
                      # annotated with the reader's own progress from localStorage
css/style.css         # design system, grid + list layouts, tile reveal, tier modal
css/fonts.css         # @font-face for Inter + JetBrains Mono
js/main.js            # UI orchestration, OAuth, worker messages, DOM reveal, tier UI
js/oauth.js           # PKCE helpers (code_verifier/challenge, state, token exchange)
js/i18n.js            # language detection, t(), DOM translation, the language menu
js/ui.js              # page chrome shared by both pages: theme toggle, TOC collapse
js/lang/de.js         # German overlay: UI strings, category names, achievement texts
js/worker.js          # game analysis worker: runs detectors over streamed games
js/achievements.js    # achievement registry (metadata) + detector functions
js/chess.js           # vendored chess.js (MIT) — used ONLY for board-required detectors
images/               # tile art (provided; more to come). locked.png = locked tile
fonts/                # Inter-4.1/web/*.woff2, JetBrainsMono-2.304/.../*.woff2
icon.png              # favicon
sw.js                 # service worker: network-first for app code, cache-first for assets
manifest.webmanifest  # PWA manifest
icon-192/512*.png, apple-touch-icon.png   # PWA / iOS home-screen icons
```

`.gitignore` keeps the dev-only reference files out of the repo:
`achievements_OLD.json`, `lichess-api.json` and `openings/`.

The site is also installable as a **PWA**. `sw.js` serves HTML/JS/CSS **network-first**
(so every online launch gets the latest deploy — important for iOS PWAs that can't be
manually refreshed) and fonts/images cache-first. `index.html` auto-reloads once when
an updated worker takes control — but never during a login or an analysis: `main.js`
marks those with `data-busy` on `<html>` and fires `li:idle` when they end, and the
reload waits for it. Bump `APP_VERSION` in `sw.js` to invalidate the cache.

---

## 3. OAuth2 flow (PKCE, no secret)

1. On "Log in": generate random `code_verifier` + `state`, store in `sessionStorage`,
   compute S256 `code_challenge`, redirect to
   `https://lichess.org/oauth?response_type=code&client_id=<origin>&redirect_uri=<url>&code_challenge_method=S256&code_challenge=...&state=...`.
   **Scope:** `study:read follow:read puzzle:read` — needed only for the "created a
   study", "follow someone", and puzzle-dashboard (per-theme / performance)
   achievements. All other endpoints (account, games, teams, tournaments, per-format
   performance stats) work with an empty-scope token; these three read private data.
2. On redirect back with `?code&state`: verify `state`, POST to
   `https://lichess.org/api/token` with `grant_type=authorization_code`, the `code`,
   `redirect_uri`, `client_id`, and the stored `code_verifier` → access token.
3. `GET /api/account` (Bearer token) → `id`/`username`, `patron`, `playTime`,
   `createdAt`, `count.*`, per-perf stats. Token kept in memory only.
4. Games are public, so export needs only the username (token optional but sent).

---

## 4. Data sources

- **`GET /api/account`** — cheap, one call. Powers all *account-scope* achievements
  with no game parsing: total games (`count.all`), games vs computer (`count.ai`),
  per-speed counts, total play time, account age / "birthday", patron status.
- **Extra-scope endpoints** (*extra*-scope achievements) — small supplementary calls
  made once in the worker, concurrently with the game stream but **strictly one at a
  time among themselves**: Lichess caps a client at two concurrent API requests
  (`429 "Please only run 2 request(s) at a time"`) and the stream already holds one
  connection open for the whole run. They are background lookups, so the extra latency
  of running them sequentially is fine. Each is best-effort (a missing scope or 4xx
  yields an empty list so only that achievement stays locked):
  `GET /api/team/of/{u}` (teams joined), `GET /api/user/{u}/tournament/played`
  (arenas: participation, podium, win, cumulative `player.score` points) and
  `.../tournament/created` (hosting), `GET /api/study/by/{u}` (studies — needs
  `study:read`), `GET /api/rel/following` (follows — needs `follow:read`),
  `GET /api/user/{u}/perf/{perf}` (public; one call per *played* format — the six
  time controls **and the eight variants**, since berserks, sessions, loss streaks
  and best wins are not about standard chess — for `stat.highest` peak rating,
  `playStreak` longest sitting, `count.berserk`, `resultStreak`, `bestWins`; the best
  across formats is kept, while `count.tour` and `count.disconnects` are *summed*,
  being per-format totals), `GET /api/puzzle/dashboard/1000` (needs `puzzle:read` —
  per-theme solve counts + puzzle performance) and `GET /api/storm/dashboard/{u}?days=365`
  (public; longest combo, highest puzzle solved, most runs in a day — its per-day rows
  stop at the API's 365-day maximum, so those three are *last year's* best, not
  all-time, and it is only fetched when `perfs.storm.runs > 0`).
  **No blog API exists on Lichess**, so "write a blog post" is not detectable and is
  omitted.
- **`GET /api/games/user/{username}`** with `Accept: application/x-ndjson`,
  `moves=true&opening=true&tags=false&clocks=false&evals=false&pgnInJson=false`,
  `accuracy=true&division=true&sort=dateAsc`. Streams one JSON object per game:
  `id` (Lichess game id), `moves` (space-separated **SAN**), `opening{eco,name,ply}`,
  `players` (incl. each side's `rating`, `ratingDiff`, `user.title`, `aiLevel`),
  `winner`, `speed`, `variant`, `status`, `source`, `clock`, `division`, `arenaTour`/
  `swissTour`, `createdAt`. This is the single heavy request; it is read as a
  `ReadableStream` and fed line-by-line to the worker.
  Player ratings/titles arrive in the JSON by default (no extra param), powering the
  upset / giant-slayer detectors with no additional request. `accuracy=true` adds
  `players.{color}.analysis` — `accuracy`, `acpl`, `inaccuracy`/`mistake`/`blunder`
  and per-phase accuracy — but **only on games Lichess has analysed**, which for most
  accounts is a small subset; a detector must read a missing `analysis` as *unknown*,
  never as a clean sheet. `division=true` is passed explicitly: the OpenAPI spec
  documents it as opt-in, even though the live export returns it either way.
- **Puzzle/other:** fetch from dedicated endpoints where the API allows; anything not
  verifiable from account+games is **omitted** (per decision — no dead placeholders).

---

## 5. Performance strategy (critical — accounts can have 10k+ games)

Speed is a primary requirement. Each analysis pass re-streams the full history (the
persisted unlocked set only skips re-analysis on a plain reload — §2), so the pipeline
must be lean:

1. **Stream, don't buffer.** Process each NDJSON line as it arrives via
   `fetch().body.getReader()`; never hold the whole history in memory.
2. **Worker-based analysis.** Parsing/detection runs in `worker.js`; `main.js` only
   receives "achievement X unlocked" / "N games processed" messages and updates the DOM.
3. **Two-tier detectors (avoid the chess engine when possible):**
   - **SAN-only detectors (fast path):** operate on the raw `moves` string with regex/
     string checks — no board replay. Covers the large majority, e.g.
     mate-with-piece (`/[QRBN]?[a-h1-8x]*[a-h][1-8][+]?#$/` on the winner's last move),
     castling mate (`O-O#` / `O-O-O#`), underpromotion (`=[RBN]`), promotion mate
     (`=Q#`), pacifist (no `x` in whole game + `#`), check-check-mate (`+ + #` on the
     winner's moves), survivor (count `+` given to the user), takes-takes-takes
     (3 consecutive `x` moves), openings (compare first *k* SAN tokens to a target list),
     king's journey (a user `K…` move whose destination is the far rank).
   - **Board-required detectors (slow path):** need real position tracking —
     en passant (plain and mate), two-queens-on-board, and the material balance behind
     comeback / swindle. Handled by replaying the game through vendored **chess.js**.
4. **Only replay when it can still pay off.** A game is sent through chess.js **only if
   at least one board-required achievement is still locked.** Once those unlock, the
   slow path is skipped entirely for all remaining games. `boardPlan()` in `worker.js`
   refines this **per game** through `BOARD_USES`: each board achievement pairs "scan
   or plain replay" with a cheap test of whether *this* game could fire it at all —
   comeback only on a win, swindle only on a stalemate, queen-party only after a `=Q`
   promotion, en passant only when a user pawn capture lands on the 6th (White) / 3rd
   (Black) rank, en-passant mate only when that is the mating move. The replay is
   ~97% of the worker's CPU, and this skips it on roughly half of all games while
   comeback is still climbing, and on nearly all once it tops out. A `needsBoard`
   detector with no `BOARD_USES` entry falls back to a full scan on every game —
   correct but slow, so give new ones an entry.
   (For scale: Lichess throttles the export to 60 games/s for your own games, so on a
   desktop the worker already idles most of the time. This matters for slow phones and
   battery; wall-clock time is set by the throttle.)
5. **Per-achievement short-circuit.** Maintain a live set of still-locked achievement
   ids; each detector runs only until its achievement unlocks, then is dropped.
6. **Global early-exit.** When every achievement is unlocked, abort the stream
   (`reader.cancel()`) — no need to read the rest of the history. Game-scope tiered
   ladders (§6) never "unlock" mid-stream, so the worker retires one explicitly once
   its top step is reached; otherwise a single ladder would hold the stream open —
   and keep the board scan alive — for the entire history.
7. **Batched UI updates.** Reveal tiles and update the progress counter on
   `requestAnimationFrame`, coalescing messages to avoid layout thrash.
8. **Determine "you".** From `players.white/black.user.id` vs the logged-in id, know
   the user's color per game; "your" moves are the even/odd plies accordingly, and a
   mate counts for the user only when `winner` === user's color.
9. **Record provenance.** When a detector fires, it returns not just "unlocked" but
   the **game `id`**, the user's **color**, and (where meaningful) the **ply** of the
   deciding move. This is captured during the same pass — no extra work.

---

## 6. Achievement system

Data-driven registry in `js/achievements.js`. It exports `CATEGORIES` (the ordered
sections, each `{ name, items }`), `ALL` (`CATEGORIES.flatMap(c => c.items)`) and
`ICONS` (inline SVG paths for placeholder tiles). There is **no `category` field** on
an entry — an achievement belongs to the category whose `items` array holds it.

A plain entry:

```js
{
  id: 'queen-mate',
  title: "Queen's Quest",
  details: 'Deliver checkmate with a queen',
  image: 'images/mate-queen.png',  // or, when no art exists: svg: 'crown', color: '#c026d3'
  scope: 'game',               // 'account' | 'extra' | 'game'
  needsBoard: false,           // 'game' detectors set true when they read ctx.board.*
  anyVariant: false,           // true = detector ignores the moves, so run it on every variant
  detect: (ctx, state) => { ... }  // returns falsy | true | { ply }
}
```

Art is either `image` (a PNG in `images/`) or `svg` + `color`, which renders a coloured
placeholder tile from `ICONS`.

**Scopes (as implemented in `js/achievements.js`):**
- `account` — `unlock(account)`, evaluated once from `/api/account`.
- `extra` — `unlock(extra)`, evaluated once from the supplementary endpoints —
  teams / tournaments / studies / following, plus the per-format perf stats
  (`peak`, `peakByPerf`, `sessionGames`, `sessionTime`, `berserk`, `lossStreak`,
  `bestWinRating`) and the puzzle dashboard. See `evaluateExtra()` in the worker.
- `game` — `detect(ctx, state)`, evaluated per streamed game. A `game` detector may
  set `needsBoard: true` to read `ctx.board.*` (en passant, multiple queens, material
  balance); the worker only reconstructs the board when a still-locked achievement
  needs it and could fire on this game (`BOARD_USES`, §5). Openings and opening collections are ordinary
  `game` detectors built from SAN move lines (`prefixMatch`), not a separate scope.
  A `detect` returns falsy (locked), `true` (link points at the last move), or
  `{ ply }` (link jumps to that 0-based ply).
  **Variants:** SAN and board detectors are fed *standard* games only, so a detector
  that reads none of the moves — how the game was created (`source`, `rated`,
  `oppAi`), how it ended (`status`), its clock, tournament or ratings — must set
  `anyVariant: true` or it silently ignores every non-standard game. This matters
  most for games played from a custom position: Lichess models those as variant
  `fromPosition` (board editor, "from position" challenges, and *thematic arenas and
  Swiss events*, which are the only rated ones). Unlocks from non-standard games are
  posted with `ply: null`, because Lichess's `#ply` anchor counts from the game's own
  starting ply.
  **The flag is not automatic, though.** When an achievement is a *feat* rather than a
  fact — beating an engine, surviving something hard — leaving `anyVariant` off is the
  point: a custom position lets the player choose the material, and "beat Stockfish
  level 8" means nothing when the position started with eight queens against a bare
  king. Omitting the flag restricts the detector to `variant === 'standard'`, which is
  exactly "the normal starting position", since Lichess normalises a custom position
  equal to the standard start back to plain standard. Ask which one a new detector is:
  *how the game was set up or ended* wants the flag, *how hard the win was* does not.
  **Fairness floors.** A few detectors skip games that would hand them over for free:
  the rating-swing ladders and Underdog ignore provisional ratings (the export's
  per-player `provisional` flag), the accuracy ladder needs 20 moves and Cold Blood an
  endgame of 10, and Miniature / Quickfire need a win at the board (`mate`, `resign`,
  `outoftime` — not an opponent who abandoned the game).

**Tiered achievements (ladders).** Many tiles are not a single yes/no but a ladder of
thresholds: the tile shows the highest step reached plus progress toward the next, and
**every reached step counts toward the site's unlocked total** (`countOf` in
`main.js`). Four helpers build them:

- `tiered({ id, title, details, scope, measure, steps, link, unit })` — an `account`-
  or `extra`-scope ladder. `measure(source)` returns the current number (e.g.
  `a.count.all`); `steps` is `[{ at, title, details, image | svg + color }]`.
- `gameTiered({ id, title, details, steps, track, needsBoard, anyVariant, link, unit })` —
  a `game`-scope ladder. `track(ctx, state)` returns this game's value (or
  `{ value, ply }` to also deep-link the deciding move) and the tile keeps the running
  **maximum** across the history. These never fire an unlock mid-stream: `detect` only
  accumulates and returns false, and the final value is posted once the stream ends.
  `anyVariant` works exactly as on a plain detector — a ladder over a rating swing or a
  timestamp needs it, or it only ever sees standard games. A ladder whose `track` keeps
  a *running* count across games (win streak, days in a row) may also use `state` for
  its own bookkeeping beyond the `max`/`cur` that `gameTiered` manages.
- `speedTier(id, perfKey, label, image)` — a 1 / 10 / 100 / 1,000 games ladder per time control,
  from the `/api/account` perf counts.
- `ratingTier(perfKey, label)` — a 1000 / 1500 / 1800 / 2000 / 2200 peak-rating ladder
  per format, from the worker's `extra.peakByPerf`.

Every tiered entry carries `tiered: true`, its `steps`, and a `progress()` returning
`{ have, need, value, items }`. Both helpers also take `discrete: true`, for a ladder
whose `at` values *label* a rung (a computer level, a Maia net) instead of counting
toward one: the rungs still climb in order, but the list row drops the
"value / target" tally, which would otherwise claim you are "0 / 1100" of the way to
beating a bot. `link` is a URL template with `{u}` for the username
(e.g. `https://lichess.org/@/{u}/perf/blitz`) — perf keys are case-sensitive, so use
the exact key. In grid view, clicking a tiered tile opens the **tier modal**: a
lightbox that pages through the earned tiers, each image linking to the game that
unlocked that tier.

**The `partial` channel.** Alongside `unlock`, the worker posts
`{ type: 'partial', id, progress }` for anything exposing a `progress()` — tiered
ladders (account/extra immediately, game ladders via `sendPartials()` at stream end)
and the opening collections. `main.js` persists these to `li_partial:{uid}`, so tiers
and half-finished collections restore on a plain reload exactly like unlocks, and
`hints.html` reads the same key to tick off the collection members you already have.

**Unlock provenance & deep links.** Each game-derived achievement stores the first
game that unlocked it: `{ gameId, color, ply }`, with `ply` 0-based. The unlocked tile
links to `https://lichess.org/{gameId}/{color}#{ply + 1}` — Lichess's `#` anchor is
1-based, so `main.js` adds one — opening the game from the winning side, jumped to the
deciding move (omit `/{color}` / `#…` when not applicable). `account`-scope
achievements have no single source game, so their tiles either don't link or follow the
ladder's `link` template.

- **Categories** (rendered as `<h2>` section headers, in this order): Checkmates ·
  Winning Feats · Win Conditions · Board Antics · Openings: White · Openings: Black ·
  Opening Collections · Time Controls · Variants · Game Types · Machines · Milestones ·
  Ratings · Records · Precision · Puzzles · Profile & Community · Dedication ·
  Notable Games · Social · Tournaments. Social and Tournaments are `extra`-scope; Win
  Conditions and Game Types are `anyVariant` `game`-scope, reading only `status` /
  `source` / `rated`. Precision, the two Machines ladders, Underdog and Giant Slayer
  read no moves either, but deliberately stay standard-only — they measure how *hard* a
  win was, and a custom
  position hands the player the material. That is
  **183 tiles**, which expand to **313 countable achievements** once each ladder step is
  counted — the latter is the number in the status bar. (Both come straight from the
  registry: `ALL.length` and `ALL.reduce((n,a) => n + (a.tiered ? a.steps.length : 1), 0)`.)
  Categories whose art doesn't
  exist yet render coloured SVG placeholder tiles (see `ICONS` in `achievements.js`);
  a category header carries a running `n / total` tally and shows a checkmark once
  fully unlocked.
- **History:** the list was seeded from `achievements_OLD.json` (which mapped 1:1 to
  images already in `images/`) and has long since grown past it — more mate patterns,
  streaks, promotion combos, opening lines, per-speed/variant milestones and the
  tiered ladders above.
- **Images:** each achievement references an existing PNG in `images/`. More art is
  coming later; until an image exists, the tile shows a generic unlocked placeholder.
  `images/locked.png` is the universal locked state. `icon.png` is the favicon.
- **Opening detection** is data-only: store the target SAN sequence per opening and
  compare against the game's opening moves (also cross-checkable with `opening.eco`).
- **Themed collections** are aggregate `game` achievements built by `collection()`:
  every member opening must appear on the board across the user's games (colour-agnostic
  prefix match — either side counts). Members are plain SAN lines held inline. The six
  themed ones: **The Union** (one opening per EU member state), **Scary Stuff**,
  **Fierce Fantasy**, **The Zoo** (one per animal), **Hall of Champions** (one per World
  Champion) and **Blissful Beverages**. Two more are hand-rolled rather than built by
  `collection()`, because they match on something other than a move line:
  **Encyclopedia** (all 20 White first moves — the only colour-specific one) and
  **ABCDE** (one opening from each ECO volume, matched on the first letter of
  `opening.eco`, so any opening in a volume counts and transpositions sort themselves
  out). Five more, from `ecoExpert()`, take that to its conclusion: **Expert in ECO-A**
  through **-E**, each wanting all hundred codes of its volume. All five volumes really
  do run `00`–`99` with no gaps (checked against `lichess-org/chess-openings`), so no
  member is unreachable — but these are deliberately enormous, and nobody is expected
  to finish one. Their `progress()` items stay `{ key, done }`: at 5 × 100 members a
  game reference per code would bloat `li_partial` for something nothing displays.
  Every one of the thirteen exposes `progress()`, which is what `hints.html` renders
  from `data-ach` + `data-key`, with no per-collection code — the one exception being
  the ECO grid, which is five achievements in a single table and so annotates one
  column at a time. (`images/openings-brands.png` is the only collection art unused.)

`achievements_OLD.json` is **reference only** and is gitignored — not in the repo. The
live source of truth is `js/achievements.js`. A few old ids (puzzle storm/racer/streak,
TV) are not derivable from the API and stay omitted unless an endpoint turns up.

---

## 7. Design & styling

- **Title:** `<h1><strong>li</strong><span class="thin">chievements</span></h1>`,
  `strong` ~700 weight, `.thin` ~200–300, tight tracking. Inter variable font gives
  the full weight range from one file (`fonts/Inter-4.1/web/InterVariable.woff2`).
- **Fonts:** self-hosted `@font-face` (woff2). Inter = body/UI, JetBrains Mono =
  monospace accents (e.g. move lists in tooltips/details).
- **Two layouts, one DOM.** A `<body>` class switches between the square-tile **grid**
  and a stacked **list** (compact rows: title and details, art hidden). The same tiles
  are reused; only CSS differs. **List view is the default** — an inline pre-paint
  script in `index.html` sets the class, and only an explicit `grid` in `li_view` opts
  out. Toggling re-anchors whichever category section was at the top of the viewport,
  since the two layouts scroll differently.
- **Grid:** responsive `grid-template-columns: repeat(auto-fill, minmax(128px, 1fr))`;
  square tiles via `aspect-ratio: 1`. Locked = `locked.png`; unlock = flip/fade
  reveal (respect `prefers-reduced-motion`). Tile shows title + details on
  hover/focus/tap — on touch there is no hover, so the first tap only reveals the
  caption and a second tap follows the link. Unlocked game-derived tiles are clickable
  `<a>` links opening the source game on Lichess (§6); a small cue (e.g. ↗) signals it.
- **Table of contents.** Tapping any category heading collapses *every* section (body
  class `toc-mode`, which also hides the header, footer and button row) so the headings
  stack into a compact index; tapping again restores the tiles and scrolls that heading
  to the top. The same code (`initToc` in `js/ui.js`) drives the hints page.
- **Filter bar** (in the header, under the status bar): All / Unlocked / Locked plus a
  search over title, description, ladder steps and category in the current language,
  ignoring case and accents. "Locked" means *something left to earn*, so a half-climbed
  ladder shows under both. Filtered tiles and emptied sections get `hidden` (forced
  with `!important`, since the list view sets `display` on tiles). The pressed
  button's highlight is one `.filter-thumb` that slides to the chosen button,
  animating position and width; a `ResizeObserver` re-places it without animation
  when the buttons change size (web font, language switch).
- **Status line:** progress while running, with an estimated time left from the
  measured rate; after a re-run, how many achievements it added. Tiles the last re-run
  added carry a "New" pill (`.is-new`, label from `--new-label`, set per language).
- **Accessibility:** every tile is focusable (a locked one is a link without `href`),
  Enter/Space opens a link-less tiered tile's tier modal; while the modal is open the
  page behind is `inert` and Tab cycles inside it. The grid is *not* a live region —
  a visually hidden `#live` paragraph announces only the start and result of a run,
  and the error box is `role="alert"`.
- **Button row.** A sticky, bottom-centred row of five round icon buttons: grid/list
  toggle, light/dark toggle, language menu, a link to `hints.html` and a link to the
  GitHub repo (`hints.html` has back, theme, language and GitHub). It
  settles above the footer once the page is scrolled all the way down; its solid
  background matches `--bg`, so it is seamless at rest.
- **Minimal palette**, generous whitespace, accessible focus states, works from phone
  to wide desktop.
- **Light & dark themes** via CSS custom properties. Dark (default) uses the warm
  board-tone accent; light uses a white background with a `#0891b2` cyan accent. The
  theme toggle persists the choice in `localStorage` (`theme`); an inline pre-paint
  script — in `index.html` *and* `hints.html` — reads the saved value /
  `prefers-color-scheme` to avoid a flash of the wrong theme.
- **Safe areas (iPhone).** The sticky button row pads `14px` top and bottom, but under
  `@media (max-width: 439.98px)` the bottom becomes
  `calc(26px + env(safe-area-inset-bottom))` — the only safe-area rule in the site.
  The extra room is deliberate: on a phone the row is pinned to the very bottom edge
  of the screen, over the home indicator, and 14px leaves the icons looking glued to
  it. Treat the inset as a bonus, not as the gap — see below.
  **Do not add `viewport-fit=cover`.** It is what makes `env(...)` report real
  insets, but it also lets the page paint into the status-bar strip, and with
  `apple-mobile-web-app-status-bar-style: black-translucent` the grid then scrolls
  visibly behind the status bar and the header sits under it. Both were tried
  (2026-08-21) and reverted; without cover every inset reads 0 and iOS insets the
  web view itself, which is the behaviour we want.

### 7a. Translations

- **English is the source** and lives where it always did: achievement texts in
  `achievements.js`, static text in the HTML, and the few strings built at runtime in
  the `EN` table of `js/i18n.js`. Each other language is one module in `js/lang/`
  exporting `ui`, `categories` (keyed by the English category name) and
  `achievements` (`id -> { t, d, steps: [[title, details], …] }`). **Whatever a
  language leaves out falls back to English**, so nothing breaks when it lags behind.
- **When adding or renaming an achievement, add its German entry to `js/lang/de.js`**
  (or it simply shows in English). A ladder's `steps` must match the registry's in
  number and order. German titles *describe* the achievement; they do not try to
  translate the English wordplay.
- **Kept in English on purpose:** SAN move lists, opening names on the hints page and
  variant names — exactly as Lichess prints them. The individual opening *tiles* do
  use the German opening names (Spanische Partie, Damengambit …).
- **Markup hooks:** `data-i18n` (text), `data-i18n-html` (prose with links),
  `data-i18n-title`, `data-i18n-aria`, `data-i18n-ach` (an achievement's title). Put
  them on an element whose content is *only* the translated text — a hooked `<h2>`
  would wipe the progress badge appended to it, hence the inner `<span>`s on the hints
  page. The English original is remembered on first swap, so switching back needs no
  reload.
- **Also:** `data-i18n-placeholder` for input placeholders.
- **Detection:** saved `lang`, else the first supported entry of `navigator.languages`,
  else English. An inline pre-paint script (both pages) adds `i18n-pending` when the
  page may not be English, hiding hooked text until `translateDom()` has run.
- **Live switch.** The menu is a native `<select>` laid invisibly over a round button,
  so the platform's own picker opens and more languages need no new UI. On the main
  page `relabel()` in `main.js` re-renders every JS-built text (tiles, ladders, status
  line, open tier modal) without touching the counters or a running analysis.
- **Stable anchors:** section ids are slugs of the *English* category names, so
  `#checkmates` links work in every language.
- The worker has no DOM: it reports a known error by i18n key (`err.key`) and
  `main.js` translates it.
- **Adding a language:** an entry in `LANGS` (native name) plus `js/lang/<code>.js`,
  and that file in `sw.js`'s `SHELL`.

---

## 8. Build / run / deploy

- No build. Open `index.html` via any static server (OAuth redirect must match the
  served origin). Local dev: `python3 -m http.server` then register the localhost
  redirect, or test against the deployed URL.
- Deploy = copy the whole folder to the server. Ensure NDJSON requests are same-site
  or CORS-permitted by Lichess (they are, for `lichess.org`).

### Version control & deploy cadence

- **Commit each logical change separately** — one focused commit per fix/feature,
  with its own message, rather than bundling unrelated changes together.
- **Push very seldom.** `origin/main` is the GitHub Pages source, so every push
  triggers a live redeploy. Accumulate several vetted commits locally and push in a
  batch only when you deliberately intend to publish — don't push per commit.
- **Claude may push, and should.** Pushing to `origin/main` is authorised without
  asking each time: once a piece of work is finished, verified and committed, push
  it — still as a batch at the end of the task, never per commit.

---

## 9. Implementation order (historical — all shipped)

1. `index.html` + CSS design system + fonts + logged-out grid from the registry.
2. `js/achievements.js` — port old list, define categories, tag scopes.
3. OAuth PKCE (`js/oauth.js`) + login/redirect handling in `main.js`.
4. Account-scope detectors (instant tiles from `/api/account`).
5. Streaming pipeline + worker + SAN detectors (fast path) + progressive reveal.
6. Vendor chess.js; add board-required detectors behind the "still-locked" gate.
7. Expand the registry; polish animations, responsiveness, a11y.
8. Extra-scope endpoints, tiered ladders + the `partial` channel, list view and the
   table of contents, the `hints.html` companion page, PWA + service worker.

---

## 10. Open items / notes

- **Deployed origin:** `https://lichievements.github.io/` (GitHub Pages, from
  `origin/main`). Nothing is hard-coded — `oauth.js` derives both `redirect_uri` and
  `client_id` from `location.origin + location.pathname`, so any origin that is
  registered as a redirect works, including a local `http.server`.
- New achievement art will be added to `images/` over time; keep ids stable so tiles
  bind automatically. `images/` still holds a large set of unused opening art (the
  animal openings, `openings-brands.png`) waiting for matching achievements.
- Some ambitious achievements (e.g. further exotic opening collections) are pure data
  tables over opening detection — cheap to add via `collection()`.
