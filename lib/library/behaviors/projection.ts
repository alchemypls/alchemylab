// ── projection behavior runtime ───────────────────────────────────
// The overlay looks projected from one source, the orb: fine scanline rings centred on it run across the part's
// surface (under its contents, never over text), its edge shimmers with slow low-frequency noise that grows with the
// distance from the orb, and a pulse (a brighter ring leaving the orb) sweeps through now and then: the update.
//
// The source is the first [data-role="orb"] on the page (its centre), else the bottom-right corner of the screen.
// Pulses: one every data-projection-every seconds (default 12; 0 = none), on a section change (hashchange), once when
// the page appears, and whenever anything dispatches `al-projection-pulse` on document (Cori landing, a recall).
// Reads on the root: data-projection-pitch (px between rings, default 3), data-projection-alpha (ring opacity,
// default 0.07). Calm (prefers-reduced-motion): the rings and the edge hold still and no pulse moves.
// Decoration only: two aria-hidden layers behind the part's contents; the part works the same without them.
//
// SELF-CONTAINED ON PURPOSE (source is copied into exported pages) — see carousel.ts.

export function alchemyProjection(root: HTMLElement): () => void {
  type Shared = { count: number; timer: number; tick: number; off: () => void; phase: number; paints: (() => void)[] };
  type Win = Window & { __alProjection?: Shared };
  const W = window as Win;
  const prevCleanup = (root as unknown as { __alProjection?: () => void }).__alProjection;
  if (prevCleanup) prevCleanup();

  const num = function (name: string, d: number) { const v = parseFloat(root.getAttribute(name) || ''); return isNaN(v) ? d : v; };
  const pitch = Math.max(2, num('data-projection-pitch', 3)), alpha = num('data-projection-alpha', 0.07);
  const every = num('data-projection-every', 12);
  const calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const still = function () { return !!(calm && calm.matches); };

  // One shared set of shimmer filters (near / mid / far) and one shared clock for every projected part
  if (!document.getElementById('al-shimmer-defs')) {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('id', 'al-shimmer-defs'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    [0.6, 1.4, 2.4].forEach(function (scale, i) {
      const f = document.createElementNS(ns, 'filter'), t = document.createElementNS(ns, 'feTurbulence'), d = document.createElementNS(ns, 'feDisplacementMap');
      f.setAttribute('id', 'al-shimmer-' + i); f.setAttribute('x', '-5%'); f.setAttribute('y', '-5%'); f.setAttribute('width', '110%'); f.setAttribute('height', '110%');
      t.setAttribute('type', 'fractalNoise'); t.setAttribute('baseFrequency', '0.012'); t.setAttribute('numOctaves', '2'); t.setAttribute('seed', '3'); t.setAttribute('result', 'n');
      d.setAttribute('in', 'SourceGraphic'); d.setAttribute('in2', 'n'); d.setAttribute('scale', String(scale * 2));
      d.setAttribute('xChannelSelector', 'R'); d.setAttribute('yChannelSelector', 'G');
      f.appendChild(t); f.appendChild(d); svg.appendChild(f);
    });
    document.body.appendChild(svg);
  }
  let shared = W.__alProjection;
  if (!shared) {
    const pulse = function () { document.dispatchEvent(new CustomEvent('al-projection-pulse')); };
    const s: Shared = { count: 0, timer: 0, tick: 0, phase: 0, off: function () {}, paints: [] };
    // The shimmer: the noise drifts slowly; each pulse gives it a new seed
    const turbs = function () { return Array.prototype.slice.call(document.querySelectorAll('#al-shimmer-defs feTurbulence')) as Element[]; };
    s.tick = window.setInterval(function () {   // one clock for every part: the noise drifts, the rings drift
      if (still() || document.hidden) return;
      s.phase += 1;
      const f = (0.012 + Math.sin(s.phase / 40) * 0.003).toFixed(4);
      turbs().forEach(function (t) { t.setAttribute('baseFrequency', f); });
      s.paints.forEach(function (p) { p(); });
    }, 200);
    const reseed = function () { turbs().forEach(function (t) { t.setAttribute('seed', String(1 + Math.floor(Math.random() * 90))); }); };
    if (every > 0) s.timer = window.setInterval(function () { if (!still() && !document.hidden) pulse(); }, every * 1000);

    // The draw-in: when the page appears or the section changes, the new page isn't faded in, the pulse draws it.
    // Each block of what's now showing (the section's grid blocks and its pinned ones; on appearing, the page's own
    // pinned blocks too, all but the orb) stays faint until the ring from the orb reaches its nearest point, then
    // comes up with one soft flicker. Calm: the page's own fade stays and nothing waits.
    const ORB = '[data-role="orb"]';
    let drawRaf = 0, drawSafety = 0, drawLeft: { el: HTMLElement; d: number }[] = [];
    const drawIn = function (appearing: boolean) {
      drawLeft.forEach(function (w) { w.el.style.opacity = ''; });   // a draw-in cut short (a quick second switch) leaves nothing faint
      drawLeft = [];
      if (still()) return;
      const main = document.querySelector('.page-main');
      if (!main) return;
      const secs = main.querySelectorAll(':scope > .page-sec');
      let shown: Element | null = null;
      if (secs.length) { const h = location.hash.slice(1), hit = h ? document.getElementById(h) : null; shown = hit && hit.classList.contains('page-sec') ? hit : secs[0]; }
      const items: HTMLElement[] = Array.prototype.slice.call((shown || main.querySelector(':scope > .page-grid') || main).children);
      if (shown) document.querySelectorAll('[data-sec="' + shown.id + '"]').forEach(function (el) { items.push(el as HTMLElement); });
      if (appearing) {
        for (let el = main.nextElementSibling; el; el = el.nextElementSibling) {
          if (el instanceof HTMLElement && !el.hasAttribute('data-sec') && !el.querySelector(ORB) && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE') items.push(el);
        }
      }
      const orb = document.querySelector(ORB), o = orb ? orb.getBoundingClientRect() : null;
      const sx = o && o.width ? o.left + o.width / 2 : window.innerWidth - 80, sy = o && o.width ? o.top + o.height / 2 : window.innerHeight - 80;
      const wait = items.map(function (el) {
        const r = el.getBoundingClientRect();
        el.style.opacity = '0.12';   // faint until the ring arrives: a page being drawn, not a page gone
        return { el: el, d: Math.hypot(sx - Math.min(Math.max(sx, r.left), r.right), sy - Math.min(Math.max(sy, r.top), r.bottom)) };
      });
      const show = function (w: { el: HTMLElement }) {
        w.el.style.opacity = '';
        w.el.animate([{ opacity: 0.12 }, { opacity: 0.7, offset: 0.35 }, { opacity: 0.5, offset: 0.5 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
      };
      cancelAnimationFrame(drawRaf); clearTimeout(drawSafety);
      const t0 = performance.now();
      drawLeft = wait.slice();
      const step = function () {
        const R = (performance.now() - t0) * 1.4;   // the pulse's speed: the ring and the draw-in move together
        drawLeft = drawLeft.filter(function (w) { if (w.d <= R) { show(w); return false; } return true; });
        if (drawLeft.length) drawRaf = requestAnimationFrame(step);
      };
      drawRaf = requestAnimationFrame(step);
      drawSafety = window.setTimeout(function () { drawLeft.forEach(show); drawLeft = []; }, 2500);   // never left dark
    };
    if (!still()) {
      document.documentElement.setAttribute('data-al-draw', '');
      const st = document.createElement('style');   // the pulse draws the section in: its own rise-in steps aside
      st.textContent = 'html[data-al-draw] .page-sec:target{animation:none}';
      document.head.appendChild(st);
    }
    // A switch that rewrites in place (the sections script, data-al-rewrite) brings its own pulse and timing
    const onHash = function () { if (!document.documentElement.hasAttribute('data-al-rewrite')) { drawIn(false); pulse(); } };
    // Arriving from another page of the site moments ago: the page was carried over (View Transitions), not drawn anew
    const onLeave = function () { try { sessionStorage.setItem('al-left', String(Date.now())); } catch { /* private mode */ } };
    window.addEventListener('pagehide', onLeave);
    let carried = false;
    try { carried = Date.now() - Number(sessionStorage.getItem('al-left') || 0) < 4000 && 'startViewTransition' in document; } catch { /* private mode */ }
    window.addEventListener('hashchange', onHash);
    document.addEventListener('al-projection-pulse', reseed);
    s.off = function () {
      clearInterval(s.tick); clearInterval(s.timer);
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('pagehide', onLeave);
      cancelAnimationFrame(drawRaf); clearTimeout(drawSafety);
      document.removeEventListener('al-projection-pulse', reseed);
    };
    W.__alProjection = shared = s;
    if (!carried) drawIn(true);   // appearing is an update too: the page is drawn in from the orb (unless it was carried over)
    pulse();
  }
  shared.count += 1;

  // The part's two layers, behind its contents: the rings + pulse, and the shimmering edge
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
  root.style.isolation = 'isolate';
  const layer = function (css: string) {
    const l = document.createElement('span');
    l.setAttribute('aria-hidden', 'true'); l.setAttribute('data-role', 'projection');
    l.style.cssText = 'position:absolute;pointer-events:none;border-radius:inherit;z-index:-1;' + css;
    root.insertBefore(l, root.firstChild);
    return l;
  };
  const cs = getComputedStyle(root);
  const line = cs.borderTopStyle !== 'none' && cs.borderTopWidth !== '0px' ? cs.borderTopColor : 'rgb(61 189 180 / 0.35)';
  const scan = layer('inset:0;');
  const edge = layer('inset:0;border:1px solid ' + line + ';opacity:.7;');   // just inside its own line: a clipping part keeps it
  // The pulse lights everything it passes, not just the surface: the line, the corner ticks and a glow, shown only in a
  // band around the ring (a mask), over the contents (it has no fill, so text stays readable)
  const lit = document.createElement('span');
  lit.setAttribute('aria-hidden', 'true'); lit.setAttribute('data-role', 'projection');
  lit.style.cssText = 'position:absolute;inset:0;pointer-events:none;border-radius:inherit;z-index:2;display:none;' +
    'border:1px solid rgb(61 189 180 / 0.95);box-shadow:0 0 12px rgb(61 189 180 / 0.6), inset 0 0 12px rgb(61 189 180 / 0.3);';
  const ticks = getComputedStyle(root, '::before');
  if (ticks.backgroundImage && ticks.backgroundImage !== 'none') {   // the part's corner ticks (a ::before), copied so they light too
    lit.style.backgroundImage = ticks.backgroundImage; lit.style.backgroundSize = ticks.backgroundSize;
    lit.style.backgroundPosition = ticks.backgroundPosition; lit.style.backgroundRepeat = ticks.backgroundRepeat;
  }
  root.appendChild(lit);

  // Dropouts: now and then one side of the line or one corner tick flickers out and comes back, more often the farther
  // the part is from the orb. The corner ticks become four spans of the runtime's own (the ::before ones hide) so each
  // can drop alone; the sides flick the part's own border color.
  const corners: HTMLElement[] = [];
  if (ticks.backgroundImage && ticks.backgroundImage !== 'none') {
    const L = parseFloat(ticks.backgroundSize) || 12;
    const col = (ticks.backgroundImage.match(/rgba?\([^)]*\)/) || ['currentColor'])[0];
    if (!document.getElementById('al-projection-css')) {
      const st = document.createElement('style');
      st.id = 'al-projection-css'; st.textContent = '[data-projection-ticks]::before{visibility:hidden}';
      document.head.appendChild(st);
    }
    root.setAttribute('data-projection-ticks', '');
    [['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']].forEach(function (c) {
      const t = document.createElement('span');
      t.setAttribute('aria-hidden', 'true'); t.setAttribute('data-role', 'projection');
      t.style.cssText = 'position:absolute;pointer-events:none;box-sizing:border-box;z-index:1;width:' + L + 'px;height:' + L + 'px;' +
        c[0] + ':0;' + c[1] + ':0;border-' + c[0] + ':2px solid ' + col + ';border-' + c[1] + ':2px solid ' + col + ';';
      root.appendChild(t); corners.push(t);
    });
  }
  const hasLine = cs.borderTopStyle !== 'none' && cs.borderTopWidth !== '0px';
  const sides = hasLine ? ['Top', 'Right', 'Bottom', 'Left'] : [];
  let flick = 0, farness = 1;
  const timers: number[] = [];
  const dropout = function () {
    if (still() || document.hidden || !onScreen || !(sides.length + corners.length)) return;
    timers.length = 0;   // the last dropout is long over (≥ 2.8s ago)
    const n = Math.random() < 0.75 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const k = Math.floor(Math.random() * (sides.length + corners.length)), back = 380 + Math.random() * 700;
      if (k < sides.length) {
        const prop = 'border' + sides[k] + 'Color';
        const set = function (v: string) { (root.style as unknown as Record<string, string>)[prop] = v; };
        [[0, 'transparent'], [60, ''], [120, 'transparent'], [back, '']].forEach(function (step) {
          timers.push(window.setTimeout(function () { set(step[1] as string); }, step[0] as number));
        });
      } else {
        corners[k - sides.length].animate([{ opacity: 1 }, { opacity: 0, offset: 0.06 }, { opacity: 1, offset: 0.12 }, { opacity: 0, offset: 0.22 },
          { opacity: 0, offset: 0.8 }, { opacity: 1 }], { duration: back * 1.4 });
      }
    }
  };
  const schedule = function () {
    flick = window.setTimeout(function () { dropout(); schedule(); }, (5000 + Math.random() * 13000) / farness);
  };
  schedule();

  let pulseR = -1, raf = 0, pending = 0, ox = 0, oy = 0, far = 0, onScreen = true;
  const source = function () {
    const orb = document.querySelector('[data-role="orb"]');
    if (orb) { const o = orb.getBoundingClientRect(); if (o.width) return [o.left + o.width / 2, o.top + o.height / 2]; }
    return [window.innerWidth - 80, window.innerHeight - 80];
  };
  const paint = function () {
    const off = still() ? 0 : ((performance.now() / 1000) % pitch);   // the rings drift outward, 1px a second
    const at = 'circle at ' + ox.toFixed(1) + 'px ' + oy.toFixed(1) + 'px';
    const c = 'rgb(61 189 180 / ' + alpha + ')';
    const rings = 'repeating-radial-gradient(' + at + ', transparent 0 ' + off.toFixed(2) + 'px, ' + c + ' ' + off.toFixed(2) + 'px ' +
      (off + 1).toFixed(2) + 'px, transparent ' + (off + 1).toFixed(2) + 'px ' + pitch + 'px)';
    const p = pulseR >= 0 ? 'radial-gradient(' + at + ', transparent ' + Math.max(0, pulseR - 4) + 'px, rgb(61 189 180 / 0.5) ' + pulseR +
      'px, transparent ' + (pulseR + 4) + 'px), ' : '';
    scan.style.background = p + rings;
    if (pulseR >= 0) {
      const band = 'radial-gradient(' + at + ', transparent ' + Math.max(0, pulseR - 14) + 'px, #000 ' + pulseR + 'px, transparent ' + (pulseR + 14) + 'px)';
      lit.style.display = 'block';
      lit.style.setProperty('-webkit-mask-image', band); lit.style.setProperty('mask-image', band);
    } else lit.style.display = 'none';
  };
  const measure = function () {
    const r = root.getBoundingClientRect(), s = source();
    ox = s[0] - r.left; oy = s[1] - r.top;
    far = Math.max(Math.hypot(ox, oy), Math.hypot(ox - r.width, oy), Math.hypot(ox, oy - r.height), Math.hypot(ox - r.width, oy - r.height));
    const d = Math.hypot(s[0] - (r.left + r.width / 2), s[1] - (r.top + r.height / 2)), span = Math.hypot(window.innerWidth, window.innerHeight);
    farness = 0.7 + Math.min(1, d / span) * 0.9;   // 0.7 by the orb … 1.6 across the screen
    edge.style.filter = 'url(#al-shimmer-' + (d < span * 0.3 ? 0 : d < span * 0.65 ? 1 : 2) + ')';
    paint();
  };
  const later = function () { if (!pending) pending = requestAnimationFrame(function () { pending = 0; measure(); }); };
  const drift = function () { if (onScreen && pulseR < 0) paint(); };
  shared.paints.push(drift);
  // Only what's on screen moves: a hidden section's parts and anything scrolled away wait (and measure on their way back)
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(function (es) {
    const was = onScreen; onScreen = es[es.length - 1].isIntersecting;
    if (onScreen && !was) measure();
  }) : null;
  if (io) io.observe(root);
  const onPulse = function () {
    if (still() || !onScreen) return;
    cancelAnimationFrame(raf);
    const t0 = performance.now();
    const step = function () {
      pulseR = (performance.now() - t0) * 1.4;   // the same ring on every part: 1.4px a ms out from the orb
      if (pulseR > far + 8) { pulseR = -1; paint(); return; }
      paint(); raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  document.addEventListener('al-projection-pulse', onPulse);
  window.addEventListener('resize', later);
  window.addEventListener('scroll', later, true);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(later) : null;
  if (ro) { ro.observe(root); const orb = document.querySelector('[data-role="orb"]'); if (orb) ro.observe(orb); }
  measure();

  const cleanup = function () {
    const sh0 = W.__alProjection;
    if (sh0) sh0.paints = sh0.paints.filter(function (p) { return p !== drift; });
    if (io) io.disconnect();
    cancelAnimationFrame(raf); cancelAnimationFrame(pending); clearTimeout(flick);
    timers.forEach(function (t) { clearTimeout(t); });
    sides.forEach(function (sd) { (root.style as unknown as Record<string, string>)['border' + sd + 'Color'] = ''; });
    root.removeAttribute('data-projection-ticks');
    corners.forEach(function (c) { if (c.parentNode) c.parentNode.removeChild(c); });
    document.removeEventListener('al-projection-pulse', onPulse);
    window.removeEventListener('resize', later);
    window.removeEventListener('scroll', later, true);
    if (ro) ro.disconnect();
    [scan, edge, lit].forEach(function (l) { if (l.parentNode) l.parentNode.removeChild(l); });
    const sh = W.__alProjection;
    if (sh && --sh.count <= 0) { sh.off(); W.__alProjection = undefined; }
    (root as unknown as { __alProjection?: () => void }).__alProjection = undefined;
  };
  (root as unknown as { __alProjection?: () => void }).__alProjection = cleanup;
  return cleanup;
}
