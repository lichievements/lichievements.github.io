// ============================================================================
// Lichievements — UI orchestration
// ============================================================================

import { CATEGORIES, ALL, ICONS } from './achievements.js';
import { login, completeLoginIfRedirected, fetchAccount, revoke } from './oauth.js';

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
};

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
  modal.innerHTML =
    '<div class="tier-modal-body" tabindex="-1">'
    + '<button class="tier-modal-close" type="button" aria-label="Close">✕</button>'
    + '<div class="tier-modal-stage">'
    + '<button class="tier-modal-nav tier-modal-prev" type="button" aria-label="Previous tier">‹</button>'
    + '<a class="tier-modal-art" target="_blank" rel="noopener"><span class="ext" aria-hidden="true">↗</span></a>'
    + '<button class="tier-modal-nav tier-modal-next" type="button" aria-label="Next tier">›</button>'
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
    if (it && it.done) tiers.push({ step: def.steps[i], game: it });
  }
  if (!tiers.length) return;
  tmDef = def;
  tmTiers = tiers;
  tmIdx = tiers.length - 1; // start on the highest tier reached (what the tile shows)
  tmReturn = document.activeElement;
  renderTierModal();
  tmEls.modal.hidden = false;
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
  const { step, game } = tmTiers[tmIdx];
  const { art, prev, next, label, title, desc } = tmEls;
  // Art: image or coloured SVG icon, matching the tile. Keep the ↗ cue in place.
  art.querySelectorAll('img, svg').forEach((n) => n.remove());
  if (step.image) {
    art.style.removeProperty('--tile-color');
    const img = new Image();
    img.src = step.image; img.alt = step.title;
    art.prepend(img);
  } else {
    art.style.setProperty('--tile-color', step.color || '#555');
    art.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[step.svg] || ''}</svg>`);
  }
  const href = tierModalHref(game);
  if (href) { art.href = href; art.classList.remove('no-link'); }
  else { art.removeAttribute('href'); art.classList.add('no-link'); }
  label.textContent = `${tmDef.title} · ${tmIdx + 1} / ${tmTiers.length}`;
  title.textContent = step.title;
  desc.textContent = step.details || '';
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
  tmEls.body.classList.remove('slide-next', 'slide-prev');
  document.removeEventListener('keydown', onTierModalKey);
  if (tmReturn && tmReturn.focus) tmReturn.focus();
  tmReturn = null;
}

function onTierModalKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); closeTierModal(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); stepTierModal(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); stepTierModal(1); }
}

// --- Table of contents -----------------------------------------------------
// Tapping any category heading collapses every grid so the headings stack into a
// compact table of contents; tapping again restores the tiles and brings the
// tapped heading to the top of the screen.

let tocCollapsed = false;

function toggleToc(head) {
  tocCollapsed = !tocCollapsed;
  // Class on <body> so page chrome (header, footer, theme/GitHub row) can hide too.
  document.body.classList.toggle('toc-mode', tocCollapsed);
  for (const h of document.querySelectorAll('.category-head')) {
    h.setAttribute('aria-expanded', String(!tocCollapsed));
  }
  // Let the layout settle after showing/hiding the grids, then scroll. Opening
  // the TOC jumps to the very top; expanding brings the tapped heading to the top.
  requestAnimationFrame(() => {
    if (tocCollapsed) window.scrollTo(0, 0);
    else head.scrollIntoView({ block: 'start' });
  });
}

function initToc() {
  el.gridRoot.addEventListener('click', (e) => {
    const head = e.target.closest('.category-head');
    if (head) toggleToc(head);
  });
  el.gridRoot.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const head = e.target.closest('.category-head');
    if (!head) return;
    e.preventDefault(); // Space would otherwise scroll the page
    toggleToc(head);
  });
}

// --- Theme -----------------------------------------------------------------

function initTheme() {
  el.themeToggle.addEventListener('click', (e) => {
    const light = document.documentElement.getAttribute('data-theme') !== 'light';
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    try { localStorage.setItem('theme', light ? 'light' : 'dark'); } catch {}
    // e.detail === 0 means keyboard activation; drop focus for pointer taps so no
    // outline lingers on touch devices, but keep it for keyboard users.
    if (e.detail) el.themeToggle.blur();
  });
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
const countOf = (a) => (a.tiered ? a.steps.length : 1); // each reached step counts
const fmtNum = (n) => n.toLocaleString('en-US');
let unlockedCount = 0;
let token = null;
let currentUserId = null;
let unlockedRecords = [];      // [{ id, gameId, color, ply }] — persisted per user
let partialRecords = {};       // id -> { have, need, items } — per-member progress
let currentWorker = null;

// --- Persistence (localStorage) --------------------------------------------
// Unlocked achievements survive a reload; the session token is kept in
// sessionStorage so "Reload" can re-analyse without a fresh Lichess login.

const SS_TOKEN = 'li_token';
const LS_USER = 'li_user';
const cacheKey = (uid) => `li_unlocked:${uid}`;
const partialKey = (uid) => `li_partial:${uid}`;

function saveCache() {
  if (!currentUserId) return;
  try { localStorage.setItem(cacheKey(currentUserId), JSON.stringify(unlockedRecords)); } catch {}
}
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
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

// --- Rendering -------------------------------------------------------------

function renderGrid() {
  const frag = document.createDocumentFragment();

  let grandTotal = 0;

  for (const cat of CATEGORIES) {
    const catTotal = cat.items.reduce((n, a) => n + countOf(a), 0);
    grandTotal += catTotal;
    catMeta.set(cat.name, { total: catTotal, unlocked: 0, tallyEl: null });

    const section = document.createElement('section');
    section.className = 'category';
    section.id = slugify(cat.name); // enables deep-linking to a section via #hash

    const head = document.createElement('div');
    head.className = 'category-head';
    head.tabIndex = 0;
    head.setAttribute('role', 'button');
    head.setAttribute('aria-expanded', 'true');
    const h2 = document.createElement('h2');
    h2.textContent = cat.name;
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
    head.append(h2, check, tally);

    const grid = document.createElement('div');
    grid.className = 'grid';

    for (const a of cat.items) {
      const tile = document.createElement('a');
      tile.className = 'tile';
      tile.dataset.id = a.id;
      tile.dataset.cat = cat.name;
      if (a.link) tile.dataset.link = a.link; // static deep link (account/extra tiles)

      const locked = new Image();
      locked.className = 'locked';
      locked.src = 'images/locked.png';
      locked.alt = 'Locked achievement';

      let art;
      if (a.tiered) {
        // Tiered tiles pick their art per reached step (set by applyTier). A ladder
        // is either all-image or all-SVG-placeholder, decided by its first step.
        if (a.steps[0] && a.steps[0].image) {
          art = new Image();
          art.className = 'art';
          art.alt = a.title;
          art.loading = 'lazy';
        } else {
          art = document.createElement('div');
          art.className = 'art art-svg';
        }
      } else if (a.image) {
        art = new Image();
        art.className = 'art';
        art.alt = a.title;
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
        tt.textContent = a.title;
        h3.append(tt);
      } else {
        h3.textContent = a.title;
      }
      const p = document.createElement('p');
      p.textContent = a.details;
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

  const prev = tierHave.get(id) || 0;
  if (have !== prev) {
    unlockedCount += have - prev;
    el.statusUnlocked.textContent = String(unlockedCount);
    const meta = catMeta.get(tile.dataset.cat);
    if (meta) {
      meta.unlocked += have - prev;
      meta.tallyEl.textContent = `${meta.unlocked} / ${meta.total}`;
      meta.headEl.classList.toggle('complete', meta.unlocked === meta.total);
    }
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
    if (title) title.textContent = def.title;
    if (p) p.textContent = def.details;
    return;
  }

  const cur = steps[have - 1];
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
  if (title) title.textContent = def.title;
  if (p) {
    p.textContent = (cur.title !== def.title && cur.details)
      ? `${cur.title}: ${cur.details}`
      : (cur.details || cur.title);
  }

  if (def.link && (!def.link.includes('{u}') || currentUserId)) {
    tile.href = def.link.replace('{u}', encodeURIComponent(currentUserId || ''));
    tile.target = '_blank';
    tile.rel = 'noopener';
  }
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
  ht.textContent = def.title;
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
    const t = document.createElement('span');
    t.className = 'tier-step-title';
    t.textContent = steps[i].details ? `${steps[i].title}:` : steps[i].title;
    text.append(t);
    if (steps[i].details) {
      const d = document.createElement('span');
      d.className = 'tier-step-desc';
      d.textContent = steps[i].details;
      text.append(d);
    }
    li.append(chk, text);
    // Per-step tally only on the in-progress step; cleared steps drop it.
    if (!done) {
      const tg = document.createElement('span');
      tg.className = 'tier-target';
      tg.textContent = `${fmtNum(Math.min(value, steps[i].at))} / ${fmtNum(steps[i].at)}`;
      li.append(tg);
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

function unlock(id, gameId, color, ply, { animate = true, persist = true } = {}) {
  const tile = tiles.get(id);
  if (!tile || tile.classList.contains('unlocked')) return;

  const art = tile.querySelector('.art');
  if (art.dataset.art) art.src = art.dataset.art;

  tile.classList.add('unlocked');
  if (animate) {
    tile.classList.add('revealing');
    tile.addEventListener('animationend', () => tile.classList.remove('revealing'), { once: true });
  }

  if (gameId) {
    // Game-derived tiles carry color + ply; account/extra tiles (e.g. peak rating)
    // may carry only a gameId, so build the deep link from whatever we have.
    let href = `https://lichess.org/${gameId}`;
    if (color) href += `/${color}`;
    if (Number.isInteger(ply)) href += `#${ply + 1}`;
    tile.href = href;
    tile.target = '_blank';
    tile.rel = 'noopener';
  } else if (tile.dataset.link) {
    // Static deep link (e.g. profile, teams, puzzle modes). `{u}` -> user id.
    const link = tile.dataset.link;
    if (!link.includes('{u}') || currentUserId) {
      tile.href = link.replace('{u}', encodeURIComponent(currentUserId || ''));
      tile.target = '_blank';
      tile.rel = 'noopener';
    }
  }

  unlockedCount++;
  el.statusUnlocked.textContent = String(unlockedCount);

  const meta = catMeta.get(tile.dataset.cat);
  if (meta) {
    meta.unlocked++;
    meta.tallyEl.textContent = `${meta.unlocked} / ${meta.total}`;
    if (meta.unlocked === meta.total) meta.headEl.classList.add('complete');
  }

  if (persist) { unlockedRecords.push({ id, gameId: gameId || null, color: color || null, ply: ply ?? null }); saveCache(); }
}

