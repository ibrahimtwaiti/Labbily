// Load before the stylesheets so the first frame respects the saved preference.
(() => {
  const key = 'labbily.appearance';
  const system = matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  function saved() {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function apply(choice) {
    root.dataset.theme = ['light', 'dark'].includes(choice) ? choice : system.matches ? 'dark' : 'light';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
    });
  }
  apply(saved());
  system.addEventListener('change', () => { if (!saved()) apply(null); });
  addEventListener('storage', event => { if (event.key === key || event.key === null) apply(saved()); });
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-theme-toggle]')) return;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(key, next); } catch { /* Use this preference for this page. */ }
    apply(next);
  });
})();

function themeControl() {
  const label = sv('الوضع الداكن', 'Dark mode');
  return `<button type="button" class="theme-control" data-theme-toggle aria-label="${label}" title="${label}" aria-pressed="${document.documentElement.dataset.theme === 'dark'}">
    <svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 14.2a8.6 8.6 0 0 1-10.6-10.6A8.8 8.8 0 1 0 20.4 14.2Z"/></svg>
    <svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg></button>`;
}
