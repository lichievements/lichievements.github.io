// ============================================================================
// Lichievements — UI orchestration
// ============================================================================

import { CATEGORIES, ALL, ICONS } from './achievements.js';
import { login, completeLoginIfRedirected, fetchAccount, revoke } from './oauth.js';
import { t, fmtNum, catName, achText, stepText, translateDom, initLangSelect } from './i18n.js';
import { initThemeToggle, initToc } from './ui.js';

const $ = (sel) => document.querySelector(sel);

// A URL-fragment-friendly id from a category name, e.g. "Openings: White" ->
// "openings-white". Used so a section can be linked/jumped to via a #hash.
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const el = {
  loginBtn: $('#login-btn'),
  logoutBtn: $('#logout-btn'),
  statusbar: $('#statusbar'),
  statusUser: $('#status-user'),
  statusSummary: $('#status-summary'),
  statusUnlocked: $('#status-unlocked'),
  statusTotal: $('#status-total'),
  progress: $('#progress'),
  progressBar: $('#progress-bar'),
  gridRoot: $('#grid-root'),
  error: $('#error'),
  themeToggle: $('#theme-toggle'),
  viewToggle: $('#view-toggle'),
  reloadBtn: $('#reload-btn'),
  langSelect: $('#lang-select'),
  live: $('#live'),
  filterSearch: $('#filter-search'),
  filterEmpty: $('#filter-empty'),
};

// Screen-reader announcements go through one quiet live region. Clearing it
// first makes a repeated message count as new.
function announce(msg) {
  el.live.textContent = '';
  setTimeout(() => { el.live.textContent = msg; }, 50);
}

// --- Touch interaction -----------------------------------------------------
// On touch devices there's no hover, so a tile's caption is shown by tapping it.
// The first tap on a tile only reveals its caption; a link (if any) fires only on
// a second tap while it's revealed. Tapping anywhere else dismisses the caption.

function clearRevealed() {
  document.querySelectorAll('.tile.revealed').forEach((t) => t.classList.remove('revealed'));
}

function initTileInteraction() {
  const touch = matchMedia('(hover: none)');

  // Grid view: tapping a tiered tile that deep-links its tiers opens the tier
  // modal instead of following the tile's own link / revealing the caption.
  // Registered first so stopImmediatePropagation pre-empts the handlers below.
  el.gridRoot.addEventListener('click', (e) => {
    if (document.body.classList.contains('list-view')) return;
    const tile = e.target.closest('.tile[data-tiered].has-tiers');
    if (!tile) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openTierModal(tile.dataset.id);
  });

  // A cleared tier row can deep-link to the game that unlocked it. The tile is
  // itself an <a>, so we can't nest a real link inside; instead the row carries a
  // data-href and this handler opens it, overriding the tile's own navigation.
  el.gridRoot.addEventListener('click', (e) => {
    const row = e.target.closest('.tier-steps-list li.has-game');
    if (!row || !row.dataset.href) return;
    e.preventDefault();  // cancel the enclosing tile <a> navigation
    e.stopPropagation();
    window.open(row.dataset.href, '_blank', 'noopener');
  });

  // List view: a tiered achievement is not clickable as a whole — only its cleared
  // tier rows (handled just above) deep-link out. Cancel the tile's own navigation
  // for any click that isn't on such a row. (Grid view already preempts with the
  // tier modal above, so this only affects list view.)
  el.gridRoot.addEventListener('click', (e) => {
    if (!document.body.classList.contains('list-view')) return;
    const tile = e.target.closest('.tile[data-tiered]');
    if (!tile) return;
    if (e.target.closest('.tier-steps-list li.has-game')) return; // its own handler navigates
    e.preventDefault();
  });

  el.gridRoot.addEventListener('click', (e) => {
    if (!touch.matches) return; // pointer devices keep hover + single-click
    // In list view the caption is always visible, so there's nothing to reveal:
    // a tap should follow the link directly (no two-tap dance).
    if (document.body.classList.contains('list-view')) return;
    const tile = e.target.closest('.tile');
    if (!tile) return;
    if (!tile.classList.contains('revealed')) {
      e.preventDefault(); // first tap: reveal caption only, don't follow the link
      clearRevealed();
      tile.classList.add('revealed');
    }
    // already revealed: let the default action run (navigate if it has an href)
  });

  // Keyboard: a tiered tile without a link of its own fires no click on Enter,
  // so open its tier modal here (grid view; a linked tile gets its click).
  el.gridRoot.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (document.body.classList.contains('list-view')) return;
    const tile = e.target.closest('.tile[data-tiered].has-tiers');
    if (!tile || (e.key === 'Enter' && tile.hasAttribute('href'))) return;
    e.preventDefault(); // Space would otherwise scroll the page
    openTierModal(tile.dataset.id);
  });

  // A tap outside any revealed tile hides the caption again.
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tile.revealed')) clearRevealed();
  });

  // Scrolling the page also dismisses any revealed caption on touch devices.
  window.addEventListener('scroll', () => {
    if (document.querySelector('.tile.revealed')) clearRevealed();
  }, { passive: true });
}

// --- Tier modal (grid view) ------------------------------------------------
// A lightbox for browsing a tiered achievement's earned tiers: the tier image
// flanked by prev/next arrows, its text below; the image links to the game that
// unlocked that tier. Built once and reused for every tile.

let tmEls = null;             // cached modal elements
let tmDef = null;             // the tiered achievement being browsed
let tmTiers = [];             // [{ step, game }] for the cleared tiers
let tmIdx = 0;                // current tier index
let tmReturn = null;          // element to refocus on close

