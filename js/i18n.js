// ============================================================================
// Lichievements — translations
//
// English is the source language and stays where it always was: achievement
// texts in achievements.js, static page text in the HTML, and the handful of
// strings main.js builds at runtime in EN below. Every other language is one
// module in js/lang/ that overlays those, and anything it leaves out falls back
// to English — so a translation can lag behind a new achievement without
// breaking it.
//
// A language module exports:
//   ui           { key: string }            UI strings, for t() and data-i18n*
//   categories   { 'English name': string } category headings
//   achievements { id: { t, d, steps } }    title, details, and per ladder step
//                                           a [title, details] pair
//
// Static markup opts in with attributes, each naming a `ui` key:
//   data-i18n="key"        text content
//   data-i18n-html="key"   inner HTML (for prose with links / emphasis)
//   data-i18n-title="key"  title attribute
//   data-i18n-aria="key"   aria-label attribute
//   data-i18n-ach="id"     text content = that achievement's title
// The English original is remembered on first swap, so switching back to
// English restores it without a reload.
// ============================================================================

// Native names, as shown in the language menu. Adding a language = an entry
// here plus js/lang/<code>.js.
export const LANGS = { en: 'English', de: 'Deutsch' };

const LS_LANG = 'lang';

// English for the strings main.js / oauth.js / worker errors build at runtime.
// Static markup needs no entry here: its English is the HTML itself.
const EN = {
  'status.analysed': '{done} / {total} games analysed',
  'status.analysedCount': '{done} games analysed',
  'status.restored': 'Restored from your last visit',
  'tile.locked': 'Locked achievement',
  'err.declined': 'Lichess authorization was declined ({reason}).',
  'err.state': 'Login state mismatch. Please try logging in again.',
  'err.token': 'Could not obtain an access token from Lichess.',
  'err.noToken': 'Lichess did not return an access token.',
  'err.account': 'Could not load your Lichess account.',
  'err.stream': 'Could not stream your games from Lichess.',
};

export let lang = 'en';
let dict = {};
let numFmt = new Intl.NumberFormat('en-US');

// Saved choice first, then the browser's preferred languages, then English.
function detect() {
  let saved = null;
  try { saved = localStorage.getItem(LS_LANG); } catch {}
  if (saved && LANGS[saved]) return saved;
  for (const l of navigator.languages || [navigator.language || '']) {
    const base = String(l).toLowerCase().split('-')[0];
    if (LANGS[base]) return base;
  }
  return 'en';
}

// Load a language. `persist` records it as an explicit choice; the automatic
// pick on first load is not saved, so it keeps following the browser.
export async function setLang(code, persist = true) {
  if (!LANGS[code]) code = 'en';
  let next = {};
  if (code !== 'en') {
    try { next = await import(`./lang/${code}.js`); }
    catch { code = 'en'; next = {}; }
  }
  lang = code;
  dict = next;
  numFmt = new Intl.NumberFormat(code === 'en' ? 'en-US' : code);
  document.documentElement.lang = code;
  if (persist) { try { localStorage.setItem(LS_LANG, code); } catch {} }
}

await setLang(detect(), false);

// A UI string with `{name}` placeholders filled from `params`.
export function t(key, params) {
  const s = dict.ui?.[key] ?? EN[key] ?? key;
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m)) : s;
}

export const fmtNum = (n) => numFmt.format(n);

export const catName = (name) => dict.categories?.[name] ?? name;

export function achText(a) {
  const d = dict.achievements?.[a.id];
  return { title: d?.t ?? a.title, details: d?.d ?? a.details };
}

export function stepText(a, i) {
  const s = dict.achievements?.[a.id]?.steps?.[i];
  const st = a.steps[i];
  return { title: s?.[0] ?? st.title, details: s?.[1] ?? st.details };
}

// --- Static markup ---------------------------------------------------------

const originals = new WeakMap(); // element -> { kind: English value }

const READ = {
  text: (el) => el.textContent,
  html: (el) => el.innerHTML,
  title: (el) => el.getAttribute('title'),
  aria: (el) => el.getAttribute('aria-label'),
};
const WRITE = {
  text: (el, v) => { el.textContent = v; },
  html: (el, v) => { el.innerHTML = v; },
  title: (el, v) => el.setAttribute('title', v),
  aria: (el, v) => el.setAttribute('aria-label', v),
};

function swap(el, kind, value) {
  let o = originals.get(el);
  if (!o) { o = {}; originals.set(el, o); }
  if (!(kind in o)) o[kind] = READ[kind](el);
  const v = value ?? o[kind];
  if (v != null) WRITE[kind](el, v);
}

export function translateDom(root = document) {
  const ui = dict.ui || {};
  const each = (attr, kind, lookup) => root.querySelectorAll(`[${attr}]`)
    .forEach((el) => swap(el, kind, lookup(el.getAttribute(attr))));
  each('data-i18n', 'text', (k) => ui[k]);
  each('data-i18n-html', 'html', (k) => ui[k]);
  each('data-i18n-title', 'title', (k) => ui[k]);
  each('data-i18n-aria', 'aria', (k) => ui[k]);
  each('data-i18n-ach', 'text', (id) => dict.achievements?.[id]?.t);
  document.documentElement.classList.remove('i18n-pending');
}

// Fill the language <select> and switch on change. `onChange` re-renders
// whatever the page builds in JS; static markup is handled here.
export function initLangSelect(select, onChange) {
  if (!select) return;
  for (const [code, name] of Object.entries(LANGS)) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    opt.lang = code;
    select.append(opt);
  }
  select.value = lang;
  select.addEventListener('change', async () => {
    await setLang(select.value);
    translateDom();
    if (onChange) onChange();
  });
}
