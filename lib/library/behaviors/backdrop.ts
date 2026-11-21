// ── backdrop behavior runtime ─────────────────────────────────────
// A page's live backdrop (project.ts LiveBackdrop), on the fixed layer under the page. The CSS backdrop stays under it
// as the fallback: without script, without WebGL, or before the first frame, that's what shows.
//
// A <video> root: plays muted and looping (the export ships it without autoplay, so no-script and calm keep the
// poster); calm (prefers-reduced-motion) or a hidden tab: paused.
// Any other root: the sky — a WebGL nebula drifting slowly, with twinkling stars. Reads on the root:
//   data-colors  CSS colors, comma-separated: night, nebula, its glow, stars (var(--color-…) works; missing ones default)
//   data-stars   0–1, how many stars (default .5)       data-speed  0–1, drift (default .5)
// Draws at most 30 frames a second at ¾ resolution; stops while the tab is hidden; calm: one still frame.
// Uses WebGL 1, requestAnimationFrame, matchMedia, visibilitychange — Baseline widely available.
//
// SELF-CONTAINED ON PURPOSE (source is copied into exported pages) — see carousel.ts.

export function alchemyBackdrop(root: HTMLElement): () => void {
  const prevCleanup = (root as unknown as { __alBackdrop?: () => void }).__alBackdrop;
  if (prevCleanup) prevCleanup();
  const calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const done = function (c: () => void) { (root as unknown as { __alBackdrop?: () => void }).__alBackdrop = c; return c; };

  // ── A video ──
  if (root.tagName === 'VIDEO') {
    const v = root as HTMLVideoElement;
    v.muted = true; v.loop = true; v.playsInline = true;
    const sync = function () {
      if (document.hidden || (calm && calm.matches)) v.pause();
      else { const p = v.play(); if (p && p.catch) p.catch(function () { /* autoplay refused: the poster stays */ }); }
    };
    document.addEventListener('visibilitychange', sync);
    if (calm && calm.addEventListener) calm.addEventListener('change', sync);
    sync();
    return done(function () {
      document.removeEventListener('visibilitychange', sync);
      if (calm && calm.removeEventListener) calm.removeEventListener('change', sync);
      v.pause();
      (root as unknown as { __alBackdrop?: () => void }).__alBackdrop = undefined;
    });
  }

  // ── The sky ──
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity 1s;';
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false }) as WebGLRenderingContext | null;
  if (!gl) return done(function () { (root as unknown as { __alBackdrop?: () => void }).__alBackdrop = undefined; });
  root.appendChild(canvas);

  // CSS colors → rgb 0–1 (the browser resolves var(), names, hex)
  const probe = document.createElement('span');
  probe.style.display = 'none';
  root.appendChild(probe);
  const rgb = function (c: string, fallback: number[]): number[] {
    probe.style.color = '';
    probe.style.color = c;
    const m = /rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(getComputedStyle(probe).color);
    return m && probe.style.color ? [+m[1] / 255, +m[2] / 255, +m[3] / 255] : fallback;
  };
  const given = (root.getAttribute('data-colors') || '').split(',').map(function (c) { return c.trim(); });
  const defaults = [[0.04, 0.02, 0.08], [0.42, 0.23, 0.53], [0.97, 0.56, 0.02], [1, 0.96, 0.89]];
  const cols = defaults.map(function (d, i) { return given[i] ? rgb(given[i], d) : d; });
  root.removeChild(probe);
  const num = function (a: string, d: number) { const n = parseFloat(root.getAttribute(a) || ''); return isNaN(n) ? d : Math.max(0, Math.min(1, n)); };
  const stars = num('data-stars', 0.5), speed = num('data-speed', 0.5);

  const vs = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
  const fs = [
    'precision mediump float;',
    'uniform vec2 res; uniform float t, dens, scale; uniform vec3 c0, c1, c2, c3;',
    'float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }',
    'float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy / res.y;',
    '  float a = fbm(uv * 1.4 + vec2(t * 0.006, t * 0.003));',
    '  float b = fbm(uv * 2.8 - vec2(t * 0.004, 0.0) + a * 1.5);',
    '  vec3 col = mix(c0 * 1.6, c0, gl_FragCoord.y / res.y);',   // a little lighter toward the horizon
    '  col = mix(col, c1, smoothstep(0.35, 0.9, a) * 0.55);',
    '  col = mix(col, c2, smoothstep(0.6, 1.0, a * b * 1.9) * 0.28);',
    '  vec2 px = gl_FragCoord.xy / scale, cell = floor(px / 22.0), f = fract(px / 22.0) - 0.5;',
    '  float s = h(cell), on = 1.0 - dens * 0.12;',
    '  if (s > on) {',
    '    vec2 at = (vec2(h(cell + 1.3), h(cell + 2.7)) - 0.5) * 0.7;',
    '    float tw = 0.65 + 0.35 * sin(t * (0.4 + s * 1.6) + s * 40.0);',
    '    col += c3 * smoothstep(0.09, 0.0, length(f - at)) * tw * (0.5 + 0.5 * (s - on) / (1.0 - on));',
    '  }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}',
  ].join('\n');
  const shader = function (type: number, src: string) { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {   // a GPU that can't: the CSS backdrop stays
    root.removeChild(canvas);
    return done(function () { (root as unknown as { __alBackdrop?: () => void }).__alBackdrop = undefined; });
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = function (name: string) { return gl.getUniformLocation(prog, name); };
  ['c0', 'c1', 'c2', 'c3'].forEach(function (k, i) { gl.uniform3fv(u(k), cols[i]); });
  gl.uniform1f(u('dens'), stars);
  const uRes = u('res'), uT = u('t'), uScale = u('scale');

  const RES = 0.75;
  const size = function () {
    const w = Math.max(1, Math.round(root.clientWidth * RES)), h = Math.max(1, Math.round(root.clientHeight * RES));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uScale, RES);
  };
  let frame = 0, last = 0;
  const t0 = performance.now(), rate = 0.25 + speed * 1.5;
  const draw = function (now: number) {
    gl.uniform1f(uT, ((now - t0) / 1000) * rate + 50);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.style.opacity = '1';
  };
  const loop = function (now: number) {
    frame = requestAnimationFrame(loop);
    if (now - last < 33) return;   // 30 frames a second is plenty for a slow sky
    last = now;
    draw(now);
  };
  const sync = function () {
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    size();
    if (calm && calm.matches) { draw(t0); return; }   // still, not gone
    if (!document.hidden) frame = requestAnimationFrame(loop);
  };
  window.addEventListener('resize', sync);
  document.addEventListener('visibilitychange', sync);
  if (calm && calm.addEventListener) calm.addEventListener('change', sync);
  sync();

  return done(function () {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener('resize', sync);
    document.removeEventListener('visibilitychange', sync);
    if (calm && calm.removeEventListener) calm.removeEventListener('change', sync);
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    (root as unknown as { __alBackdrop?: () => void }).__alBackdrop = undefined;
  });
}