function initTierModal() {
  const modal = document.createElement('div');
  modal.className = 'tier-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Achievement tier');
  modal.dataset.i18nAria = 'modal.label';
  modal.innerHTML =
    '<div class="tier-modal-body" tabindex="-1">'
    + '<button class="tier-modal-close" type="button" aria-label="Close" data-i18n-aria="modal.close">✕</button>'
    + '<div class="tier-modal-stage">'
    + '<button class="tier-modal-nav tier-modal-prev" type="button" aria-label="Previous tier" data-i18n-aria="modal.prev">‹</button>'
    + '<a class="tier-modal-art" target="_blank" rel="noopener"><span class="ext" aria-hidden="true">↗</span></a>'
    + '<button class="tier-modal-nav tier-modal-next" type="button" aria-label="Next tier" data-i18n-aria="modal.next">›</button>'
    + '</div>'
    + '<p class="tier-modal-label"></p>'
    + '<h3 class="tier-modal-title"></h3>'
    + '<p class="tier-modal-desc"></p>'
    + '</div>';
  document.body.append(modal);
  tmEls = {
    modal,
    body: modal.querySelector('.tier-modal-body'),
    art: modal.querySelector('.tier-modal-art'),
    prev: modal.querySelector('.tier-modal-prev'),
    next: modal.querySelector('.tier-modal-next'),
    label: modal.querySelector('.tier-modal-label'),
    title: modal.querySelector('.tier-modal-title'),
    desc: modal.querySelector('.tier-modal-desc'),
    close: modal.querySelector('.tier-modal-close'),
  };
  tmEls.prev.addEventListener('click', () => stepTierModal(-1));
  tmEls.next.addEventListener('click', () => stepTierModal(1));
  tmEls.close.addEventListener('click', closeTierModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeTierModal(); }); // backdrop
  // Horizontal scroll (trackpad swipe / shift+wheel) pages between tiers; vertical
  // scroll is swallowed so the page stays put. One step per gesture (cooldown).
  modal.addEventListener('wheel', onTierModalWheel, { passive: false });
  // Touch swipe left/right pages between tiers.
  modal.addEventListener('touchstart', onTierModalTouchStart, { passive: true });
  modal.addEventListener('touchend', onTierModalTouchEnd, { passive: true });
}

let tmWheelLock = 0;          // timestamp before which further wheel steps are ignored
function onTierModalWheel(e) {
  e.preventDefault();         // the modal owns scrolling; the page must not move
  const dx = e.deltaX;
  const dy = e.deltaY;
  // Sideways trackpad swipe, or shift+wheel, expresses horizontal intent.
  const h = Math.abs(dx) >= Math.abs(dy) ? dx : (e.shiftKey ? dy : 0);
  if (Math.abs(h) < 8) return;
  const now = Date.now();
  if (now < tmWheelLock) return;
  tmWheelLock = now + 320;    // snap: at most one tier per gesture
  stepTierModal(h > 0 ? 1 : -1);
}

let tmTouchX = null;
let tmTouchY = null;
function onTierModalTouchStart(e) {
  if (e.touches.length !== 1) { tmTouchX = tmTouchY = null; return; }
  tmTouchX = e.touches[0].clientX;
  tmTouchY = e.touches[0].clientY;
}
function onTierModalTouchEnd(e) {
  if (tmTouchX == null) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - tmTouchX;
  const dy = t.clientY - tmTouchY;
  tmTouchX = tmTouchY = null;
  // A decisive horizontal swipe pages; swipe left → next tier, right → previous.
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) stepTierModal(dx < 0 ? 1 : -1);
}

function openTierModal(id) {
  if (!tmEls) return;
  const def = defById.get(id);
  const prog = partialRecords[id];
  if (!def || !def.tiered || !prog || !prog.items) return;
  // Every cleared tier is browsable; a game-scope tier also carries a deep link.
  const tiers = [];
  for (let i = 0; i < def.steps.length; i++) {
    const it = prog.items[i];
    if (it && it.done) tiers.push({ step: def.steps[i], index: i, game: it });
  }
  if (!tiers.length) return;
  tmDef = def;
  tmTiers = tiers;
  tmIdx = tiers.length - 1; // start on the highest tier reached (what the tile shows)
  tmReturn = document.activeElement;
  renderTierModal();
  tmEls.modal.hidden = false;
  document.body.classList.add('modal-open'); // lock page scroll behind the modal
  document.querySelector('.wrap').inert = true; // the page behind is out of reach
  document.addEventListener('keydown', onTierModalKey);
  tmEls.body.focus();
}

// Where a tier's image should link: the game that unlocked it (game ladders), else
// the achievement's own page (account/extra ladders), else nowhere.
function tierModalHref(game) {
  if (game.gameId) {
    let href = `https://lichess.org/${game.gameId}`;
    if (game.color) href += `/${game.color}`;
    if (Number.isInteger(game.ply)) href += `#${game.ply + 1}`;
    return href;
  }
  const link = tmDef && tmDef.link;
  if (link && (!link.includes('{u}') || currentUserId)) {
    return link.replace('{u}', encodeURIComponent(currentUserId || ''));
  }
  return null;
}

