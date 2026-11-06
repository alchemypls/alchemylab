// ── tabs behavior runtime ─────────────────────────────────────────
// Turns stacked sections into accessible tabs (WAI-ARIA tabs pattern). Progressive enhancement:
// without this the page shows every section stacked under its own heading; the tab row ships
// `hidden` and is revealed here, and the per-section headings are hidden instead.
//
// Finds, inside the root: [data-role="tablist"], [data-role="tab"] ×N, [data-role="panel"] ×N
// (same order), and optional [data-role="panel-heading"] (shown only in the no-script layout).
// Reads data-start="<n>" (1-based) on the root for the initially selected tab.
// Keyboard: ←/→ move between tabs (wrapping), Home/End jump to first/last; selection follows focus.
//
// SELF-CONTAINED ON PURPOSE (source is copied into exported pages) — see carousel.ts.

export function alchemyTabs(root: HTMLElement): () => void {
  const prevCleanup = (root as unknown as { __alTabs?: () => void }).__alTabs;
  if (prevCleanup) prevCleanup();

  const tablist = root.querySelector('[data-role="tablist"]') as HTMLElement | null;
  const tabs = Array.prototype.slice.call(root.querySelectorAll('[data-role="tab"]')) as HTMLElement[];
  const panels = Array.prototype.slice.call(root.querySelectorAll('[data-role="panel"]')) as HTMLElement[];
  const headings = Array.prototype.slice.call(root.querySelectorAll('[data-role="panel-heading"]')) as HTMLElement[];
  if (!tablist || !tabs.length) return function () {};

  const uid = 'al-tabs-' + Math.random().toString(36).slice(2, 8);
  tablist.setAttribute('role', 'tablist');
  tablist.removeAttribute('hidden');
  for (let i = 0; i < tabs.length; i++) {
    tabs[i].id = uid + '-t' + i;
    tabs[i].setAttribute('role', 'tab');
    tabs[i].setAttribute('aria-controls', uid + '-p' + i);
    tabs[i].removeAttribute('hidden');
  }
  for (let i = 0; i < panels.length; i++) {
    panels[i].id = uid + '-p' + i;
    panels[i].setAttribute('role', 'tabpanel');
    panels[i].setAttribute('aria-labelledby', uid + '-t' + i);
    panels[i].setAttribute('tabindex', '0');
  }
  for (let i = 0; i < headings.length; i++) headings[i].setAttribute('hidden', '');

  let current = 0;
  const select = function (i: number, focus: boolean) {
    current = (i % tabs.length + tabs.length) % tabs.length;
    for (let j = 0; j < tabs.length; j++) {
      const on = j === current;
      tabs[j].setAttribute('aria-selected', on ? 'true' : 'false');
      tabs[j].setAttribute('tabindex', on ? '0' : '-1');
      if (panels[j]) { if (on) panels[j].removeAttribute('hidden'); else panels[j].setAttribute('hidden', ''); }
    }
    if (focus) tabs[current].focus();
  };

  const clicks = tabs.map(function (_t, i) { return function () { select(i, false); }; });
  const onKey = function (e: KeyboardEvent) {
    let to = -1;
    if (e.key === 'ArrowRight') to = current + 1;
    else if (e.key === 'ArrowLeft') to = current - 1;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = tabs.length - 1;
    if (to < 0 && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    select(to, true);
  };

  for (let i = 0; i < tabs.length; i++) tabs[i].addEventListener('click', clicks[i]);
  tablist.addEventListener('keydown', onKey);
  const start = parseInt(root.getAttribute('data-start') || '1', 10);
  select(isNaN(start) ? 0 : Math.max(0, Math.min(tabs.length - 1, start - 1)), false);

  const cleanup = function () {
    for (let i = 0; i < tabs.length; i++) tabs[i].removeEventListener('click', clicks[i]);
    tablist.removeEventListener('keydown', onKey);
    (root as unknown as { __alTabs?: () => void }).__alTabs = undefined;
  };
  (root as unknown as { __alTabs?: () => void }).__alTabs = cleanup;
  return cleanup;
}
