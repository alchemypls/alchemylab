import type { SketchElement } from './project';

// ── Partial (precise) erasing for sketch elements ────────────────
// Erasing cuts only what's under the eraser circle:
//   stroke        → points inside the circle are removed; the rest splits into separate strokes
//   rect / circle → touched outline is converted to a stroke polyline first, then cut the same way
//   image         → never erased (delete via select)
// Strokes are densified before cutting so gaps land at the eraser edge, not at sparse sample points.

type Pt = [number, number];
type Stroke = Extract<SketchElement, { type: 'stroke' }>;

const STEP = 3; // max spacing (page px) between points after densifying

const segDist = ([x, y]: Pt, [ax, ay]: Pt, [bx, by]: Pt) => {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
};

export function densify(points: Pt[], pressures?: number[]): { points: Pt[]; pressures?: number[] } {
  const out: Pt[] = [points[0]];
  const outP: number[] | undefined = pressures && [pressures[0]];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / STEP));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      if (outP && pressures) outP.push(pressures[i - 1] + (pressures[i] - pressures[i - 1]) * t);
    }
  }
  return { points: out, pressures: outP };
}

function outline(el: SketchElement): Pt[] | null {
  if (el.type === 'rect') {
    const { x, y, w, h } = el;
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  }
  if (el.type === 'circle') {
    const n = Math.max(24, Math.ceil((2 * Math.PI * el.r) / STEP));
    return Array.from({ length: n + 1 }, (_, i): Pt => {
      const a = (i / n) * Math.PI * 2;
      return [el.cx + el.r * Math.cos(a), el.cy + el.r * Math.sin(a)];
    });
  }
  return null;
}

// Cuts a stroke with the eraser circle; returns null if the stroke isn't touched.
function cutStroke(s: Stroke, c: Pt, r: number): Stroke[] | null {
  const touched = s.points.length === 1
    ? Math.hypot(s.points[0][0] - c[0], s.points[0][1] - c[1]) <= r
    : s.points.some((p, i) => i > 0 && segDist(c, s.points[i - 1], p) <= r);
  if (!touched) return null;

  const d = densify(s.points, s.pressures);
  const runs: Stroke[] = [];
  let cur: number[] = [];
  const flush = () => {
    if (cur.length >= 2) {
      runs.push({
        ...s,
        id: `${s.id}~${runs.length}-${Date.now().toString(36)}`,
        points: cur.map((i) => d.points[i]),
        pressures: d.pressures && cur.map((i) => d.pressures![i]),
      });
    }
    cur = [];
  };
  d.points.forEach(([x, y], i) => {
    if (Math.hypot(x - c[0], y - c[1]) <= r) flush();
    else cur.push(i);
  });
  flush();
  return runs;
}

// Returns `els` unchanged (same reference) when nothing was erased — callers rely on that for undo.
export function eraseAt(els: SketchElement[], c: Pt, r: number): SketchElement[] {
  let changed = false;
  const out: SketchElement[] = [];
  for (const el of els) {
    if (el.type === 'image') { out.push(el); continue; }
    const asStroke: Stroke | null =
      el.type === 'stroke' ? el
      : (() => { const pts = outline(el); return pts && { id: el.id, type: 'stroke', color: el.color, points: pts }; })();
    const cut = asStroke && cutStroke(asStroke, c, r);
    if (!cut) { out.push(el); continue; }
    changed = true;
    out.push(...cut);
  }
  return changed ? out : els;
}
