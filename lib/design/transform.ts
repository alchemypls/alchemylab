// Flip and quarter-turn a selection as one piece, about the middle of what's selected. Pure ops, like vector.ts's.
// Shapes lying in a plane (floor, walls, roofs) flip and turn within their own box and stay where they are; floors don't
// move. A plane has no turn of its own, so it's baked into the shape: corners move, a box swaps width and height, a
// capsule becomes a polygon (it only tapers one way), a sloped roof's rise turns with it.

import { capsuleAsPoly, liftOf, mapPt, planeOf, ROOF_LIFT, visualBounds, rotatePt, updateElement, withGroups, type Box, type Pt, type Rub, type VElement } from './vector';
import type { DesignPage } from './types';

const angle = (a: number) => { const n = ((((a + 180) % 360) + 360) % 360) - 180; return Math.abs(n) < 1e-9 ? undefined : Math.round(n * 1e6) / 1e6; };
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;   // poly corners keep polyFrom's precision
const BOXES = ['rect', 'ellipse', 'capsule', 'poly', 'text', 'image', 'asset'];

// The middle of what these ids pick (groups come along), as seen: turned shapes by their turned box. Floors and
// shapes lying in a plane stay put, so they don't count, unless that's all there is
function pivot(all: VElement[], ids: string[]): { els: VElement[]; c: Pt } | null {
  const els = all.filter((e) => ids.includes(e.id) && e.type !== 'zone');
  if (!els.length) return null;
  const moving = els.filter((e) => !planeOf(e)), bs = (moving.length ? moving : els).map((e) => visualBounds(e, all));
  const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y));
  const x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h));
  return { els, c: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 } };
}

export const canTransform = (all: VElement[], ids: string[]) => all.some((e) => ids.includes(e.id) && e.type !== 'zone');

// Mirror across the selection's middle: 'x' flips left↔right, 'y' top↔bottom
export function flipElements(p: DesignPage, ids: string[], axis: 'x' | 'y'): DesignPage {
  const all = p.elements ?? [], at = pivot(all, withGroups(all, ids));
  if (!at) return p;
  const { c } = at, X = axis === 'x';
  const m = (q: Pt): Pt => (X ? { x: 2 * c.x - q.x, y: q.y } : { x: q.x, y: 2 * c.y - q.y });
  const rubs = (el: VElement, b: Box, across: boolean): Rub[] | undefined =>   // eraser marks flip in the element's own box
    el.erased?.map((r) => ({ ...r, pts: r.pts.map((v, i) => ((i % 2 === 0) === across ? (across ? b.w - v : b.h - v) : v)) }));
  let next = p;
  for (const el of at.els) {
    let patch: Record<string, unknown> | undefined;
    if (el.type === 'status') { const s = el.size ?? 20, q = m({ x: el.x + s / 2, y: el.y + s / 2 }); patch = { x: q.x - s / 2, y: q.y - s / 2 }; }
    else if (el.type === 'stroke') patch = { points: el.points.map(([x, y]) => { const q = m({ x, y }); return [q.x, q.y]; }) };
    else if (el.type === 'line') patch = { from: 'el' in el.from ? el.from : m(el.from), to: 'el' in el.to ? el.to : m(el.to), bend: el.bend ? -el.bend : undefined };
    else if (BOXES.includes(el.type)) {
      const b = el as VElement & Box, rot = el.rotate ?? 0;
      // Turned shapes: mirroring a turn reverses it. What the shape itself does depends on whether it's symmetric that way
      const pts = el.type === 'poly' ? el.pts.map(([fx, fy]) => (X ? [r4(1 - fx), fy] : [fx, r4(1 - fy)])) : undefined;
      if (planeOf(el)) {
        if (el.type === 'capsule') { next = swap(next, flatFlip(capsuleAsPoly(el) as VElement & Box, X)); continue; }
        patch = { pts, erased: rubs(el, b, X) };
        const roof = el as { slope?: number; slopeAlong?: 'w' | 'h'; lift?: number };   // flipped along its rise, a roof falls the other way, from the far edge's height
        if (roof.slope && (roof.slopeAlong === 'w') === X) Object.assign(patch, { slope: -roof.slope, lift: r4((roof.lift ?? ROOF_LIFT) + roof.slope * (X ? b.w : b.h)) });
      }
      else {
        const q = m({ x: b.x + b.w / 2, y: b.y + b.h / 2 }), pos = { x: q.x - b.w / 2, y: q.y - b.h / 2 };
        if (el.type === 'capsule')   // only symmetric top↔bottom: a sideways flip is that, turned half round
          patch = { ...pos, rotate: angle(X ? 180 - rot : -rot), erased: rubs(el, b, false) };
        else if (el.type === 'asset')   // its drawing mirrors sideways; upside down is that, turned half round
          patch = { ...pos, mirror: el.mirror ? undefined : true, rotate: angle(X ? -rot : 180 - rot), erased: rubs(el, b, true) };
        else patch = { ...pos, pts, rotate: angle(-rot), erased: rubs(el, b, X) };   // text and images keep reading the right way
      }
    }
    if (patch) next = updateElement(next, el.id, patch as Partial<VElement>);
  }
  return next;
}

