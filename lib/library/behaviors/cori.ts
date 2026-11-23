// ── cori behavior runtime ─────────────────────────────────────────
// Cori, the site's guide, flying on the page: the butterfly drawn as projected overlay (her wings in her own fire,
// scanline rings from the orb across them, a signal rim that shimmers with distance from the orb, lights as the pulse
// passes and now and then drops out on one wing). She sparks out of the orb, then lands on what matters (the lit action,
// the selected tab, a link), rests on frame corners and visits the moth in the orb; between landings, every 8–20 s, an
// idle: a loop (40%), a frame corner (35%), the orb (25%). A section change sends her to what matters in it; the
// orb's ? (data-role="side") calls her to what you're on. Every landing sends a projection pulse. A 1px leader runs
// from her plate (the component's own box: the Cori component is her and her plate) to her while she's landed. She lands on top edges, so her
// wings sit above things, and never takes a pointer (pointer-events: none). Calm (prefers-reduced-motion): no flight
// or idles: she appears where she lands, still.
// One Cori per page: the first that attaches flies. In a component preview (no .page-main) she perches on her plate.
//
// SELF-CONTAINED ON PURPOSE (source is copied into exported pages) — see carousel.ts.

export function alchemyCori(root: HTMLElement): () => void {
  type Win = Window & { __alCori?: HTMLElement };
  const W = window as Win;
  const prevCleanup = (root as unknown as { __alCori?: () => void }).__alCori;
  if (prevCleanup) prevCleanup();
  // On a page (an export, Live) she flies, one Cori per page. Anywhere else (a component preview in the workbench) she
  // perches on her plate's top edge and only breathes: never flying over the workbench, but there to be seen and styled.
  const onPage = !!document.querySelector('.page-main');
  if (onPage && W.__alCori && W.__alCori !== root && document.contains(W.__alCori)) return function () {};
  if (onPage) W.__alCori = root;

  const calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const still = function () { return !!(calm && calm.matches); };
  const SIG = 'rgb(61 189 180)', VB = { x: 18, y: 28, w: 84, h: 50 };
  const LEFT = ["M58.4 51.6 L55.6 51.3 L51.5 51.6 L47.1 52.1 L43.3 52.7 L40.0 53.2 L36.9 53.9 L34.1 54.7 L31.9 55.8 L30.0 57.2 L28.6 58.8 L27.6 60.7 L27.3 62.6 L27.7 64.7 L28.7 66.9 L30.2 69.1 L31.9 71.0 L33.8 72.5 L36.1 73.9 L38.6 74.9 L41.0 75.5 L43.4 75.7 L45.9 75.5 L48.3 74.9 L50.5 74.0 L52.4 72.8 L54.2 71.3 L55.7 69.5 L56.9 67.5 L57.8 65.2 L58.3 62.6 L58.6 59.9 L58.8 57.7 L59.2 55.7 L59.7 53.9 L59.6 52.5Z", "M58.5 47.0 L56.2 46.2 L52.9 45.6 L49.2 45.1 L45.6 44.7 L42.1 44.4 L38.5 44.2 L35.0 44.2 L31.9 44.3 L29.1 44.7 L26.5 45.1 L24.4 45.8 L22.8 46.6 L21.8 47.7 L21.4 48.9 L21.5 50.2 L22.0 51.6 L23.1 53.0 L24.8 54.5 L26.8 56.0 L28.9 57.3 L31.1 58.3 L33.5 59.1 L35.9 59.8 L38.0 60.3 L39.7 60.9 L41.1 61.3 L42.5 61.6 L44.1 61.5 L46.0 60.8 L48.2 59.8 L50.4 58.5 L52.4 57.3 L54.3 56.0 L56.0 54.7 L57.5 53.3 L58.5 51.9 L59.2 50.6 L59.7 49.3 L59.6 48.0Z", "M59.2 48.3 L58.0 47.9 L56.2 47.6 L54.1 47.3 L52.1 47.1 L50.2 46.9 L48.2 46.8 L46.3 46.8 L44.6 46.9 L43.0 47.1 L41.6 47.3 L40.4 47.7 L39.6 48.1 L39.0 48.7 L38.8 49.4 L38.8 50.1 L39.1 50.9 L39.8 51.7 L40.7 52.5 L41.8 53.3 L42.9 54.0 L44.1 54.6 L45.4 55.0 L46.8 55.4 L47.9 55.7 L48.9 56.0 L49.6 56.3 L50.4 56.4 L51.3 56.3 L52.4 56.0 L53.6 55.4 L54.8 54.7 L55.9 54.0 L56.9 53.3 L57.9 52.6 L58.7 51.8 L59.2 51.1 L59.6 50.3 L59.9 49.6 L59.8 48.9Z"], RIGHT = ["M61.6 51.6 L64.4 51.3 L68.5 51.6 L72.9 52.1 L76.7 52.7 L80.0 53.2 L83.1 53.9 L85.9 54.7 L88.1 55.8 L90.0 57.2 L91.4 58.8 L92.4 60.7 L92.7 62.6 L92.3 64.7 L91.3 66.9 L89.8 69.1 L88.1 71.0 L86.2 72.5 L83.9 73.9 L81.4 74.9 L79.0 75.5 L76.6 75.7 L74.1 75.5 L71.7 74.9 L69.5 74.0 L67.6 72.8 L65.8 71.3 L64.3 69.5 L63.1 67.5 L62.2 65.2 L61.7 62.6 L61.4 59.9 L61.2 57.7 L60.8 55.7 L60.3 53.9 L60.4 52.5Z", "M61.5 47.0 L63.8 46.2 L67.1 45.6 L70.8 45.1 L74.4 44.7 L77.9 44.4 L81.5 44.2 L85.0 44.2 L88.1 44.3 L90.9 44.7 L93.5 45.1 L95.6 45.8 L97.2 46.6 L98.2 47.7 L98.6 48.9 L98.5 50.2 L98.0 51.6 L96.9 53.0 L95.2 54.5 L93.2 56.0 L91.1 57.3 L88.9 58.3 L86.5 59.1 L84.1 59.8 L82.0 60.3 L80.3 60.9 L78.9 61.3 L77.5 61.6 L75.9 61.5 L74.0 60.8 L71.8 59.8 L69.6 58.5 L67.6 57.3 L65.7 56.0 L64.0 54.7 L62.5 53.3 L61.5 51.9 L60.8 50.6 L60.3 49.3 L60.4 48.0Z", "M60.9 48.3 L62.1 47.9 L63.9 47.6 L66.0 47.3 L68.0 47.1 L69.9 46.9 L71.9 46.8 L73.8 46.8 L75.5 46.9 L77.1 47.1 L78.5 47.3 L79.7 47.7 L80.5 48.1 L81.1 48.7 L81.3 49.4 L81.3 50.1 L81.0 50.9 L80.3 51.7 L79.4 52.5 L78.3 53.3 L77.2 54.0 L76.0 54.6 L74.7 55.0 L73.3 55.4 L72.2 55.7 L71.2 56.0 L70.5 56.3 L69.7 56.4 L68.8 56.3 L67.7 56.0 L66.5 55.4 L65.3 54.7 L64.2 54.0 L63.2 53.3 L62.2 52.6 L61.4 51.8 L60.9 51.1 L60.5 50.3 L60.2 49.6 L60.3 48.9Z"];
  const FILLS = [['#D64010', 0.85], ['#FFA828', 0.85], ['#FFEC96', 0.7]];
  const ns = 'http://www.w3.org/2000/svg';
  // data-cori-size: sm / md / lg (36 / 48 / 60px wide), else by the screen (40 on phones, 52 wider); data-cori-alpha: 0–1
  const sizes: Record<string, number> = { sm: 36, md: 48, lg: 60 };
  const size = function () { return sizes[root.getAttribute('data-cori-size') || ''] || (window.innerWidth < 600 ? 40 : 52); };
  const alpha = Math.max(0.3, Math.min(1, parseFloat(root.getAttribute('data-cori-alpha') || '') || 0.85));

  // ── her drawing ──
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true'); host.setAttribute('data-role', 'cori');
  host.style.cssText = onPage ? 'position:fixed;left:0;top:0;pointer-events:none;z-index:60;will-change:transform;opacity:0;'
    : 'position:absolute;right:16px;bottom:calc(100% - 2px);pointer-events:none;z-index:2;opacity:0;';
  const glow = document.createElement('div');
  glow.style.cssText = 'position:absolute;inset:-35%;border-radius:50%;background:radial-gradient(closest-side, rgb(248 143 5 / 0.28), transparent);';
  host.appendChild(glow);
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', VB.x + ' ' + VB.y + ' ' + VB.w + ' ' + VB.h);
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;';
  const uid = 'al-cori-' + Math.random().toString(36).slice(2, 7);
  const defs = document.createElementNS(ns, 'defs');
  const clip = document.createElementNS(ns, 'clipPath'); clip.setAttribute('id', uid + '-clip');
  const grad = document.createElementNS(ns, 'radialGradient');
  grad.setAttribute('id', uid + '-rings'); grad.setAttribute('gradientUnits', 'userSpaceOnUse'); grad.setAttribute('spreadMethod', 'repeat');
  [[0, 0], [0.62, 0], [0.62, 0.22], [0.95, 0.22], [0.95, 0]].forEach(function (s) {
    const st = document.createElementNS(ns, 'stop');
    st.setAttribute('offset', String(s[0])); st.setAttribute('stop-color', SIG); st.setAttribute('stop-opacity', String(s[1]));
    grad.appendChild(st);
  });
  defs.appendChild(clip); defs.appendChild(grad); svg.appendChild(defs);
  const side = function (paths: string[]) {
    const g = document.createElementNS(ns, 'g'), rims: SVGPathElement[] = [];
    paths.forEach(function (d, i) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d); p.setAttribute('fill', FILLS[i][0] as string); p.setAttribute('fill-opacity', String(FILLS[i][1]));
      g.appendChild(p);
      const c = document.createElementNS(ns, 'path'); c.setAttribute('d', d); clip.appendChild(c);
    });
    const rings = document.createElementNS(ns, 'rect');
    rings.setAttribute('x', String(VB.x)); rings.setAttribute('y', String(VB.y)); rings.setAttribute('width', String(VB.w)); rings.setAttribute('height', String(VB.h));
    rings.setAttribute('fill', 'url(#' + uid + '-rings)'); rings.setAttribute('clip-path', 'url(#' + uid + '-clip)');
    g.appendChild(rings);
    paths.slice(0, 2).forEach(function (d) {
      const r = document.createElementNS(ns, 'path') as SVGPathElement;
      r.setAttribute('d', d); r.setAttribute('fill', 'none'); r.setAttribute('stroke', SIG); r.setAttribute('stroke-opacity', '0.9');
      r.setAttribute('stroke-width', '1'); r.setAttribute('vector-effect', 'non-scaling-stroke');
      g.appendChild(r); rims.push(r);
    });
    svg.appendChild(g);
    return { g: g, rims: rims };
  };
  const left = side(LEFT), right = side(RIGHT);
  const body = document.createElementNS(ns, 'rect');
  body.setAttribute('x', '58.5'); body.setAttribute('y', '34'); body.setAttribute('width', '3'); body.setAttribute('height', '23'); body.setAttribute('rx', '1.5');
  body.setAttribute('fill', '#FFBE50'); body.setAttribute('fill-opacity', '0.9');
  svg.appendChild(body);
  host.appendChild(svg);
  if (onPage) document.body.appendChild(host);
  else {   // perched: her plate holds her (a pinned plate's page offsets don't apply in a preview)
    root.style.position = 'relative'; root.style.bottom = 'auto'; root.style.right = 'auto'; root.style.overflow = 'visible';
    root.appendChild(host);
  }
  host.style.opacity = String(alpha);   // see-through: the stars show through her wings
  const rims = left.rims.concat(right.rims);

  // Her leader: from her plate to her, while she's landed
  const lead = document.createElementNS(ns, 'svg');
  lead.setAttribute('aria-hidden', 'true');
  lead.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:59;overflow:visible;';
  const line = document.createElementNS(ns, 'path');
  line.setAttribute('fill', 'none'); line.setAttribute('stroke', SIG); line.setAttribute('stroke-opacity', '0.7'); line.setAttribute('stroke-width', '1');
  lead.appendChild(line);
  if (onPage) document.body.appendChild(lead);

  // ── where things are ──
  type Spot = { el: Element; at: 'edge' | 'tl' | 'tr' | 'orb' };
  const shown = function (el: Element) {
    const r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8 && r.top > 48 && r.bottom < window.innerHeight - 8 && r.left >= 0 && r.right <= window.innerWidth && !root.contains(el);
  };
  const orbEl = function () { return document.querySelector('[data-role="orb"]'); };
  const pointOf = function (s: Spot): [number, number] {
    const r = s.el.getBoundingClientRect();
    if (s.at === 'orb') return [r.left + r.width / 2, r.top + 4];
    if (s.at === 'tl') return [r.left + 10, r.top + 1];
    if (s.at === 'tr') return [r.right - 10, r.top + 1];
    return [r.right - Math.min(18, r.width * 0.3), r.top + 1];
  };
  const pick = function <T>(xs: T[]): T | null { return xs.length ? xs[Math.floor(Math.random() * xs.length)] : null; };
  const all = function (sel: string) { return Array.prototype.slice.call(document.querySelectorAll(sel)) as Element[]; };
  const actions = function () {
    return all('a[href], button, [role="tab"]').filter(function (el) { return shown(el) && !el.closest('[data-role="orb"]') && !(el as HTMLElement).closest('[data-role="side"]'); });
  };
  const frames = function () {
    return all('[data-behavior~="projection"]').filter(function (el) { const r = el.getBoundingClientRect(); return r.width > 140 && r.height > 90 && shown(el); });
  };
  // What matters on what's showing: the lit action, the selected tab, the current link, else any action
  const matters = function (): Spot | null {
    const lit = actions().filter(function (el) { return el.hasAttribute('data-alive') || el.getAttribute('aria-selected') === 'true' || el.hasAttribute('aria-current'); });
    const el = pick(lit) || pick(actions());
    return el ? { el: el, at: 'edge' } : corner();
  };
  const corner = function (): Spot | null { const f = pick(frames()); return f ? { el: f, at: Math.random() < 0.5 ? 'tl' : 'tr' } : null; };
  const tank = function (): Spot | null { const o = orbEl(); return o && o.getBoundingClientRect().width ? { el: o, at: 'orb' } : null; };

  // ── flight ──
  let orbAt = 0, orbBox: DOMRect | null = null, rimFilter = '-';
  let x = 0, y = 0, landed: Spot | null = null, flight: { x0: number; y0: number; cx: number; cy: number; to: Spot | null; tx: number; ty: number; t0: number; dur: number; then?: Spot | null } | null = null;
  let raf = 0, idle = 0, phase = 0, last = performance.now(), angle = 0, spawn = 0;
  const place = function () {
    const s = size(), h = s * VB.h / VB.w;
    host.style.width = s + 'px'; host.style.height = h + 'px';
    host.style.transform = onPage ? 'translate(' + (x - s / 2).toFixed(1) + 'px,' + (y - h).toFixed(1) + 'px) rotate(' + angle.toFixed(1) + 'deg) scale(' + Math.min(1, spawn).toFixed(2) + ')' : '';
    // rings from the orb, in her drawing's units (her box from where she is; the orb looked up 4 times a second)
    const now = performance.now();
    if (now - orbAt > 250) { const o = orbEl(); orbBox = o ? o.getBoundingClientRect() : null; orbAt = now; }
    const r = onPage ? { left: x - s / 2, top: y - h, width: s } : host.getBoundingClientRect();
    if (orbBox && orbBox.width && r.width) {
      const b = orbBox, k = VB.w / r.width;
      grad.setAttribute('cx', String(VB.x + (b.left + b.width / 2 - r.left) * k)); grad.setAttribute('cy', String(VB.y + (b.top + b.height / 2 - r.top) * k));
      grad.setAttribute('r', String(3 * k)); grad.setAttribute('fx', grad.getAttribute('cx') || '0'); grad.setAttribute('fy', grad.getAttribute('cy') || '0');
      const d = Math.hypot(b.left - x, b.top - y), span = Math.hypot(window.innerWidth, window.innerHeight);
      const f = document.getElementById('al-shimmer-' + (d < span * 0.3 ? 0 : d < span * 0.65 ? 1 : 2));
      const want = f ? 'url(#' + f.id + ')' : '';
      if (want !== rimFilter) { rimFilter = want; rims.forEach(function (p) { p.style.filter = want; }); }   // only when it changes
    }
    // the leader, plate → her, only while she sits, routed around the rest of the UI (re-routed twice a second)
    if (onPage && landed && !flight && speaking && root.getBoundingClientRect().width) {
      if (now - routedAt > 500 || Math.hypot(x - routedX, y - routedY) > 2) { line.setAttribute('d', route()); routedAt = now; routedX = x; routedY = y; }
      line.style.opacity = '1';
    } else line.style.opacity = '0';
  };
  // The leader's path: square bends through the gaps. Candidates: straight; one bend (either way); out to a lane beside
  // or between the blocks (a column clear of them, or a row) and along it. The shortest that crosses no block wins
  // (crossing costs far more than length). Blocks: frames and projected parts, links, buttons, the orb; not her plate,
  // and not what she sits on or what holds it (the line has to arrive there).
  let routedAt = 0, routedX = -1, routedY = -1;

  // ── her plate shows only while she speaks: when she lands somewhere new this visit (not a rest on a corner or a visit
  // to the orb), or wherever the orb's ? sent her; it stays long enough to read (4–9 s by the line's length), then fades.
  // In a preview it always shows. Calm: it appears and goes without the fade.
  let speaking = false, speakT = 0, hideT = 0, calling = false;
  const said: Element[] = [];
  const plate = function (on: boolean) {
    speaking = on; clearTimeout(hideT);
    root.style.transition = still() ? '' : 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)';
    if (on) { root.style.visibility = ''; root.style.opacity = ''; }
    else { root.style.opacity = '0'; hideT = window.setTimeout(function () { if (!speaking) root.style.visibility = 'hidden'; }, still() ? 0 : 220); }
  };
  const landedOn = function (s: Spot | null) {
    if (!s || s.at !== 'edge' || (!calling && said.indexOf(s.el) >= 0)) { calling = false; return; }
    calling = false; said.push(s.el);
    plate(true); clearTimeout(speakT);
    const n = (root.textContent || '').length;
    speakT = window.setTimeout(function () { plate(false); }, Math.max(4000, Math.min(9000, 2500 + n * 60)));
  };
  if (onPage) plate(false);
  const route = function (): string {
    type R = { l: number; t: number; r: number; b: number };
    const box = function (el: Element): R { const q = el.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
    const E: [number, number] = [x, y + 2], pr = box(root), pad = 6;
    const blocks = all('[data-behavior~="projection"], [data-role="orb"], a[href], button, [role="tab"]').filter(function (el) {
      if (root.contains(el) || el.contains(root)) return false;
      const q = box(el);
      if (q.r - q.l < 4 || q.b - q.t < 4) return false;
      return !(E[0] >= q.l - 2 && E[0] <= q.r + 2 && E[1] >= q.t - 4 && E[1] <= q.b + 2);   // holds or carries her: the line ends there
    }).map(box);
    const cross = function (a: [number, number], b: [number, number]): number {   // how much of a→b runs through blocks
      let sum = 0;
      for (let i = 0; i < blocks.length; i++) {
        const q = blocks[i];
        if (a[0] === b[0]) { if (a[0] > q.l && a[0] < q.r) sum += Math.max(0, Math.min(Math.max(a[1], b[1]), q.b) - Math.max(Math.min(a[1], b[1]), q.t)); }
        else if (a[1] === b[1]) { if (a[1] > q.t && a[1] < q.b) sum += Math.max(0, Math.min(Math.max(a[0], b[0]), q.r) - Math.max(Math.min(a[0], b[0]), q.l)); }
        else { for (let k = 1; k < 24; k++) { const px = a[0] + (b[0] - a[0]) * k / 24, py = a[1] + (b[1] - a[1]) * k / 24; if (px > q.l && px < q.r && py > q.t && py < q.b) sum += Math.hypot(b[0] - a[0], b[1] - a[1]) / 24; } }
      }
      return sum;
    };
    const starts: [number, number][] = [
      [Math.min(Math.max(E[0], pr.l + 8), pr.r - 8), E[1] < pr.t ? pr.t : pr.b], [pr.l, (pr.t + pr.b) / 2], [pr.r, (pr.t + pr.b) / 2],
    ];
    const xs = [pad, window.innerWidth - pad], ys: number[] = [];
    blocks.forEach(function (q) { xs.push(q.l - pad, q.r + pad); ys.push(q.t - pad, q.b + pad); });
    let best: [number, number][] = [starts[0], E], bestCost = Infinity;
    const consider = function (pts: [number, number][]) {
      let len = 0, hit = 0;
      for (let i = 1; i < pts.length; i++) { len += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]); hit += cross(pts[i - 1], pts[i]); }
      const cost = len + hit * 50 + (pts.length - 2) * 12;   // a bend costs a little: fewer, cleaner paths
      if (cost < bestCost) { bestCost = cost; best = pts; }
    };
    starts.forEach(function (S) {
      consider([S, E]);
      consider([S, [S[0], E[1]], E]); consider([S, [E[0], S[1]], E]);
      xs.forEach(function (gx) { if (gx > 0 && gx < window.innerWidth) consider([S, [gx, S[1]], [gx, E[1] - 10], [E[0], E[1] - 10], E]); });
      ys.forEach(function (gy) { if (gy > 0 && gy < window.innerHeight) consider([S, [S[0], gy], [E[0], gy], E]); });
    });
    return best.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
  };
  const flap = function (k: number) {
    [left.g, right.g].forEach(function (g) { g.setAttribute('transform', 'translate(60 0) scale(' + k.toFixed(3) + ' 1) translate(-60 0)'); });
  };
  const flyTo = function (to: Spot | null, via?: [number, number]) {
    if (!to && !via) { schedule(); return; }   // nothing to land on now: try again at the next idle
    const p = via || pointOf(to as Spot);
    if (still()) { x = p[0]; y = p[1]; landed = to; flight = null; pulse(); landedOn(to); place(); return; }
    const d = Math.hypot(p[0] - x, p[1] - y), bend = (Math.random() < 0.5 ? -1 : 1) * d * (0.2 + Math.random() * 0.25);
    const mx = (x + p[0]) / 2, my = (y + p[1]) / 2, nx = -(p[1] - y) / (d || 1), ny = (p[0] - x) / (d || 1);
    flight = { x0: x, y0: y, cx: mx + nx * bend, cy: my + ny * bend - d * 0.15, to: via ? null : to, tx: p[0], ty: p[1], t0: performance.now(), dur: Math.max(700, Math.min(2200, d / 0.45)) };
    landed = null;
    if (via) flight.then = to;
  };
  const pulse = function () { document.dispatchEvent(new CustomEvent('al-projection-pulse')); };
  const schedule = function () {
    clearTimeout(idle);
    if (still()) return;
    idle = window.setTimeout(function () {
      const r = Math.random();
      if (r < 0.4) {   // a loop: out over the page, then down on something that matters
        const vx = 60 + Math.random() * (window.innerWidth - 120), vy = 80 + Math.random() * (window.innerHeight * 0.5);
        flyTo(matters(), [vx, vy]);
      } else if (r < 0.75) flyTo(corner() || matters());
      else flyTo(tank() || corner());
    }, 8000 + Math.random() * 12000);
  };
  const tick = function (now: number) {
    const dt = Math.min(64, now - last); last = now;
    if (spawn < 1) spawn = Math.min(1, spawn + dt / 400);
    if (!onPage) {   // perched: breathing only
      phase += dt * 0.004;
      flap(still() ? 0.8 : 0.55 + 0.45 * Math.abs(Math.cos(phase)));
      place(); raf = requestAnimationFrame(tick); return;
    }
    if (flight) {
      const f = flight, t = Math.min(1, (now - f.t0) / f.dur), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      if (f.to) { const p = pointOf(f.to); f.tx = p[0]; f.ty = p[1]; }   // its target may have moved (scroll, layout)
      const u = 1 - e, nxp = u * u * f.x0 + 2 * u * e * f.cx + e * e * f.tx, nyp = u * u * f.y0 + 2 * u * e * f.cy + e * e * f.ty;
      const heading = Math.atan2(nyp - y, nxp - x) * 180 / Math.PI + 90;
      angle += (Math.max(-35, Math.min(35, ((heading + 540) % 360) - 180)) - angle) * 0.15;
      x = nxp; y = nyp; phase += dt * 0.03;
      flap(0.3 + 0.7 * Math.abs(Math.cos(phase)));
      if (t >= 1) {
        const then = f.then;
        flight = null;
        if (then !== undefined) { if (then) flyTo(then); else schedule(); }
        else { landed = f.to; angle = 0; pulse(); landedOn(f.to); schedule(); }
      }
    } else {
      if (landed) { if (shown(landed.el) || landed.at === 'orb') { const p = pointOf(landed); x = p[0]; y = p[1]; } else { landed = null; flyTo(matters()); } }
      angle *= 0.85; phase += dt * 0.004;
      flap(still() ? 0.8 : 0.55 + 0.45 * Math.abs(Math.cos(phase)));   // resting: slow, half open (calm: still)
    }
    place();
    raf = requestAnimationFrame(tick);
  };

  // ── the projection on her: the pulse lights her rim as it passes; now and then one wing's rim drops out ──
  const onPulse = function () {
    const o = orbEl(); if (!o || still()) return;
    const b = o.getBoundingClientRect(), d = Math.hypot(b.left + b.width / 2 - x, b.top + b.height / 2 - y);
    window.setTimeout(function () {
      rims.forEach(function (p) { p.animate([{ strokeOpacity: 1, strokeWidth: 2 }, { strokeOpacity: 0.9, strokeWidth: 1 }], { duration: 360, easing: 'ease-out' }); });
    }, d / 1.4);
  };
  let drop = 0;
  const dropout = function () {
    drop = window.setTimeout(function () {
      if (!still()) { const w = pick([left.rims, right.rims]) as SVGPathElement[]; w.forEach(function (p) { p.animate([{ opacity: 1 }, { opacity: 0, offset: 0.08 }, { opacity: 1, offset: 0.16 }, { opacity: 0, offset: 0.26 }, { opacity: 0, offset: 0.8 }, { opacity: 1 }], { duration: 500 + Math.random() * 800 }); }); }
      dropout();
    }, 5000 + Math.random() * 13000);
  };
  const onHash = function () { window.setTimeout(function () { flyTo(matters()); }, 500); };   // after the draw-in starts
  const onCall = function (e: Event) {
    const t = e.target as Element | null;
    if (!t || !t.closest('[data-role="side"]')) return;
    const a = document.activeElement;
    calling = true;
    flyTo(a && a !== document.body && !a.closest('[data-role="side"]') && !a.closest('[data-role="orb"]') && shown(a) ? { el: a, at: 'edge' } : matters());
  };
  document.addEventListener('al-projection-pulse', onPulse);
  if (onPage) { window.addEventListener('hashchange', onHash); document.addEventListener('click', onCall, true); }

  // She sparks out of the orb, then lands on what matters; coming from another page of the site, she's where she was
  const onLeave = function () { try { sessionStorage.setItem('al-cori', JSON.stringify({ x: x, y: y, t: Date.now() })); } catch { /* private mode */ } };
  if (onPage) window.addEventListener('pagehide', onLeave);
  let was: { x: number; y: number; t: number } | null = null;
  try { was = JSON.parse(sessionStorage.getItem('al-cori') || 'null'); } catch { was = null; }
  const o = orbEl();
  if (was && Date.now() - was.t < 4000) { x = was.x; y = was.y; spawn = 1; }
  else if (o) { const b = o.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top + b.height / 2; } else { x = window.innerWidth - 80; y = window.innerHeight - 80; }
  if (!onPage) { spawn = 1; if (!still()) dropout(); }
  else if (still()) { spawn = 1; flyTo(matters() || tank()); }
  else { window.setTimeout(function () { flyTo(matters() || tank()); }, 900); dropout(); }
  raf = requestAnimationFrame(tick);

  const cleanup = function () {
    cancelAnimationFrame(raf); clearTimeout(idle); clearTimeout(drop); clearTimeout(speakT); clearTimeout(hideT);
    root.style.opacity = ''; root.style.visibility = ''; root.style.transition = '';
    document.removeEventListener('al-projection-pulse', onPulse);
    window.removeEventListener('hashchange', onHash);
    window.removeEventListener('pagehide', onLeave);
    document.removeEventListener('click', onCall, true);
    if (host.parentNode) host.parentNode.removeChild(host);
    if (lead.parentNode) lead.parentNode.removeChild(lead);
    if (W.__alCori === root) W.__alCori = undefined;
    (root as unknown as { __alCori?: () => void }).__alCori = undefined;
  };
  (root as unknown as { __alCori?: () => void }).__alCori = cleanup;
  return cleanup;
}