function renderTierModal() {
  const { step, index, game } = tmTiers[tmIdx];
  const text = stepText(tmDef, index);
  const { art, prev, next, label, title, desc } = tmEls;
  // Art: image or coloured SVG icon, matching the tile. Keep the ↗ cue in place.
  art.querySelectorAll('img, svg').forEach((n) => n.remove());
  if (step.image) {
    art.style.removeProperty('--tile-color');
    const img = new Image();
    img.src = step.image; img.alt = text.title;
    art.prepend(img);
  } else {
    art.style.setProperty('--tile-color', step.color || '#555');
    art.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[step.svg] || ''}</svg>`);
  }
  const href = tierModalHref(game);
  if (href) { art.href = href; art.classList.remove('no-link'); }
  else { art.removeAttribute('href'); art.classList.add('no-link'); }
  label.textContent = `${achText(tmDef).title} · ${tmIdx + 1} / ${tmTiers.length}`;
  title.textContent = text.title;
  desc.textContent = text.details || '';
  prev.disabled = tmIdx === 0;
  next.disabled = tmIdx === tmTiers.length - 1;
}

function stepTierModal(delta) {
  const n = tmIdx + delta;
  if (n < 0 || n >= tmTiers.length) return;
  tmIdx = n;
  renderTierModal();
  // Restart the directional fade/slide animation on the swapped-in content.
  const body = tmEls.body;
  body.classList.remove('slide-next', 'slide-prev');
  void body.offsetWidth; // reflow so the animation replays
  body.classList.add(delta < 0 ? 'slide-prev' : 'slide-next');
}

function closeTierModal() {
  if (!tmEls || tmEls.modal.hidden) return;
  tmEls.modal.hidden = true;
  document.body.classList.remove('modal-open');
  document.querySelector('.wrap').inert = false;
  tmEls.body.classList.remove('slide-next', 'slide-prev');
  document.removeEventListener('keydown', onTierModalKey);
  if (tmReturn && tmReturn.focus) tmReturn.focus();
  tmReturn = null;
}

function onTierModalKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); closeTierModal(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); stepTierModal(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); stepTierModal(1); }
  else if (e.key === 'Tab') trapTab(e);
}

// Keep Tab cycling through the modal's own controls instead of leaving it for
// the browser chrome (the page behind is inert while the modal is open).
function trapTab(e) {
  const f = [...tmEls.modal.querySelectorAll('button:not([disabled]), a[href]')];
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  const at = document.activeElement;
  if (e.shiftKey && (at === first || at === tmEls.body)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
}

// --- View (grid / list) ----------------------------------------------------
// The whole grid re-styles into a stacked list via a body class; the same tiles
// are reused (see .list-view CSS). The choice persists per browser.

const LS_VIEW = 'li_view';

// The category section currently anchored at the top of the viewport — the one
// the reader is looking at. Used to keep the same section in view across a
// grid/list toggle (the two layouts differ, so raw scroll position won't match).
function topmostCategory() {
  const sections = document.querySelectorAll('.category');
  let best = null;
  for (const s of sections) {
    const r = s.getBoundingClientRect();
    // First section whose bottom is still below the top edge: it's on screen.
    if (r.bottom > 1) { best = s; break; }
  }
  return best;
}

function initView() {
  // List view is the standard default; only an explicit 'grid' choice opts out.
  document.body.classList.toggle('list-view', lsGet(LS_VIEW) !== 'grid');
  el.viewToggle.addEventListener('click', (e) => {
    const list = !document.body.classList.contains('list-view');
    const anchor = topmostCategory();
    document.body.classList.toggle('list-view', list);
    lsSet(LS_VIEW, list ? 'list' : 'grid');
    // Re-anchor the same section once the new layout has settled.
    if (anchor) requestAnimationFrame(() => anchor.scrollIntoView({ block: 'start' }));
    if (e.detail) el.viewToggle.blur();
  });
}

const tiles = new Map();       // id -> <a> element
const catMeta = new Map();     // category name -> { total, unlocked, tallyEl }
const defById = new Map(ALL.map((a) => [a.id, a]));
const tieredIds = new Set(ALL.filter((a) => a.tiered).map((a) => a.id));
const tierHave = new Map();     // tiered id -> steps currently counted (avoids double-count)
const tierValue = new Map();    // tiered id -> current value, to re-render on a language switch
const countOf = (a) => (a.tiered ? a.steps.length : 1); // each reached step counts
let unlockedCount = 0;
let token = null;
let currentUserId = null;
let unlockedRecords = [];      // [{ id, gameId, color, ply }] — persisted per user
let partialRecords = {};       // id -> { have, need, items } — per-member progress
let currentWorker = null;
let shownComplete = false;     // the grid holds a finished run's result (restored or fresh)
let analysing = false;         // a worker run is in flight

// While a login or an analysis is in flight, index.html must not reload the page
// for a service-worker update: that would cut the run short. It waits for
// 'li:idle' instead (see the service-worker script at the end of index.html).
function setBusy(on) {
  document.documentElement.toggleAttribute('data-busy', on);
  if (!on) document.dispatchEvent(new Event('li:idle'));
}

// --- Persistence (localStorage) --------------------------------------------
// Unlocked achievements survive a reload; the session token is kept in
// sessionStorage so "Reload" can re-analyse without a fresh Lichess login.

const SS_TOKEN = 'li_token';
const LS_USER = 'li_user';
const cacheKey = (uid) => `li_unlocked:${uid}`;
const partialKey = (uid) => `li_partial:${uid}`;
const metaKey = (uid) => `li_meta:${uid}`;

function saveCache() {
  if (!currentUserId) return;
  try { localStorage.setItem(cacheKey(currentUserId), JSON.stringify(unlockedRecords)); } catch {}
}
// While a run streams in, results are written at most once a second: the end
// of a stream alone posts dozens of partials, and each would otherwise
// re-serialise the whole record into localStorage on the main thread.
let saveTimer = 0;
function persistSoon() { if (!saveTimer) saveTimer = setTimeout(persistNow, 1000); }
function persistNow() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  saveCache();
  savePartial();
}
window.addEventListener('pagehide', () => { if (saveTimer) persistNow(); });
function loadCache(uid) {
  try { return JSON.parse(localStorage.getItem(cacheKey(uid)) || 'null'); } catch { return null; }
}
// Partial (per-member) progress for aggregate achievements — read by hints.html.
function savePartial() {
  if (!currentUserId) return;
  try { localStorage.setItem(partialKey(currentUserId), JSON.stringify(partialRecords)); } catch {}
}
function loadPartial(uid) {
  try { return JSON.parse(localStorage.getItem(partialKey(uid)) || 'null'); } catch { return null; }
}
// Restore tiered tiles instantly from cached progress (no re-analysis).
function restoreTiers(uid) {
  const p = loadPartial(uid);
  if (!p) return;
  partialRecords = p;
  for (const id of tieredIds) {
    if (p[id] && typeof p[id].value === 'number') applyTier(id, p[id].value, { animate: false });
  }
}
// Per-user bookkeeping next to the results: `complete` is false from the start
// of an analysis until its 'done', so a run cut short (page reload, closed tab)
// is never mistaken for a finished one. Older caches have no meta: complete.
function loadMeta(uid) {
  try { return JSON.parse(localStorage.getItem(metaKey(uid)) || 'null') || {}; } catch { return {}; }
}
function saveMeta(uid, patch) {
  if (!uid) return;
  try { localStorage.setItem(metaKey(uid), JSON.stringify({ ...loadMeta(uid), ...patch })); } catch {}
}
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

// --- Rendering -------------------------------------------------------------

function renderGrid() {
  const frag = document.createDocumentFragment();

  let grandTotal = 0;

  for (const cat of CATEGORIES) {
    const catTotal = cat.items.reduce((n, a) => n + countOf(a), 0);
    grandTotal += catTotal;
    catMeta.set(cat.name, { name: cat.name, total: catTotal, unlocked: 0, tallyEl: null });

    const section = document.createElement('section');
    section.className = 'category';
    section.id = slugify(cat.name); // enables deep-linking to a section via #hash

    const head = document.createElement('div');
    head.className = 'category-head'; // a table-of-contents toggle (see initToc)
    const h2 = document.createElement('h2');
    h2.textContent = catName(cat.name);
    const check = document.createElement('span');
    check.className = 'done-check';
    check.setAttribute('aria-hidden', 'true');
    check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>';
    const tally = document.createElement('span');
    tally.className = 'tally';
    tally.textContent = `0 / ${catTotal}`;
    const meta = catMeta.get(cat.name);
    meta.tallyEl = tally;
    meta.headEl = head;
    meta.nameEl = h2;
    head.append(h2, check, tally);

    const grid = document.createElement('div');
    grid.className = 'grid';

    for (const a of cat.items) {
      const tile = document.createElement('a');
      tile.className = 'tile';
      // A link without href is not focusable, so a locked tile (and its caption,
      // shown on focus in grid view) would be out of keyboard reach.
      tile.tabIndex = 0;
      tile.dataset.id = a.id;
      tile.dataset.cat = cat.name;
      if (a.link) tile.dataset.link = a.link; // static deep link (account/extra tiles)

      const locked = new Image();
      locked.className = 'locked';
      locked.src = 'images/locked.png';
      locked.alt = t('tile.locked');

      const text = achText(a);
      let art;
      if (a.tiered) {
        // Tiered tiles pick their art per reached step (set by applyTier). A ladder
        // is either all-image or all-SVG-placeholder, decided by its first step.
        if (a.steps[0] && a.steps[0].image) {
          art = new Image();
          art.className = 'art';
          art.alt = text.title;
          art.loading = 'lazy';
        } else {
          art = document.createElement('div');
          art.className = 'art art-svg';
        }
      } else if (a.image) {
        art = new Image();
        art.className = 'art';
        art.alt = text.title;
        art.dataset.art = a.image;   // loaded only on unlock (keeps the locked view light)
        art.loading = 'lazy';
      } else {
        // Coloured placeholder tile with a centred line icon (real art comes later).
        art = document.createElement('div');
        art.className = 'art art-svg';
        art.style.setProperty('--tile-color', a.color || '#555');
        art.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[a.svg] || ''}</svg>`;
      }

      const ext = document.createElement('span');
      ext.className = 'ext';
      ext.textContent = '↗';
      ext.setAttribute('aria-hidden', 'true');

      const cap = document.createElement('div');
      cap.className = 'caption';
      const h3 = document.createElement('h3');
      if (a.tiered) {
        const tt = document.createElement('span');
        tt.className = 'tier-title'; // current tier title (grid caption)
        tt.textContent = text.title;
        h3.append(tt);
      } else {
        h3.textContent = text.title;
      }
      const p = document.createElement('p');
      p.textContent = text.details;
      cap.append(h3, p);

      tile.append(locked, art, ext, cap);

      if (a.tiered) {
        // Grid: a segmented progress bar + n/N, shown once a tier is reached.
        const prog = document.createElement('div');
        prog.className = 'tier-progress';
        prog.setAttribute('aria-hidden', 'true');
        prog.innerHTML = '<span class="tier-bar"><span class="tier-fill"></span></span><span class="tier-count"></span>';
        tile.append(prog);
        // List: a multi-line ladder (one line per cleared step + the next target).
        const stepsEl = document.createElement('div');
        stepsEl.className = 'tier-steps';
        tile.append(stepsEl);
        tile.dataset.tiered = '1';
      }

      grid.append(tile);
      tiles.set(a.id, tile);
    }

    section.append(head, grid);
    frag.append(section);
  }

  el.gridRoot.append(frag);
  el.statusTotal.textContent = String(grandTotal);

  // Seed tiered tiles with their base (0-value) caption + ladder so the list view
  // isn't blank before any analysis/restore.
  for (const id of tieredIds) applyTier(id, 0);
}