// Clear every unlocked tile back to the locked state (used before a re-analysis).
function resetGrid() {
  unlockedRecords = [];
  unlockedCount = 0;
  tierHave.clear();
  el.statusUnlocked.textContent = '0';
  for (const tile of tiles.values()) {
    tile.classList.remove('unlocked', 'revealing', 'revealed');
    tile.removeAttribute('href');
    tile.removeAttribute('target');
    tile.removeAttribute('rel');
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
  el.statusbar.hidden = false;
  el.loginBtn.hidden = true;
  el.reloadBtn.hidden = false;
  el.statusUser.textContent = account.username;
}

function startAnalysis(account) {
  currentUserId = account.id;
  lsSet(LS_USER, account.id);
  resetGrid();
  partialRecords = {};
  saveCache();   // overwrite any stale cache with an empty set for a fresh run
  savePartial(); // ditto for per-member progress

  showAccountBar(account);
  el.progress.classList.remove('fading'); // in case a prior run's fade was mid-flight
  el.progress.hidden = false;
  el.progress.classList.add('indeterminate');
  el.progressBar.style.width = '';

  if (currentWorker) currentWorker.terminate();

  const totalGames = account.count?.all || 0;
  const fmt = (n) => n.toLocaleString('en-US');
  const setSummary = (done) => {
    el.statusSummary.textContent = totalGames
      ? `${fmt(done)} / ${fmt(totalGames)} games analysed`
      : `${fmt(done)} games analysed`;
  };
  setSummary(0);

  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  currentWorker = worker;

  // Coalesce unlocks onto animation frames to avoid layout thrash.
  const pending = [];
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    for (const u of pending.splice(0)) unlock(u.id, u.gameId, u.color, u.ply);
  };

  worker.onmessage = (e) => {
    if (worker !== currentWorker) return; // ignore a superseded run (e.g. after Reload)
    const m = e.data;
    if (m.type === 'unlock') {
      pending.push(m);
      if (!scheduled) { scheduled = true; requestAnimationFrame(flush); }
    } else if (m.type === 'partial') {
      partialRecords[m.id] = m.progress;
      savePartial();
      if (tieredIds.has(m.id)) applyTier(m.id, m.progress.value, { animate: true });
    } else if (m.type === 'progress') {
      setSummary(m.count);
      if (totalGames) {
        el.progress.classList.remove('indeterminate');
        el.progressBar.style.width = `${Math.min(100, (m.count / totalGames) * 100)}%`;
      }
    } else if (m.type === 'done') {
      flush();
      setSummary(m.count);
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
      showError(m.message);
      el.progress.hidden = true;
    }
  };

  worker.postMessage({ type: 'analyze', username: account.username, userId: account.id, token, account });
}

