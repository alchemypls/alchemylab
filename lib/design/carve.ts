// Erasing a shape on Fab cuts it for real: its eraser marks are taken out of its outline, and what's left becomes a
// polygon (or several, when the eraser cut it in two). So the cut shows everywhere the outline does: a roof's walls, a
// solid's sides, the top-down view, a resize. A mark wholly inside the shape can't be cut out of one outline: it stays
// a mark (a hole), now an exact region. Lines, text and images keep their marks as masks. Pure; relative imports only.

import { difference, type MultiPolygon, type Pair, type Polygon } from 'polygon-clipping';
import type { DesignPage } from './types';
import {
  boundsOf, mapPt, newId, outlineOf, planeOf, PLANES, polyFrom, ROOF_LIFT, rotatePt, rotationOf,
  type Plane, type Pt, type Rub, type VElement,
} from './vector';

const CARVABLE = ['rect', 'ellipse', 'capsule', 'poly'];
export const carvable = (e: VElement) => CARVABLE.includes(e.type) && !(e.type === 'poly' && e.open) && !!e.erased?.length;

const ring = (pts: Pt[]): Pair[] => pts.map((p) => [p.x, p.y]);
const circle = (c: Pt, r: number, n = 12): Pt[] => Array.from({ length: n }, (_, i) => ({ x: c.x + r * Math.cos((i / n) * 2 * Math.PI), y: c.y + r * Math.sin((i / n) * 2 * Math.PI) }));

// An eraser mark as regions, in the coordinates its points are in: a band as itself; a brush stroke as its dabs (round or
// square) and the strip between each pair
function regions(r: Rub, o: Pt): Polygon[] {
  const pts: Pt[] = [];
  for (let k = 0; k + 1 < r.pts.length; k += 2) pts.push({ x: o.x + r.pts[k], y: o.y + r.pts[k + 1] });
  if (r.area) return pts.length >= 3 ? [[ring(pts)]] : [];
  const h = r.size / 2, out: Polygon[] = [];
  for (const p of pts) out.push([ring(r.square ? [{ x: p.x - h, y: p.y - h }, { x: p.x + h, y: p.y - h }, { x: p.x + h, y: p.y + h }, { x: p.x - h, y: p.y + h }] : circle(p, h))]);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 0.01) continue;
    const nx = (-(b.y - a.y) / len) * h, ny = ((b.x - a.x) / len) * h;
    out.push([ring([{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }])]);
  }
  return out;
}

// One element's cut: the pieces left, as elements (the first keeps its id), or [] when nothing is left
export function carve(e: VElement, all: VElement[]): VElement[] {
  if (!carvable(e)) return [e];
  const b = boundsOf(e, all), o = { x: b.x, y: b.y };   // marks are measured from the unturned box's top-left
  let left: MultiPolygon;
  try { left = difference([ring(outlineOf(e))], ...e.erased!.flatMap((r) => regions(r, o))); }
  catch { return [e]; }   // a degenerate outline: leave it as it was
  const m = planeOf(e), deg = rotationOf(e), c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const pieces = left.filter((poly) => poly[0].length >= 4);   // a closed ring repeats its first point
  return pieces.map(([outer, ...holes], i) => {
    const f = polyFrom(outer.slice(0, -1).map(([x, y]) => ({ x, y })));
    // Where the new box goes so every point draws where it did: in a plane, (x, y) is where the box's corner lands;
    // turned, the box turns about its own middle, so it shifts by how far that middle moved
    let at: Pt = { x: f.x, y: f.y };
    const extra: Record<string, number> = {};
    if (m) {   // (x, y) is a corner on the floor: a roof's slope doesn't move it, it changes the lift there
      const plane = (e as { plane: Plane }).plane, roof = e as { slope?: number; slopeAlong?: 'w' | 'h'; lift?: number };
      const q = mapPt(PLANES[plane], { x: f.x - o.x, y: f.y - o.y });
      at = { x: o.x + q.x, y: o.y + q.y };
      if (plane === 'roof' && roof.slope) extra.lift = r1((roof.lift ?? ROOF_LIFT) + roof.slope * (roof.slopeAlong === 'w' ? f.x - o.x : f.y - o.y));
    }
    else if (deg) {
      const c2 = { x: f.x + f.w / 2, y: f.y + f.h / 2 }, back = rotatePt(c2, c, deg);
      at = { x: f.x + back.x - c2.x, y: f.y + back.y - c2.y };
    }
    const erased: Rub[] = holes.map((h) => ({ pts: h.slice(0, -1).flatMap(([x, y]) => [r1(x - f.x), r1(y - f.y)]), size: 0, area: true }));
    const out = { ...e, id: i ? newId('poly') : e.id, type: 'poly', ...f, x: r1(at.x), y: r1(at.y), ...extra, erased: erased.length ? erased : undefined } as Record<string, unknown>;
    for (const k of ['radius', 'taper', 'n', 'lobes', 'open']) delete out[k];   // the outline holds them now
    return out as unknown as VElement;
  });
}

const r1 = (v: number) => Math.round(v * 10) / 10;

// Carve these elements on the page (the ones an eraser stroke just touched), keeping draw order
export function carveElements(p: DesignPage, ids: Iterable<string>): DesignPage {
  const want = new Set(ids), all = p.elements ?? [];
  if (!all.some((e) => want.has(e.id) && carvable(e))) return p;
  return { ...p, elements: all.flatMap((e) => (want.has(e.id) ? carve(e, all) : [e])) };
}
