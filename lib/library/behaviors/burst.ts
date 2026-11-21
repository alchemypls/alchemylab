// ── burst behavior runtime ────────────────────────────────────────
// The press firework, contained: 8 petals fly out from where the part was pressed, in the role's colors, clipped to
// the part's box, at most .7 opaque, gone in 500ms. One at a time per part: a new press replaces the last.
// A keyboard press (Enter/Space → a click with no pointer) bursts from the middle. Calm (prefers-reduced-motion):
// a single rim flash instead, never more than 3 a second. Decoration only: the part works the same without it.
//
// Reads data-colors="<css color>, <css color>…" on the root (petals alternate through them). Without it, the part's own
// line color (its border, else its text): each variant bursts in its role color with nothing to set.
// Uses Element.animate (Web Animations), Baseline widely available.
//
// SELF-CONTAINED ON PURPOSE (source is copied into exported pages) — see carousel.ts.

export function alchemyBurst(root: HTMLElement): () => void {
  const prevCleanup = (root as unknown as { __alBurst?: () => void }).__alBurst;
  if (prevCleanup) prevCleanup();

  const given = (root.getAttribute('data-colors') || '').split(',').map(function (c) { return c.trim(); }).filter(Boolean);
  const roleColors = function (): string[] {
    if (given.length) return given;
    const cs = getComputedStyle(root), line = cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none' ? cs.borderTopColor : '';
    return [line && !/rgba\([^)]*,\s*0\)|transparent/.test(line) ? line : cs.color];
  };
  const calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let layer: HTMLElement | null = null, lastFlash = 0;

  const fresh = function (): HTMLElement {
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
    const l = document.createElement('span');
    l.setAttribute('aria-hidden', 'true');
    l.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:inherit;z-index:1;';
    root.appendChild(l);
    layer = l;
    return l;
  };

  const burst = function (x: number, y: number) {
    const colors = roleColors();
    if (calm && calm.matches) {
      const now = Date.now();
      if (now - lastFlash < 334) return;
      lastFlash = now;
      const l = fresh(), c = colors[0] || 'currentColor';
      l.animate([{ boxShadow: 'inset 0 0 0 2px ' + c, opacity: 0.7 }, { boxShadow: 'inset 0 0 0 2px ' + c, opacity: 0 }], { duration: 300, easing: 'ease-out' })
        .onfinish = function () { if (l.parentNode) l.parentNode.removeChild(l); };
      return;
    }
    const l = fresh(), r = root.getBoundingClientRect();
    const reach = Math.max(16, Math.min(56, Math.min(r.width, r.height) * 0.6));
    let left = 8;
    for (let i = 0; i < 8; i++) {
      const p = document.createElement('span'), deg = i * 45 + 22.5, c = colors.length ? colors[i % colors.length] : 'currentColor';
      p.style.cssText = 'position:absolute;width:4px;height:10px;margin:-5px 0 0 -2px;border-radius:2px;left:' + x + 'px;top:' + y + 'px;background:' + c + ';';
      l.appendChild(p);
      p.animate([
        { transform: 'rotate(' + deg + 'deg) translateY(0) scaleY(0.4)', opacity: 0.7 },
        { transform: 'rotate(' + deg + 'deg) translateY(-' + reach + 'px) scaleY(1)', opacity: 0 },
      ], { duration: 500, easing: 'cubic-bezier(0, 0, 0.2, 1)', fill: 'forwards' }).onfinish = function () {
        if (--left === 0 && l.parentNode) l.parentNode.removeChild(l);
      };
    }
  };

  const onDown = function (e: PointerEvent) {
    if (e.button > 0) return;
    const r = root.getBoundingClientRect();
    burst(e.clientX - r.left, e.clientY - r.top);
  };
  const onClick = function (e: MouseEvent) {
    if (e.detail !== 0) return;   // a pointer press already burst on pointerdown
    const r = root.getBoundingClientRect();
    burst(r.width / 2, r.height / 2);
  };
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('click', onClick);

  const cleanup = function () {
    root.removeEventListener('pointerdown', onDown);
    root.removeEventListener('click', onClick);
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    (root as unknown as { __alBurst?: () => void }).__alBurst = undefined;
  };
  (root as unknown as { __alBurst?: () => void }).__alBurst = cleanup;
  return cleanup;
}