// Apply a tiered achievement's current value: upgrade the art to the highest
// reached step, advance the progress bar, update the caption (current tier +
// next target) and the counters (each reached step counts once).
function applyTier(id, value, { animate = false } = {}) {
  const tile = tiles.get(id);
  const def = defById.get(id);
  if (!tile || !def || !def.tiered) return;
  const steps = def.steps;
  let have = 0;
  for (const s of steps) if (value >= s.at) have++;
  tierValue.set(id, value);
  const text = achText(def);

  const prev = tierHave.get(id) || 0;
  if (have !== prev) {
    bumpCount(tile, have - prev);
    tierHave.set(id, have);
  }

  const fill = tile.querySelector('.tier-fill');
  const count = tile.querySelector('.tier-count');   // n/N in the grid bar
  const title = tile.querySelector('.tier-title');
  const p = tile.querySelector('.caption p');
  if (fill) fill.style.width = `${(have / steps.length) * 100}%`;
  if (count) count.textContent = `${have} / ${steps.length}`;

  renderTierSteps(tile, def, have, value, partialRecords[id]?.items);   // list-view multi-line ladder

  if (have === 0) {
    tile.classList.remove('unlocked');
    clearTileLink(tile);
    if (title) title.textContent = text.title;
    if (p) p.textContent = text.details;
    return;
  }

  const cur = steps[have - 1];
  const curText = stepText(def, have - 1);
  const art = tile.querySelector('.art');
  if (art) {
    if (cur.image) {
      art.src = cur.image;
    } else if (cur.svg) {
      art.style.setProperty('--tile-color', cur.color || '#555');
      art.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[cur.svg] || ''}</svg>`;
    }
  }
  const wasUnlocked = tile.classList.contains('unlocked');
  tile.classList.add('unlocked');
  if (animate && !wasUnlocked) {
    tile.classList.add('revealing');
    tile.addEventListener('animationend', () => tile.classList.remove('revealing'), { once: true });
  }

  // Grid caption: the achievement name (bold), then the current tier as
  // "name: description" below (mirrors a list-view row). When a tier shares the
  // achievement's name (e.g. Time Controls, Marathon) drop the repeat and show
  // just the description.
  if (title) title.textContent = text.title;
  if (p) {
    p.textContent = (curText.title !== text.title && curText.details)
      ? `${curText.title}: ${curText.details}`
      : (curText.details || curText.title);
  }

  setTileLink(tile);
}

// Build the list-view ladder: the group title + a line per cleared step (each
// checked) plus the next in-progress target. Hidden in grid view via CSS.
function renderTierSteps(tile, def, have, value, items) {
  const el = tile.querySelector('.tier-steps');
  if (!el) return;
  const steps = def.steps;
  el.textContent = '';

  const head = document.createElement('div');
  head.className = 'tier-steps-head';
  const ht = document.createElement('span');
  ht.className = 'tier-steps-title';
  ht.textContent = achText(def).title;
  const hc = document.createElement('span');
  hc.className = 'tier-steps-count';
  hc.textContent = `${have} / ${steps.length}`;
  head.append(ht, hc);

  const ul = document.createElement('ul');
  ul.className = 'tier-steps-list';
  for (let i = 0; i < steps.length; i++) {
    const done = i < have;
    if (!done && i !== have) break; // only cleared steps + the single next target
    const li = document.createElement('li');
    li.className = done ? 'done' : 'next';
    const chk = document.createElement('span');
    chk.className = 'tier-check';
    // Title + description share a wrapping flex box, so the description drops to
    // its own line only when it doesn't fit inline (colon trails the title).
    const text = document.createElement('span');
    text.className = 'tier-step-text';
    const st = stepText(def, i);
    const ttl = document.createElement('span');
    ttl.className = 'tier-step-title';
    ttl.textContent = st.details ? `${st.title}:` : st.title;
    text.append(ttl);
    if (st.details) {
      const d = document.createElement('span');
      d.className = 'tier-step-desc';
      d.textContent = st.details;
      text.append(d);
    }
    li.append(chk, text);
    // Per-step tally only on the in-progress step; cleared steps drop it. A
    // `discrete` ladder has no such tally: its `at` values label a rung (a computer
    // level, a Maia net) rather than counting up to one, so "0 / 1100" would be
    // nonsense — there is no partial progress toward beating a given bot.
    if (!done) {
      if (!def.discrete) {
        const tg = document.createElement('span');
        tg.className = 'tier-target';
        tg.textContent = `${fmtNum(Math.min(value, steps[i].at))} / ${fmtNum(steps[i].at)}`;
        li.append(tg);
      }
    } else if (items && items[i] && items[i].gameId) {
      // Cleared step with a known source game: make the whole row deep-link to it.
      // The ↗ is only revealed on hover (see CSS) so the dense rows stay uncluttered.
      const it = items[i];
      li.classList.add('has-game');
      li.dataset.href = `https://lichess.org/${it.gameId}${it.color ? `/${it.color}` : ''}${Number.isInteger(it.ply) ? `#${it.ply + 1}` : ''}`;
      const cue = document.createElement('span');
      cue.className = 'tier-step-link';
      cue.textContent = '↗';
      cue.setAttribute('aria-hidden', 'true');
      li.append(cue);
    }
    ul.append(li);
  }

  el.append(head, ul);
  // Any unlocked tier makes the tile open the grid-view tier modal (see main.js/CSS).
  tile.classList.toggle('has-tiers', have >= 1);
}

