// ── leader behavior runtime ───────────────────────────────────────
// A thin leader line from one thing to the thing it opens (selected row → its detail), measured on the page and
// redrawn as it changes. 1px; it leaves `from` sideways and meets `to`'s near edge, level when it can, else with one
// 45° elbow. It draws in along its length when its ends change (standard ease, 300ms); calm (prefers-reduced-motion):
// it appears whole. Drawn only when `to` sits beside `from`; stacked (phones) there is none — the open row is the link.
//
// Reads, on the root:
//   data-leader-from   selector for the start (default: the selected tab, [data-role="tab"][aria-selected="true"])
//   data-leader-to     selector for the end (default: the panel showing, [data-role="panel"]:not([hidden]))
//                      Looked up inside the root first, then the whole page (rail dot → a panel elsewhere)
//   data-leader-color  any CSS color (default: the start's text color — gold on a selected row)
//   data-leader-min    smallest screen width it's drawn at, px (default 0)
// Uses ResizeObserver, MutationObserver, Element.animate — Baseline widely available.
//
// SELF-CONTAINED ON PURPOSE (source is copied into exported pages) — see carousel.ts.

export function alchemyLeader(root: HTMLElement): () => void {
  const prevCleanup = (root as unknown as { __alLeader?: () => void }).__alLeader;
  if (prevCleanup) prevCleanup();

  const fromSel = root.getAttribute('data-leader-from') || '[data-role="tab"][aria-selected="true"]';
  const toSel = root.getAttribute('data-leader-to') || '[data-role="panel"]:not([hidden])';
  const color = root.getAttribute('data-leader-color') || '';
  const min = parseInt(root.getAttribute('data-leader-min') || '0', 10) || 0;
  const calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const NS = 'http://www.w3.org/2000/svg';

  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:2;';
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke-width', '1');
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.appendChild(path);
  root.appendChild(svg);

  const find = function (sel: string): Element | null {
    try { return root.querySelector(sel) || document.querySelector(sel); } catch { return null; }
  };
  let ends: [Element | null, Element | null] = [null, null], frame = 0;

  const draw = function () {
    frame = 0;
    const a = find(fromSel), b = find(toSel);
    const ra = a && a.getBoundingClientRect(), rb = b && b.getBoundingClientRect(), ro = root.getBoundingClientRect();
    const off = !ra || !rb || !ra.width || !rb.width || window.innerWidth < min;
    // Beside: the end starts right of the start (or left of it) with room between; stacked layouts draw nothing
    const right = !off && rb!.left >= ra!.right + 4, left = !off && rb!.right <= ra!.left - 4;
    if (off || (!right && !left)) { path.setAttribute('d', ''); ends = [null, null]; return; }
    const x1 = (right ? ra!.right : ra!.left) - ro.left, y1 = ra!.top + ra!.height / 2 - ro.top;
    const x2 = (right ? rb!.left : rb!.right) - ro.left;
    const y2 = Math.max(rb!.top - ro.top + 16, Math.min(rb!.bottom - ro.top - 16, y1));   // level when the end spans the start's height
    const run = Math.abs(x2 - x1), rise = Math.min(Math.abs(y2 - y1), run), dir = right ? 1 : -1;
    const k = (run - rise) / 2;   // level, a 45° elbow, level
    const d = 'M' + x1 + ' ' + y1 + ' H' + (x1 + dir * k) + ' L' + (x1 + dir * (k + rise)) + ' ' + (y1 + (y2 > y1 ? rise : -rise)) + ' H' + x2;
    path.setAttribute('d', d);
    path.setAttribute('stroke', color || (a ? getComputedStyle(a).color : 'currentColor'));
    if (ends[0] !== a || ends[1] !== b) {   // new ends: draw in
      ends = [a, b];
      if (!(calm && calm.matches) && path.getTotalLength) {
        const len = path.getTotalLength();
        path.animate([{ strokeDasharray: len + ' ' + len, strokeDashoffset: len }, { strokeDasharray: len + ' ' + len, strokeDashoffset: 0 }],
          { duration: 300, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
      }
    }
  };
  const soon = function () { if (!frame) frame = requestAnimationFrame(draw); };

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(soon) : null;
  if (ro) ro.observe(root);
  const mo = new MutationObserver(soon);
  mo.observe(root, { attributes: true, subtree: true, attributeFilter: ['aria-selected', 'hidden', 'open', 'class'] });
  root.addEventListener('transitionend', soon);   // a row fading to gold: take its color once it's there
  window.addEventListener('resize', soon);
  window.addEventListener('hashchange', soon);
  document.addEventListener('scroll', soon, true);
  soon();

  const cleanup = function () {
    if (frame) cancelAnimationFrame(frame);
    if (ro) ro.disconnect();
    mo.disconnect();
    root.removeEventListener('transitionend', soon);
    window.removeEventListener('resize', soon);
    window.removeEventListener('hashchange', soon);
    document.removeEventListener('scroll', soon, true);
    if (svg.parentNode) svg.parentNode.removeChild(svg);
    (root as unknown as { __alLeader?: () => void }).__alLeader = undefined;
  };
  (root as unknown as { __alLeader?: () => void }).__alLeader = cleanup;
  return cleanup;
}