// A quarter turn about the selection's middle: 1 clockwise, -1 counterclockwise
export function quarterTurn(p: DesignPage, ids: string[], dir: 1 | -1): DesignPage {
  const all = p.elements ?? [], at = pivot(all, withGroups(all, ids));
  if (!at) return p;
  const r = (q: Pt) => rotatePt(q, at.c, 90 * dir);
  let next = p;
  for (const el of at.els) {
    let patch: Record<string, unknown> | undefined;
    if (el.type === 'status') { const s = el.size ?? 20, q = r({ x: el.x + s / 2, y: el.y + s / 2 }); patch = { x: q.x - s / 2, y: q.y - s / 2 }; }
    else if (el.type === 'stroke') patch = { points: el.points.map(([x, y]) => { const q = r({ x, y }); return [q.x, q.y]; }) };
    else if (el.type === 'line') patch = { from: 'el' in el.from ? el.from : r(el.from), to: 'el' in el.to ? el.to : r(el.to) };
    else if (planeOf(el) && FLAT_TURNS.includes(el.type)) {
      let e = capsuleAsPoly(el) as VElement & Box;
      for (let i = 0; i < (dir === 1 ? 1 : 3); i++) e = flatTurn(e);
      next = swap(next, e);
      continue;
    }
    else if (BOXES.includes(el.type) && !planeOf(el)) {
      const b = el as VElement & Box, q = r({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
      patch = { x: q.x - b.w / 2, y: q.y - b.h / 2, rotate: angle((el.rotate ?? 0) + 90 * dir) };
    }
    if (patch) next = updateElement(next, el.id, patch as Partial<VElement>);
  }
  return next;
}

// ── In a plane ── worked in the shape's own flat box. Text and images lying in a plane stay as they are (they'd read sideways)
// The whole element replaced (updateElement keeps the type; a capsule here becomes a polygon)
const swap = (p: DesignPage, e: VElement): DesignPage => ({ ...p, elements: (p.elements ?? []).map((x) => (x.id === e.id ? e : x)) });
const FLAT_TURNS = ['rect', 'ellipse', 'capsule', 'poly'];

// Mirrored in its own box: a polygon's corners and the eraser marks
function flatFlip(e: VElement & Box, X: boolean): VElement & Box {
  const pts = e.type === 'poly' ? e.pts.map(([fx, fy]) => (X ? [r4(1 - fx), fy] : [fx, r4(1 - fy)])) : undefined;
  const erased = e.erased?.map((r) => ({ ...r, pts: r.pts.map((v, i) => ((i % 2 === 0) === X ? (X ? e.w - v : e.h - v) : v)) }));
  return { ...e, ...(pts && { pts }), erased } as VElement & Box;
}

// A quarter turn clockwise about its own middle, which stays where it's drawn
function flatTurn(e: VElement & Box): VElement & Box {
  const { w, h } = e, out = { ...e, w: h, h: w } as VElement & Box & Record<string, unknown>;
  if (e.type === 'poly') out.pts = e.pts.map(([fx, fy]) => [r4(1 - fy), fx]);
  out.erased = e.erased?.map((r) => ({ ...r, pts: r.pts.flatMap((v, i) => (i % 2 ? [] : [r4(h - r.pts[i + 1]), v])) }));
  if ('slope' in e && e.slope) {   // its rise turns with it: along h becomes falling along w, from the corner that was high
    if (e.slopeAlong === 'w') out.slopeAlong = undefined;
    else { out.slopeAlong = 'w'; out.slope = -e.slope; out.lift = r4((e.lift ?? ROOF_LIFT) + e.slope * h); }
  }
  // Same middle on the page: drawn = corner + plane(local) − lift
  const was = mapPt(planeOf(e)!, { x: w / 2, y: h / 2 }), now = mapPt(planeOf(out)!, { x: h / 2, y: w / 2 });
  out.x = e.x + was.x - now.x;
  out.y = e.y + was.y - liftOf(e) - now.y + liftOf(out);
  return out;
}