// Point a tile at the game that unlocked it, else at its static link, if any.
function setTileLink(tile, gameId, color, ply) {
  let href = null;
  if (gameId) {
    // Game-derived tiles carry color + ply; account/extra tiles (e.g. peak rating)
    // may carry only a gameId, so build the deep link from whatever we have.
    href = `https://lichess.org/${gameId}`;
    if (color) href += `/${color}`;
    if (Number.isInteger(ply)) href += `#${ply + 1}`;
  } else if (tile.dataset.link && (!tile.dataset.link.includes('{u}') || currentUserId)) {
    // Static deep link (e.g. profile, teams, puzzle modes). `{u}` -> user id.
    href = tile.dataset.link.replace('{u}', encodeURIComponent(currentUserId || ''));
  }
  if (!href) return;
  tile.href = href;
  tile.target = '_blank';
  tile.rel = 'noopener';
}
function clearTileLink(tile) {
  tile.removeAttribute('href');
  tile.removeAttribute('target');
  tile.removeAttribute('rel');
}

// Move the unlocked counters (status bar + the tile's category tally) by delta.
function bumpCount(tile, delta) {
  unlockedCount += delta;
  el.statusUnlocked.textContent = String(unlockedCount);
  const meta = catMeta.get(tile.dataset.cat);
  if (meta) {
    meta.unlocked += delta;
    meta.tallyEl.textContent = `${meta.unlocked} / ${meta.total}`;
    meta.headEl.classList.toggle('complete', meta.unlocked === meta.total);
  }
  scheduleFilter();
}

// Reveal a tile; returns true if it was locked until now. An already unlocked
// tile only has its link refreshed, since a re-run may name a different game.
function unlock(id, gameId, color, ply, { animate = true, persist = true } = {}) {
  const tile = tiles.get(id);
  if (!tile) return false;
  if (tile.classList.contains('unlocked')) {
    if (gameId) setTileLink(tile, gameId, color, ply);
    return false;
  }

  const art = tile.querySelector('.art');
  if (art.dataset.art) art.src = art.dataset.art;

  tile.classList.add('unlocked');
  if (animate) {
    tile.classList.add('revealing');
    tile.addEventListener('animationend', () => tile.classList.remove('revealing'), { once: true });
  }
  setTileLink(tile, gameId, color, ply);
  bumpCount(tile, 1);

  if (persist) { unlockedRecords.push({ id, gameId: gameId || null, color: color || null, ply: ply ?? null }); persistSoon(); }
  return true;
}

