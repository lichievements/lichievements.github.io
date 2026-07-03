// ============================================================================
// Lichievements — UI orchestration
// ============================================================================

import { CATEGORIES, ALL, ICONS } from './achievements.js';
import { login, completeLoginIfRedirected, fetchAccount, revoke } from './oauth.js';

const $ = (sel) => document.querySelector(sel);

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

  el.gridRoot.addEventListener('click', (e) => {
    if (!touch.matches) return; // pointer devices keep hover + single-click
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

const tiles = new Map();       // id -> <a> element
const catMeta = new Map();     // category name -> { total, unlocked, tallyEl }
let unlockedCount = 0;
let token = null;
let currentUserId = null;
let unlockedRecords = [];      // [{ id, gameId, color, ply }] — persisted per user
let currentWorker = null;

// --- Persistence (localStorage) --------------------------------------------
// Unlocked achievements survive a reload; the session token is kept in
// sessionStorage so "Reload" can re-analyse without a fresh Lichess login.

const SS_TOKEN = 'li_token';
const LS_USER = 'li_user';
const cacheKey = (uid) => `li_unlocked:${uid}`;

function saveCache() {
  if (!currentUserId) return;
  try { localStorage.setItem(cacheKey(currentUserId), JSON.stringify(unlockedRecords)); } catch {}
}
function loadCache(uid) {
  try { return JSON.parse(localStorage.getItem(cacheKey(uid)) || 'null'); } catch { return null; }
}
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

// --- Rendering -------------------------------------------------------------

function renderGrid() {
  const frag = document.createDocumentFragment();

  for (const cat of CATEGORIES) {
    catMeta.set(cat.name, { total: cat.items.length, unlocked: 0, tallyEl: null });

    const section = document.createElement('section');
    section.className = 'category';

    const head = document.createElement('div');
    head.className = 'category-head';
    const h2 = document.createElement('h2');
    h2.textContent = cat.name;
    const check = document.createElement('span');
    check.className = 'done-check';
    check.setAttribute('aria-hidden', 'true');
    check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>';
    const tally = document.createElement('span');
    tally.className = 'tally';
    tally.textContent = `0 / ${cat.items.length}`;
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

      const locked = new Image();
      locked.className = 'locked';
      locked.src = 'images/locked.png';
      locked.alt = 'Locked achievement';

      let art;
      if (a.image) {
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
      h3.textContent = a.title;
      const p = document.createElement('p');
      p.textContent = a.details;
      cap.append(h3, p);

      tile.append(locked, art, ext, cap);
      grid.append(tile);
      tiles.set(a.id, tile);
    }

    section.append(head, grid);
    frag.append(section);
  }

  el.gridRoot.append(frag);
  el.statusTotal.textContent = String(ALL.length);
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
    tile.href = `https://lichess.org/${gameId}/${color}#${ply + 1}`;
    tile.target = '_blank';
    tile.rel = 'noopener';
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
  el.statusUnlocked.textContent = '0';
  for (const tile of tiles.values()) {
    tile.classList.remove('unlocked', 'revealing', 'revealed');
    tile.removeAttribute('href');
    tile.removeAttribute('target');
    tile.removeAttribute('rel');
    const art = tile.querySelector('.art');
    if (art) art.removeAttribute('src');
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
  saveCache(); // overwrite any stale cache with an empty set for a fresh run

  showAccountBar(account);
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
      setTimeout(() => { el.progress.hidden = true; }, 900);
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
    if (currentUserId) localStorage.removeItem(cacheKey(currentUserId));
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

async function boot() {
  initTheme();
  renderGrid();
  initTileInteraction();

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
    }
  }
  // otherwise: logged-out landing view (login button visible)
}

boot();