// Restore previously unlocked achievements from cache without re-analysing.
function showRestored(displayName) {
  el.statusbar.hidden = false;
  el.loginBtn.hidden = true;
  el.reloadBtn.hidden = false;
  el.statusUser.textContent = displayName;
  el.statusSummary.textContent = 'Restored from your last visit';
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
    if (currentUserId) { localStorage.removeItem(cacheKey(currentUserId)); localStorage.removeItem(partialKey(currentUserId)); }
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
  initTheme();
  initView();
  renderGrid();
  initTileInteraction();
  initTierModal();
  initToc();
  jumpToHash();
  window.addEventListener('hashchange', jumpToHash);

  el.loginBtn.addEventListener('click', () => login().catch((e) => showError(e.message)));
  el.reloadBtn.addEventListener('click', reloadAchievements);
  el.logoutBtn.addEventListener('click', logout);

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
      const cached = loadCache(account.id);
      if (cached && cached.length) {
        showRestored(account.username); // reload kept our achievements — show them instantly
        restoreCached(cached);
        restoreTiers(account.id);
      } else {
        startAnalysis(account);         // first visit for this user
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
      showRestored(lastUser);
      restoreCached(cached);
      restoreTiers(lastUser);
    }
  }
  // otherwise: logged-out landing view (login button visible)
}

boot();