// Lock a plain tile again (a re-run no longer found it, e.g. a stricter detector).
function relock(id) {
  const tile = tiles.get(id);
  if (!tile || !tile.classList.contains('unlocked')) return;
  tile.classList.remove('unlocked', 'revealing', 'revealed', 'is-new');
  clearTileLink(tile);
  bumpCount(tile, -1);
}

// The "new" badge: exactly these tiles carry it (everything else loses it).
function markFresh(ids) {
  const set = new Set(ids);
  for (const [id, tile] of tiles) tile.classList.toggle('is-new', set.has(id));
}

// End of a re-run: make the grid show exactly what this run found. Plain tiles
// it no longer finds lock again, ladders settle on their final value (up or
// down), and whatever beats the previous result gets the "new" badge. Returns
// { fresh: ids, gained: countable achievements added }.
function reconcile(run, baseline) {
  for (const id of baseline.unlocked) if (!run.unlocked.has(id)) relock(id);
  for (const [id, p] of Object.entries(run.partial)) {
    if (tieredIds.has(id) && typeof p.value === 'number') applyTier(id, p.value);
  }
  unlockedRecords = [...run.unlocked.values()];
  partialRecords = { ...partialRecords, ...run.partial };

  const fresh = [];
  let gained = 0;
  for (const id of run.unlocked.keys()) {
    if (!baseline.unlocked.has(id)) { fresh.push(id); gained++; }
  }
  for (const id of tieredIds) {
    const up = (tierHave.get(id) || 0) - (baseline.have.get(id) || 0);
    if (up > 0) { fresh.push(id); gained += up; }
  }
  markFresh(fresh);
  return { fresh, gained };
}

// Clear every unlocked tile back to the locked state (used before a re-analysis).
function resetGrid() {
  unlockedRecords = [];
  unlockedCount = 0;
  tierHave.clear();
  tierValue.clear();
  el.statusUnlocked.textContent = '0';
  for (const tile of tiles.values()) {
    tile.classList.remove('unlocked', 'revealing', 'revealed', 'is-new');
    clearTileLink(tile);
    const art = tile.querySelector('.art');
    if (art) art.removeAttribute('src');
    // Tiered tiles: rebuild the base (0-value) caption, bar and ladder.
    const def = defById.get(tile.dataset.id);
    if (def && def.tiered) applyTier(tile.dataset.id, 0);
  }
  for (const meta of catMeta.values()) {
    meta.unlocked = 0;
    meta.tallyEl.textContent = `0 / ${meta.total}`;
    meta.headEl.classList.remove('complete');
  }
}

// Restore unlocked tiles from cache instantly (no reveal animation, no re-persist).
function restoreCached(records) {
  unlockedRecords = records.slice();
  for (const r of records) unlock(r.id, r.gameId, r.color, r.ply, { animate: false, persist: false });
}

// --- Analysis --------------------------------------------------------------

function showAccountBar(account) {
  saveMeta(account.id, { name: account.username }); // for the logged-out restore
  el.statusbar.hidden = false;
  el.loginBtn.hidden = true;
  el.reloadBtn.hidden = false;
  el.statusUser.textContent = account.username;
}

