// ============================================================================
// Lichievements — page chrome shared by index.html and hints.html
// ============================================================================

// Light/dark toggle. The pre-paint script in each page's <head> applies the
// saved theme before first paint; this only handles the button.
export function initThemeToggle(btn) {
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    const light = document.documentElement.getAttribute('data-theme') !== 'light';
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    try { localStorage.setItem('theme', light ? 'light' : 'dark'); } catch {}
    // e.detail === 0 means keyboard activation; drop focus for pointer taps so no
    // outline lingers on touch devices, but keep it for keyboard users.
    if (e.detail) btn.blur();
  });
}

// Table of contents: tapping any section heading collapses every section so the
// headings stack into a compact index (body.toc-mode, which also hides the page
// chrome); tapping again restores the content and brings that heading to the
// top. Headings are found by delegation under `root`, and must exist by the
// time this runs to get their button semantics.
export function initToc(root, selector) {
  if (!root) return;
  let collapsed = false;
  const heads = () => root.querySelectorAll(selector);
  for (const h of heads()) {
    h.setAttribute('role', 'button');
    h.tabIndex = 0;
    h.setAttribute('aria-expanded', 'true');
  }

  const toggle = (head) => {
    collapsed = !collapsed;
    document.body.classList.toggle('toc-mode', collapsed);
    for (const h of heads()) h.setAttribute('aria-expanded', String(!collapsed));
    // Let the layout settle after showing/hiding the sections, then scroll.
    // Opening the TOC jumps to the very top; expanding brings the tapped heading
    // to the top.
    requestAnimationFrame(() => {
      if (collapsed) window.scrollTo(0, 0);
      else head.scrollIntoView({ block: 'start' });
    });
  };

  root.addEventListener('click', (e) => {
    const head = e.target.closest(selector);
    if (head) toggle(head);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const head = e.target.closest(selector);
    if (!head) return;
    e.preventDefault(); // Space would otherwise scroll the page
    toggle(head);
  });
}
