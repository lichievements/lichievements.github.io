// ============================================================================
// Lichievements — UI orchestration
// ============================================================================

import { CATEGORIES, ALL } from './achievements.js';
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
};

// --- Theme -----------------------------------------------------------------

function initTheme() {
  el.themeToggle.addEventListener('click', () => {
    const light = document.documentElement.getAttribute('data-theme') !== 'light';
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    try { localStorage.setItem('theme', light ? 'light' : 'dark'); } catch {}
  });
}

const tiles = new Map();       // id -> <a> element
const catMeta = new Map();     // category name -> { total, unlocked, tallyEl }
let unlockedCount = 0;
let token = null;

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
    const tally = document.createElement('span');
    tally.className = 'tally';
    tally.textContent = `0 / ${cat.items.length}`;
    catMeta.get(cat.name).tallyEl = tally;
    head.append(h2, tally);

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

      const art = new Image();
      art.className = 'art';
      art.alt = a.title;
      art.dataset.art = a.image;   // loaded only on unlock (keeps the locked view light)
      art.loading = 'lazy';

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

function unlock(id, gameId, color, ply) {
  const tile = tiles.get(id);
  if (!tile || tile.classList.contains('unlocked')) return;

  const art = tile.querySelector('.art');
  if (art.dataset.art) art.src = art.dataset.art;

  tile.classList.add('unlocked', 'revealing');
  tile.addEventListener('animationend', () => tile.classList.remove('revealing'), { once: true });

  if (gameId) {
    tile.href = `https://lichess.org/${gameId}/${color}#${ply + 1}`;
    tile.target = '_blank';
    tile.rel = 'noopener';
  }

  unlockedCount++;
  el.statusUnlocked.textContent = String(unlockedCount);

  const meta = catMeta.get(tile.dataset.cat);
  if (meta) { meta.unlocked++; meta.tallyEl.textContent = `${meta.unlocked} / ${meta.total}`; }
}

// --- Analysis --------------------------------------------------------------

function startAnalysis(account) {
  el.statusbar.hidden = false;
  el.loginBtn.hidden = true;
  el.statusUser.textContent = account.username;
  el.progress.hidden = false;

  const totalGames = account.count?.all || 0;
  const fmt = (n) => n.toLocaleString('en-US');
  const setSummary = (done) => {
    el.statusSummary.textContent = totalGames
      ? `${fmt(done)} / ${fmt(totalGames)} games analysed`
      : `${fmt(done)} games analysed`;
  };
  setSummary(0);

  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

  // Coalesce unlocks onto animation frames to avoid layout thrash.
  const pending = [];
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    for (const u of pending.splice(0)) unlock(u.id, u.gameId, u.color, u.ply);
  };

  worker.onmessage = (e) => {
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

// --- Boot ------------------------------------------------------------------

function showError(msg) {
  el.error.textContent = msg;
  el.error.hidden = false;
}

async function boot() {
  initTheme();
  renderGrid();

  el.loginBtn.addEventListener('click', () => login().catch((e) => showError(e.message)));
  el.logoutBtn.addEventListener('click', async () => {
    if (token) await revoke(token);
    location.href = location.origin + location.pathname;
  });

  try {
    token = await completeLoginIfRedirected();
  } catch (e) {
    showError(e.message);
    return;
  }

  if (!token) return; // logged-out landing view

  try {
    const account = await fetchAccount(token);
    startAnalysis(account);
  } catch (e) {
    showError(e.message);
  }
}

boot();
