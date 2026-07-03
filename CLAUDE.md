# Lichievements

A single-page website where a user logs in with their Lichess account (OAuth2 PKCE),
their entire game history is streamed and analyzed **in the browser**, and
achievements they've unlocked are revealed as animated tiles in a grid.

The name is always styled as **li**`chievements` — `li` bold, `chievements` thin.

---

## 1. Product summary

- **Logged-out view:** the title, a "Log in with Lichess" button, and a grid of
  dark locked tiles (`images/locked.png`), grouped under category headers.
- **After login:** account data is fetched, then games stream in and are analyzed
  incrementally. As each achievement is detected, its tile flips/fades from
  `locked.png` to the achievement's own image. A live progress indicator shows how
  many games have been analyzed.
- **Language:** English throughout.
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
- **Light client-side persistence (added later):** the *unlocked set* is cached in
  `localStorage` per user (`li_unlocked:{uid}`) and the access token in
  `sessionStorage` (`li_token`), so a page reload restores the previous tiles
  instantly without re-analysing, and a **Reload** button re-runs the full analysis
  on demand without a fresh Lichess login. Logout clears both.

### File layout
```
index.html            # markup: header, login button, achievement grid shell
css/style.css         # design system, responsive grid, tile flip animation
css/fonts.css         # @font-face for Inter + JetBrains Mono
js/main.js            # UI orchestration, OAuth, streaming fetch, DOM reveal
js/oauth.js           # PKCE helpers (code_verifier/challenge, state, token exchange)
js/worker.js          # game analysis worker: runs detectors over streamed games
js/achievements.js    # achievement registry (metadata) + detector functions
js/chess.js           # vendored chess.js (MIT) — used ONLY for board-required detectors
data/                 # (optional) generated opening tables if externalized
images/               # tile art (provided; more to come). locked.png = locked tile
fonts/                # Inter-4.1/web/*.woff2, JetBrainsMono-2.304/.../*.woff2
icon.png              # favicon
sw.js                 # service worker: network-first for app code, cache-first for assets
manifest.webmanifest  # PWA manifest
icon-192/512*.png, apple-touch-icon.png   # PWA / iOS home-screen icons
```

The site is also installable as a **PWA**. `sw.js` serves HTML/JS/CSS **network-first**
(so every online launch gets the latest deploy — important for iOS PWAs that can't be
manually refreshed) and fonts/images cache-first. `index.html` auto-reloads once when
an updated worker takes control. Bump `APP_VERSION` in `sw.js` to invalidate the cache.

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
  made once in the worker, in parallel with the game stream; each is best-effort (a
  missing scope or 4xx yields an empty list so only that achievement stays locked):
  `GET /api/team/of/{u}` (teams joined), `GET /api/user/{u}/tournament/played`
  (arenas: participation, podium, win, cumulative `player.score` points) and
  `.../tournament/created` (hosting), `GET /api/study/by/{u}` (studies — needs
  `study:read`), `GET /api/rel/following` (follows — needs `follow:read`),
  `GET /api/user/{u}/perf/{perf}` (public; one call per *played* time control —
  `stat.highest` peak rating, `playStreak` longest sitting, `count.berserk`; the best
  across formats is kept) and `GET /api/puzzle/dashboard/1000` (needs `puzzle:read` —
  per-theme solve counts + puzzle performance). **No blog API exists on Lichess**, so
  "write a blog post" is not detectable and is omitted.
