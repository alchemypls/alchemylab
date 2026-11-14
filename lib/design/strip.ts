// The strip: an atom's drawing is shared by the tiles it's laid on, so a wall run or a floor isn't the single repeated.
// A wall's face is a strip STRIP tiles long; a floor's or roof's tile a patch STRIP × STRIP. The single's own tile is
// the first (at the corner a wall's faces meet; the near corner of a patch), the rest run back from it (−columns,
// −rows). What's drawn on the first tile only shows there; what covers them all shows on every tile. Where they're
// laid (structure.ts, roof.ts), each tile takes its own piece of it, counted from the run's or the patch's near end and
// repeating every STRIP. Blocks shows 1, 2, 3 or 6 tiles of it in place to draw on. Pure. Imports stay relative (CLI).

import { blockFloor, type VaultAsset } from './vault';
import { fromGrid, toGrid, translateElements, visualBounds, type Box, type Pt, type VElement } from './vector';
import type { DesignPage } from './types';

const moveBy = (els: VElement[], dx: number, dy: number) => {
  if (!els.length || (!dx && !dy)) return els;
  const page: DesignPage = { title: '', blocks: [], elements: els };
  return translateElements(page, els, els.map((e) => e.id), dx, dy).elements ?? [];
};

// ── The strip ── a wall's face is drawn as a strip STRIP tiles long: the single's own tile (0, at the corner its faces
// meet) and the tiles behind it along each face (Blocks shows 1, 2, 3 or 6 of them). One drawing: what covers all six
// shows on every tile, what's on tile 0 only on the first. A run of walls repeats the strip, counted from its near end
export const STRIP = 6;
const stripShift = (face: 'left' | 'right', k: number, cell: number): Pt => (face === 'left' ? { x: -k * cell, y: -k * cell / 2 } : { x: k * cell, y: -k * cell / 2 });
// The face's details on strip tile k, cut to it and moved onto tile 0
export function stripDetail(atom: VaultAsset, els: VElement[], face: 'left' | 'right', k: number): VElement[] {
  const { corners: [, , c2, c3], cell } = blockFloor(atom), s = stripShift(face, k, cell);
  const U0 = (face === 'left' ? c3.x : c2.x) + s.x, U1 = U0 + cell, m = 4;
  const cut = els.flatMap((e): VElement[] => {
    const v = visualBounds(e, els);
    if (v.x + v.w <= U0 + 0.5 || v.x >= U1 - 0.5) return [];
    if (!('plane' in e) || (e.plane !== 'left' && e.plane !== 'right') || !('w' in e)) return [e];
    const b = e as VElement & Box, lo = Math.round((U0 - b.x) * 10) / 10, hi = Math.round((U1 - b.x) * 10) / 10, rubs = [];
    if (lo > 0) rubs.push({ pts: [-m, -m, lo, -m, lo, b.h + m, -m, b.h + m], size: 0, area: true });
    if (hi < b.w) rubs.push({ pts: [hi, -m, b.w + m, -m, b.w + m, b.h + m, hi, b.h + m], size: 0, area: true });
    return [rubs.length ? ({ ...e, erased: [...(e.erased ?? []), ...rubs] } as VElement) : e];
  });
  return moveBy(cut, -s.x, -s.y);
}
const inFloor = (e: VElement) => 'plane' in e && e.plane === 'floor' && 'w' in e;

// A floor's or roof's base: a filled tile-sized shape lying on the single's tile. It repeats on every tile as it is
export function tileBase(atom: VaultAsset, els: VElement[]): VElement | undefined {
  const { corners: [c0], cell } = blockFloor(atom);
  return els.find((e) => {
    if (!inFloor(e) || !('fill' in e) || !e.fill) return false;
    const b = e as VElement & Box, g = toGrid({ cell }, { x: b.x - c0.x, y: b.y - c0.y }), w = b.w / cell, h = b.h / cell;
    const over = (Math.min(g.a + w, 1) - Math.max(g.a, 0)) * (Math.min(g.b + h, 1) - Math.max(g.b, 0));
    return over >= 0.85 && w * h <= 1.15;
  });
}

// A patch's details on its tile (i, j) (i tiles back along the columns, j along the rows), cut to it and moved onto
// the single's tile
export function patchDetail(atom: VaultAsset, els: VElement[], i: number, j: number): VElement[] {
  const { corners: [c0], cell } = blockFloor(atom), A = -i, B = -j, m = 4, e1 = 1e-3;
  const r = (v: number) => Math.round(v * 10) / 10;
  const cut = els.flatMap((e): VElement[] => {
    if (!inFloor(e)) {
      const v = visualBounds(e, els), g = toGrid({ cell }, { x: v.x + v.w / 2 - c0.x, y: v.y + v.h / 2 - c0.y });
      return Math.floor(g.a) === A && Math.floor(g.b) === B ? [e] : [];
    }
    const b = e as VElement & Box, g = toGrid({ cell }, { x: b.x - c0.x, y: b.y - c0.y }), w = b.w / cell, h = b.h / cell;
    if (g.a + w <= A + e1 || g.a >= A + 1 - e1 || g.b + h <= B + e1 || g.b >= B + 1 - e1) return [];
    const la = r((A - g.a) * cell), ha = r((A + 1 - g.a) * cell), lb = r((B - g.b) * cell), hb = r((B + 1 - g.b) * cell), W = b.w + m, H = b.h + m, rubs = [];
    if (la > 0) rubs.push([-m, -m, la, -m, la, H, -m, H]);
    if (ha < b.w) rubs.push([ha, -m, W, -m, W, H, ha, H]);
    if (lb > 0) rubs.push([-m, -m, W, -m, W, lb, -m, lb]);
    if (hb < b.h) rubs.push([-m, hb, W, hb, W, H, -m, H]);
    return [rubs.length ? ({ ...e, erased: [...(e.erased ?? []), ...rubs.map((pts) => ({ pts, size: 0, area: true }))] } as VElement) : e];
  });
  const s = fromGrid({ cell }, { a: i, b: j });
  return moveBy(cut, s.x, s.y);
}

// A tile's place in the strip, counted however far back (negatives too)
export const mod = (v: number) => ((v % STRIP) + STRIP) % STRIP;

// ── On Blocks' sheet ── how much of the strip shows: 1, 2, 3 or 6 tiles. A wall's: structure.ts wallStrip
export const STRIP_SIZES = [1, 2, 3, 6] as const;
// A floor's or roof's patch `n` tiles a side, in place: under, its base tile on each of them (look only, under the
// drawing); hide, the patch's tiles past n, where the drawing on the sheet is kept out of sight
export function tileStrip(atom: VaultAsset, els: VElement[], n: number): { under?: { elements: VElement[] }; hide: Pt[][] } {
  const { corners: [c0], cell } = blockFloor(atom), m = 0.25;
  const p = (a: number, b: number) => { const g = fromGrid({ cell }, { a, b }); return { x: c0.x + g.x, y: c0.y + g.y }; };
  const square = (from: number, to: number) => [p(from, from), p(to, from), p(to, to), p(from, to)];
  const hide = n >= STRIP ? [] : [square(1 - STRIP - m, 1 + m), square(1 - n, 1 + m)];
  const base = tileBase(atom, els);
  if (n < 2 || !base) return { hide };
  const elements: VElement[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (!i && !j) continue;
    const s = fromGrid({ cell }, { a: -i, b: -j });
    elements.push(...moveBy([base], s.x, s.y).map((e) => ({ ...e, id: `${e.id}~${i},${j}` }) as VElement));
  }
  return { hide, under: { elements } };
}