function startAnalysis(account) {
  analysing = true;
  setBusy(true);
  currentUserId = account.id;
  lsSet(LS_USER, account.id);

  // Two kinds of run. Over a finished result (Reload) the grid stays as it is,
  // new finds are badged as they come in, and storage keeps the old result
  // until this run completes, when reconcile() settles the grid on exactly what
  // was found. Otherwise (first visit, or an interrupted run) the grid starts
  // empty and results are saved as they arrive, flagged incomplete until 'done'.
  const rerun = shownComplete;
  shownComplete = false;
  const run = { unlocked: new Map(), partial: {} };
  let baseline = null;
  if (rerun) {
    baseline = {
      unlocked: new Set([...tiles].filter(([id, t]) => !tieredIds.has(id) && t.classList.contains('unlocked')).map(([id]) => id)),
      have: new Map(tierHave),
    };
    markFresh([]); // the previous run's badges are part of the baseline now
  } else {
    resetGrid();
    partialRecords = {};
    persistNow();  // overwrite any stale cache with an empty set for a fresh run
    saveMeta(account.id, { complete: false });
  }

  showAccountBar(account);
  el.progress.classList.remove('fading'); // in case a prior run's fade was mid-flight
  el.progress.hidden = false;
  el.progress.classList.add('indeterminate');
  el.progressBar.style.width = '';

  if (currentWorker) currentWorker.terminate();

  const totalGames = account.count?.all || 0;
  const setSummary = (done, fresh = null, eta = null) => { summary = { done, total: totalGames, fresh, eta }; renderSummary(); };
  // Remaining time from the rate measured so far. Lichess streams your own games at
  // up to 60 per second, so the rate is steady; the first seconds are skipped
  // because they include the connection set-up.
  let rateFrom = null;
  const etaAt = (count) => {
    const now = performance.now();
    if (!rateFrom) rateFrom = { t: now, count };
    const secs = (now - rateFrom.t) / 1000;
    const rate = secs >= 3 ? (count - rateFrom.count) / secs : 0;
    return rate > 0 && totalGames > count ? (totalGames - count) / rate : null;
  };
  setSummary(0);

  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  currentWorker = worker;
  announce(t('live.start'));

  // Coalesce unlocks onto animation frames to avoid layout thrash.
  const pending = [];
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    for (const u of pending.splice(0)) {
      run.unlocked.set(u.id, { id: u.id, gameId: u.gameId || null, color: u.color || null, ply: u.ply ?? null });
      const isNew = unlock(u.id, u.gameId, u.color, u.ply, { persist: !rerun });
      if (rerun && isNew) tiles.get(u.id).classList.add('is-new');
    }
  };

  worker.onmessage = (e) => {
    if (worker !== currentWorker) return; // ignore a superseded run (e.g. after Reload)
    const m = e.data;
    if (m.type === 'unlock') {
      pending.push(m);
      if (!scheduled) { scheduled = true; requestAnimationFrame(flush); }
    } else if (m.type === 'partial') {
      run.partial[m.id] = m.progress;
      const tiered = tieredIds.has(m.id);
      if (!rerun) {
        partialRecords[m.id] = m.progress;
        persistSoon();
        if (tiered) applyTier(m.id, m.progress.value, { animate: true });
      } else if (!tiered || m.progress.value > (tierValue.get(m.id) || 0)) {
        // Mid-run a re-run only ever climbs; a lower value waits for reconcile().
        partialRecords[m.id] = m.progress;
        if (tiered) {
          applyTier(m.id, m.progress.value, { animate: true });
          if ((tierHave.get(m.id) || 0) > (baseline.have.get(m.id) || 0)) tiles.get(m.id).classList.add('is-new');
        }
      }
    } else if (m.type === 'progress') {
      setSummary(m.count, null, etaAt(m.count));
      if (totalGames) {
        el.progress.classList.remove('indeterminate');
        el.progressBar.style.width = `${Math.min(100, (m.count / totalGames) * 100)}%`;
      }
    } else if (m.type === 'done') {
      flush();
      const { fresh, gained } = rerun ? reconcile(run, baseline) : { fresh: [], gained: null };
      persistNow();
      saveMeta(currentUserId, { complete: true, fresh });
      shownComplete = true;
      analysing = false;
      setBusy(false);
      setSummary(m.count, gained);
      announce([
        t('live.done', { n: fmtNum(unlockedCount), total: el.statusTotal.textContent }),
        gained ? t('live.fresh', { n: fmtNum(gained) }) : '',
      ].join(' ').trim());
      el.progress.classList.remove('indeterminate');
      el.progressBar.style.width = '100%';
      // Let the full bar sit briefly, then fade it out and hide once faded.
      // Guarded by currentWorker so a Reload started mid-fade doesn't hide the
      // new run's bar.
      setTimeout(() => {
        if (worker !== currentWorker) return;
        el.progress.classList.add('fading');
        setTimeout(() => {
          if (worker !== currentWorker) return;
          el.progress.hidden = true;
          el.progress.classList.remove('fading');
        }, 550); // matches the .progress opacity transition
      }, 900);
    } else if (m.type === 'error') {
      if (!rerun) persistNow(); // keep what a first run found (a re-run keeps the old result)
      analysing = false;
      setBusy(false);
      showError(m.key ? t(m.key) : m.message);
      el.progress.hidden = true;
    }
  };

  worker.postMessage({ type: 'analyze', username: account.username, userId: account.id, token, account });
}

// The status line next to the username: analysis progress, or a note that the
// tiles came from the cache. Kept as state so a language switch can re-render it.
let summary = null;   // null | 'restored' | 'incomplete' | { done, total, fresh, eta }
function renderSummary() {
  if (!summary) return;
  if (typeof summary === 'string') { el.statusSummary.textContent = t(`status.${summary}`); return; }
  const parts = [summary.total
    ? t('status.analysed', { done: fmtNum(summary.done), total: fmtNum(summary.total) })
    : t('status.analysedCount', { done: fmtNum(summary.done) })];
  // While running: the estimated time left, in seconds.
  if (summary.eta != null) {
    parts.push(summary.eta < 60 ? t('status.etaSoon') : t('status.eta', { min: fmtNum(Math.ceil(summary.eta / 60)) }));
  }
  // After a re-run: how many achievements it added (null on a first run).
  if (summary.fresh != null) parts.push(summary.fresh ? t('status.fresh', { n: fmtNum(summary.fresh) }) : t('status.noFresh'));
  el.statusSummary.textContent = parts.join(' · ');
}

// Re-render every JS-built text after a language switch (static markup is
// handled by translateDom). Tiered tiles go back through applyTier at their
// current value, which leaves the counters alone.
function relabel() {
  setNewLabel();
  for (const meta of catMeta.values()) meta.nameEl.textContent = catName(meta.name);
  for (const [id, tile] of tiles) {
    const def = defById.get(id);
    const { title, details } = achText(def);
    tile.querySelector('.locked').alt = t('tile.locked');
    const art = tile.querySelector('img.art');
    if (art) art.alt = title;
    if (def.tiered) { applyTier(id, tierValue.get(id) || 0); continue; }
    tile.querySelector('.caption h3').textContent = title;
    tile.querySelector('.caption p').textContent = details;
  }
  renderSummary();
  if (tmEls && !tmEls.modal.hidden) renderTierModal();
  searchText.clear(); // the search runs over the texts in the new language
  if (filterQuery) applyFilter();
}

// --- Filter ----------------------------------------------------------------
// All / unlocked / locked, narrowed by a search over each tile's title,
// description, ladder steps and category, in the current language. "Locked"
// means "something left to earn", so a half-climbed ladder shows under both.

let filterMode = 'all';
let filterQuery = '';          // normalised search words, space-separated
const searchText = new Map();  // id -> normalised searchable text (per language)
const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function tileText(tile) {
  const id = tile.dataset.id;
  let s = searchText.get(id);
  if (s == null) {
    const def = defById.get(id);
    const { title, details } = achText(def);
    const parts = [title, details, catName(tile.dataset.cat)];
    if (def.tiered) {
      def.steps.forEach((_, i) => { const st = stepText(def, i); parts.push(st.title, st.details || ''); });
    }
    s = norm(parts.join(' '));
    searchText.set(id, s);
  }
  return s;
}