- **`GET /api/games/user/{username}`** with `Accept: application/x-ndjson`,
  `moves=true&opening=true&tags=false&clocks=false&evals=false&pgnInJson=false`,
  `sort=dateAsc`. Streams one JSON object per game, each with:
  `id` (Lichess game id), `moves` (space-separated **SAN**), `opening{eco,name,ply}`,
  `players` (incl. each side's `rating`, `ratingDiff`, `user.title`, `aiLevel`),
  `winner`, `speed`, `variant`, `status`, `createdAt`. This is the single heavy
  request; it is read as a `ReadableStream` and fed line-by-line to the worker.
  Player ratings/titles arrive in the JSON by default (no extra param), powering the
  upset / giant-slayer detectors with no additional request.
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
     (3 consecutive `x` moves), openings (compare first *k* SAN tokens to a target list).
   - **Board-required detectors (slow path):** need real position tracking —
     en-passant mate, king's-journey (king reaches opposite side), two-queens-on-board.
     Handled by replaying the game through vendored **chess.js**.
4. **Only replay when it can still pay off.** A game is sent through chess.js **only if
   at least one board-required achievement is still locked.** Once those unlock, the
   slow path is skipped entirely for all remaining games.
5. **Per-achievement short-circuit.** Maintain a live set of still-locked achievement
   ids; each detector runs only until its achievement unlocks, then is dropped.
6. **Global early-exit.** When every achievement is unlocked, abort the stream
   (`reader.cancel()`) — no need to read the rest of the history.
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

Data-driven registry in `js/achievements.js`. Each entry:

```js
{
  id: 'queen-mate',
  category: 'Checkmates',
  title: "Queen's Quest",
  details: 'Deliver checkmate with a queen',
  image: 'images/mate-queen.png',
  scope: 'game',               // 'account' | 'extra' | 'game'
  needsBoard: false,           // 'game' detectors set true when they read ctx.board.*
  detect: (ctx, state) => { ... }  // returns falsy | true | { ply }
}
```

**Scopes (as implemented in `js/achievements.js`):**
- `account` — `unlock(account)`, evaluated once from `/api/account`.
- `extra` — `unlock(extra)`, evaluated once from the supplementary endpoints
  (teams / tournaments / studies / following) — see the worker.
- `game` — `detect(ctx, state)`, evaluated per streamed game. A `game` detector may
  set `needsBoard: true` to read `ctx.board.*` (en-passant mate, king's journey,
  multiple queens); the worker only reconstructs the board when at least one
  still-locked achievement needs it. Openings and opening collections are ordinary
  `game` detectors built from SAN move lines (`prefixMatch`), not a separate scope.
  A `detect` returns falsy (locked), `true` (link points at the last move), or
  `{ ply }` (link jumps to that 0-based ply).

**Unlock provenance & deep links.** Each game-derived achievement stores the first
game that unlocked it: `{ gameId, color, ply }`. The unlocked tile is rendered as a
link to `https://lichess.org/{gameId}/{color}#{ply}` — opening the game on Lichess
from the winning side, jumped to the deciding move (omit `/{color}` / `#{ply}` when
not applicable). `account`-scope achievements have no single source game, so their
tiles are non-linking (or link to the user's profile).

- **Categories** (rendered as `<h2>` section headers). The live set (~170
  achievements total) is: Checkmates · Winning Feats · Board Antics · Openings: White ·
  Openings: Black · Opening Collections · Time Controls · Variants · Milestones ·
  Ratings · Records · Puzzles · Profile & Community · Dedication · Notable Games ·
  Social · Tournaments. (Social and Tournaments are `extra`-scope.) Categories whose
  art doesn't exist yet render coloured SVG placeholder tiles (see `ICONS` in
  `achievements.js`); a category header shows a checkmark once fully unlocked.
- **Seed content:** port `achievements_OLD.json` (it maps 1:1 to images already in
  `images/`), then expand toward the ~100 target using additional detectable ideas
  (more mate patterns, streaks, promotion combos, opening lines, per-speed/variant
  milestones, game-count tiers `play-1/10/100/1000/10000/100000`).
- **Images:** each achievement references an existing PNG in `images/`. More art is
  coming later; until an image exists, the tile shows a generic unlocked placeholder.
  `images/locked.png` is the universal locked state. `icon.png` is the favicon.
- **Opening detection** is data-only: store the target SAN sequence per opening and
  compare against the game's opening moves (also cross-checkable with `opening.eco`).
- **Themed collections** are aggregate achievements: every member opening must appear
  on the board across the user's games (colour-agnostic prefix match — either side
  counts). Members are plain SAN lines held inline in the collection. The five
  canonical collections: Encyclopedia (all 20 White first moves), The Union (one
  opening per EU member state), Scary Stuff, Fierce Fantasy, Blissful Beverages.
  (The `openings-brands`/`openings-champions`/`openings-zoo` images are unused.)

`achievements_OLD.json` is **reference only**; the live source of truth is
`js/achievements.js`. Note: a few old ids (puzzle storm/racer/streak, TV, studies)
are not derivable from games and will be omitted unless a fetchable endpoint exists.

---

## 7. Design & styling

- **Title:** `<h1><strong>li</strong><span class="thin">chievements</span></h1>`,
  `strong` ~700 weight, `.thin` ~200–300, tight tracking. Inter variable font gives
  the full weight range from one file (`fonts/Inter-4.1/web/InterVariable.woff2`).
- **Fonts:** self-hosted `@font-face` (woff2). Inter = body/UI, JetBrains Mono =
  monospace accents (e.g. move lists in tooltips/details).
- **Grid:** responsive `grid-template-columns: repeat(auto-fill, minmax(…, 1fr))`;
  square tiles via `aspect-ratio: 1`. Locked = `locked.png`; unlock = flip/fade
  reveal (respect `prefers-reduced-motion`). Tile shows title + details on
  hover/focus/tap. Unlocked game-derived tiles are clickable `<a>` links opening the
  source game on Lichess (§6); a small cue (e.g. ↗) signals the link.
- **Minimal palette**, generous whitespace, accessible focus states, works from phone
  to wide desktop.
- **Light & dark themes** via CSS custom properties. Dark (default) uses the warm
  board-tone accent; light uses a white background with a `#0891b2` cyan accent. A
  round toggle (top-right) flips themes and persists the choice in `localStorage`;
  an inline pre-paint script reads the saved value / `prefers-color-scheme` to avoid a
  flash of the wrong theme.

---

## 8. Build / run / deploy

- No build. Open `index.html` via any static server (OAuth redirect must match the
  served origin). Local dev: `python3 -m http.server` then register the localhost
  redirect, or test against the deployed URL.
- Deploy = copy the whole folder to the server. Ensure NDJSON requests are same-site
  or CORS-permitted by Lichess (they are, for `lichess.org`).

---

## 9. Implementation order

1. `index.html` + CSS design system + fonts + logged-out grid from the registry.
2. `js/achievements.js` — port old list, define categories, tag scopes.
3. OAuth PKCE (`js/oauth.js`) + login/redirect handling in `main.js`.
4. Account-scope detectors (instant tiles from `/api/account`).
5. Streaming pipeline + worker + SAN detectors (fast path) + progressive reveal.
6. Vendor chess.js; add board-required detectors behind the "still-locked" gate.
7. Expand toward ~100 achievements; polish animations, responsiveness, a11y.

---

## 10. Open items / notes

- Confirm the exact `redirect_uri` / deployed origin to hard-code (or derive from
  `window.location`).
- New achievement art will be added to `images/` over time; keep ids stable so tiles
  bind automatically.
- Some ambitious achievements (e.g. exotic opening collections like "one opening per
  EU state") are pure data tables over opening detection — cheap to add later.