function tileMatches(tile) {
  const def = defById.get(tile.dataset.id);
  if (filterMode === 'unlocked' && !tile.classList.contains('unlocked')) return false;
  if (filterMode === 'locked') {
    const done = def.tiered
      ? (tierHave.get(def.id) || 0) === def.steps.length
      : tile.classList.contains('unlocked');
    if (done) return false;
  }
  return filterQuery.split(' ').every((w) => !w || tileText(tile).includes(w));
}

// Hide non-matching tiles, and whole sections left without a visible tile.
function applyFilter() {
  filterPending = false;
  const active = filterMode !== 'all' || filterQuery !== '';
  let any = false;
  for (const section of el.gridRoot.querySelectorAll('.category')) {
    let visible = 0;
    for (const tile of section.querySelectorAll('.tile')) {
      const show = !active || tileMatches(tile);
      tile.hidden = !show;
      if (show) visible++;
    }
    section.hidden = visible === 0;
    if (visible) any = true;
  }
  el.filterEmpty.hidden = any;
}

// Tiles change status while a run streams in; re-filter at most every 250 ms.
let filterPending = false;
function scheduleFilter() {
  if (filterPending || (filterMode === 'all' && filterQuery === '')) return;
  filterPending = true;
  setTimeout(applyFilter, 250);
}

function initFilter() {
  const buttons = [...document.querySelectorAll('.filter-btn')];
  for (const b of buttons) {
    b.addEventListener('click', () => {
      filterMode = b.dataset.filter;
      for (const x of buttons) x.setAttribute('aria-pressed', String(x === b));
      applyFilter();
    });
  }
  el.filterSearch.addEventListener('input', () => {
    filterQuery = norm(el.filterSearch.value).trim().split(/\s+/).join(' ');
    applyFilter();
  });
}

// The "new" badge is CSS-drawn from this custom property (see .is-new).
function setNewLabel() {
  document.documentElement.style.setProperty('--new-label', JSON.stringify(t('tile.new')));
}

// Restore previously unlocked achievements from cache without re-analysing.
function showRestored(displayName, complete = true) {
  el.statusbar.hidden = false;
  el.loginBtn.hidden = true;
  el.reloadBtn.hidden = false;
  el.statusUser.textContent = displayName;
  summary = complete ? 'restored' : 'incomplete';
  renderSummary();
  el.progress.hidden = true;
}

// Re-run the full analysis on demand (no need to log out and back in).
async function reloadAchievements() {
  if (!token) { login().catch((e) => showError(e.message)); return; } // no session: re-auth
  el.error.hidden = true;
  try {
    const account = await fetchAccount(token);
    startAnalysis(account);
  } catch (e) {
    showError(e.message);
  }
}

async function logout() {
  const t = token;
  try {
    sessionStorage.removeItem(SS_TOKEN);
    if (currentUserId) {
      localStorage.removeItem(cacheKey(currentUserId));
      localStorage.removeItem(partialKey(currentUserId));
      localStorage.removeItem(metaKey(currentUserId));
    }
    localStorage.removeItem(LS_USER);
  } catch {}
  if (t) await revoke(t);
  location.href = location.origin + location.pathname;
}

// --- Boot ------------------------------------------------------------------

function showError(msg) {
  el.error.textContent = msg;
  el.error.hidden = false;
}

// The grid is built in JS after parse, so the browser's native jump to a #hash
// (which ran against an empty #grid-root) missed. Re-run it now, and keep honouring
// later hash changes so in-page section links work.
function jumpToHash() {
  if (!location.hash) return;
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
}

async function boot() {
  initThemeToggle(el.themeToggle);
  initView();
  renderGrid();
  initTileInteraction();
  initTierModal();
  translateDom();   // static markup + the modal's aria labels
  setNewLabel();
  initLangSelect(el.langSelect, relabel);
  initToc(el.gridRoot, '.category-head');
  initFilter();
  jumpToHash();
  window.addEventListener('hashchange', jumpToHash);

  el.loginBtn.addEventListener('click', () => login().catch((e) => showError(e.message)));
  el.reloadBtn.addEventListener('click', reloadAchievements);
  el.logoutBtn.addEventListener('click', logout);

  // Busy from here until the session is settled: a code exchange or the first
  // analysis must not be interrupted by an update reload.
  setBusy(true);
  try { await resumeSession(); } finally { if (!analysing) setBusy(false); }
}

// Finish a login redirect, or pick up the session / cached results from before.
async function resumeSession() {
  try {
    token = await completeLoginIfRedirected();
  } catch (e) {
    showError(e.message);
    return;
  }

  // Persist a fresh token, or restore one from a previous page load.
  if (token) { try { sessionStorage.setItem(SS_TOKEN, token); } catch {} }
  else { token = sessionStorage.getItem(SS_TOKEN) || null; }

  if (token) {
    let account = null;
    try { account = await fetchAccount(token); } catch { account = null; }
    if (account) {
      currentUserId = account.id;
      lsSet(LS_USER, account.id);
      saveMeta(account.id, { name: account.username });
      const cached = loadCache(account.id);
      if (cached && cached.length && loadMeta(account.id).complete !== false) {
        showRestored(account.username); // reload kept our achievements — show them instantly
        restoreCached(cached);
        restoreTiers(account.id);
        markFresh(loadMeta(account.id).fresh || []);
        shownComplete = true;
      } else {
        startAnalysis(account);         // first visit, or the last run never finished
      }
      return;
    }
    // Token no longer valid: drop it and fall back to a read-only cached view.
    token = null;
    try { sessionStorage.removeItem(SS_TOKEN); } catch {}
  }

  // Not logged in, but show cached achievements from a previous visit if present.
  const lastUser = lsGet(LS_USER);
  if (lastUser) {
    const cached = loadCache(lastUser);
    if (cached && cached.length) {
      currentUserId = lastUser;
      // Without a session we cannot finish an interrupted run; say so instead.
      const meta = loadMeta(lastUser);
      // li_user is the lowercase id; show the name as the user spells it.
      showRestored(meta.name || lastUser, meta.complete !== false);
      restoreCached(cached);
      restoreTiers(lastUser);
      markFresh(meta.fresh || []);
    }
  }
  // otherwise: logged-out landing view (login button visible)
}

boot();
