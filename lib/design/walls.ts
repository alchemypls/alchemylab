// Walls in a structure as one solid (structure.ts): every wall on a level is a slab along its grid line, `t` thick,
// reaching half its thickness past each end; the slabs are merged into one footprint, and its outline is swept up into
// faces with a cap on top. So a straight run is one wall, and corners, tees and crosses join solid, Sims style.
// Seen isometric only the faces turned toward you show: +rows (a wall's left face) and +columns (its right face).
// Their color is the wall atom's base face (the shape covering that face on its sheet); anything else drawn on the
// face is a detail, laid on per tile by structure.ts. Pieces are cut a tile long and given a depth, so objects and
// walls still draw back to front. Pure. Imports stay relative (CLI).

import * as clipping from 'polygon-clipping';
import type { Polygon, Ring } from 'polygon-clipping';
import { blockFloor, WALL_H, type VaultAsset } from './vault';
import { layerOf, layersOf } from './layers';
import { inPolygon, polyFrom, type Pt, type VElement } from './vector';
import type { Box } from './vector';

export const WALL_T = 0.15;   // tiles: a wall's thickness, unless its atom says
const INK = '#1f1b16', EDGE_W = 1.5;

export interface WallSpec { key: string; a: number; b: number; d: 'a' | 'b'; atom: VaultAsset; h: number }
type At = (a: number, b: number, z: number) => Pt;

// A wall atom's face drawing: what's on its Faces layer in that face's plane (the plane says which face: one layer for
// both). Files from before kept a layer per face, 'left' and 'right': read the same way
const FACE_LAYERS = new Set(['faces', 'left', 'right']);
export function faceEls(atom: VaultAsset, face: 'left' | 'right'): VElement[] {
  const ls = layersOf(atom);
  return (atom.elements ?? []).filter((e) => { const l = layerOf(ls, e); return !l.hidden && FACE_LAYERS.has(l.id) && 'plane' in e && e.plane === face; });
}
// A wall face's base: the shape on that face of the atom's sheet that covers (nearly) all of it. Its color is the face's
export function faceBase(atom: VaultAsset, face: 'left' | 'right'): VElement | undefined {
  const cell = blockFloor(atom).cell, h = (atom.wall?.h ?? WALL_H) * cell;
  return faceEls(atom, face).find((e) => {
    if (!('fill' in e) || !e.fill) return false;
    const b = e as VElement & Box;
    return b.w * b.h >= 0.85 * cell * h;
  });
}
const fillOf = (e?: VElement) => (e && 'fill' in e ? e.fill : undefined);
export function faceColor(atom: VaultAsset, face: 'left' | 'right'): string {
  return fillOf(faceBase(atom, face)) ?? (face === 'right' ? shade(fillOf(faceBase(atom, 'left')) ?? '#e8dcc0', 0.88) : '#e8dcc0');
}
export function shade(hex: string, k: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16), c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k))).toString(16).padStart(2, '0');
  return `#${c(16)}${c(8)}${c(0)}`;
}

// The solid's pieces, each with its depth (a + b, larger is nearer). Walls of different heights (some lowered to
// look in) are merged by height, so each group gets its own top
export function wallSolid(walls: WallSpec[], z: number, cell: number, at: At, tag: string): { key: number; els: VElement[] }[] {
  const out: { key: number; els: VElement[] }[] = [];
  const byH = new Map<number, WallSpec[]>();
  for (const w of walls) byH.set(w.h, [...(byH.get(w.h) ?? []), w]);
  let n = 0;
  const id = (k: string) => `${tag}${k}${n++}`;
  const line = (p: Pt, q: Pt): VElement => ({ id: id('l'), type: 'line', from: { x: r1(p.x), y: r1(p.y) }, to: { x: r1(q.x), y: r1(q.y) }, stroke: INK, strokeWidth: EDGE_W, arrow: 'none' } as VElement);
  // A filled patch, its border in its own color so patches side by side show no seam
  const patch = (pts: Pt[], fill: string): VElement => ({ id: id('f'), type: 'poly', ...polyFrom(pts), fill, stroke: fill, strokeWidth: 1 } as VElement);

  byH.forEach((group, h) => {
    const slab = (w: WallSpec): Polygon => {
      const t = (w.atom.wall?.t ?? WALL_T) / 2;
      const [a0, a1, b0, b1] = w.d === 'a' ? [w.a - t, w.a + 1 + t, w.b - t, w.b + t] : [w.a - t, w.a + t, w.b - t, w.b + 1 + t];
      return [[[a0, b0], [a1, b0], [a1, b1], [a0, b1], [a0, b0]]];
    };
    const merged = clipping.union(slab(group[0]), ...group.slice(1).map(slab));
    // Which wall a point of the solid belongs to: the nearest wall line through it
    const atomAt = (m: Pt) => {
      let best: WallSpec | undefined, bd = Infinity;
      for (const w of group) {
        const d = w.d === 'a' ? Math.hypot(Math.max(w.a - m.x, 0, m.x - w.a - 1), m.y - w.b) : Math.hypot(m.x - w.a, Math.max(w.b - m.y, 0, m.y - w.b - 1));
        if (d < bd) { bd = d; best = w; }
      }
      return best!.atom;
    };
    const top = z + h;

    for (const poly of merged) {
      const rings = poly.map((r: Ring) => r.map(([x, y]) => ({ x, y })));
      const inside = (p: Pt) => rings.reduce((k, r) => (inPolygon(p, r) ? !k : k), false);
      for (const ring of rings) {
        const pts = ring.slice(0, -1), N = pts.length;
        // Each edge's outward side, by looking just past it
        const outward = pts.map((p, i) => {
          const q = pts[(i + 1) % N], d = { x: q.x - p.x, y: q.y - p.y }, len = Math.hypot(d.x, d.y) || 1, nrm = { x: d.y / len, y: -d.x / len };
          const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
          return inside({ x: mid.x + nrm.x * 1e-3, y: mid.y + nrm.y * 1e-3 }) ? { x: -nrm.x, y: -nrm.y } : nrm;
        });
        const shown = outward.map((o) => o.x > 0.5 || o.y > 0.5);   // facing +columns or +rows: toward you
        pts.forEach((p, i) => {
          const q = pts[(i + 1) % N], o = outward[i];
          // The cap's outline, all of it (the top shows from every side), a tile at a time
          for (const [s, e] of tiles(p, q)) out.push({ key: (s.x + e.x + s.y + e.y) / 2 + 0.03, els: [line(at(s.x, s.y, top), at(e.x, e.y, top))] });
          if (!shown[i]) return;
          // A face toward you, a tile at a time: its fill, its foot line, and the corner lines where it turns
          for (const [s, e] of tiles(p, q)) {
            const m = { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 }, atom = atomAt({ x: m.x - o.x * 0.01, y: m.y - o.y * 0.01 });
            const fill = faceColor(atom, o.y > 0.5 ? 'left' : 'right');
            const els = [patch([at(s.x, s.y, z), at(e.x, e.y, z), at(e.x, e.y, top), at(s.x, s.y, top)], fill), line(at(s.x, s.y, z), at(e.x, e.y, z))];
            out.push({ key: m.x + m.y, els });
          }
        });
        // Upright edges where the outline turns and a face beside the corner shows
        pts.forEach((p, i) => {
          if (!shown[i] && !shown[(i - 1 + N) % N]) return;
          out.push({ key: p.x + p.y + 0.02, els: [line(at(p.x, p.y, z), at(p.x, p.y, top))] });
        });
      }
    }
    // The cap, slab by slab (one color, no seams), after the faces under it
    for (const w of group) {
      const [ring] = slab(w), c = shade(faceColor(w.atom, 'left'), 1.08);
      const box = ring.slice(0, -1).map(([x, y]) => at(x, y, top));
      out.push({ key: (w.d === 'a' ? w.a + 0.5 + w.b : w.a + w.b + 0.5) + 0.025, els: [patch(box, c)] });
    }
  });
  return out;
}

// An axis-aligned edge cut where it crosses whole tiles, so each piece sorts with what stands near it
function tiles(p: Pt, q: Pt): [Pt, Pt][] {
  const along = Math.abs(q.x - p.x) > Math.abs(q.y - p.y) ? 'x' : 'y', from = p[along], to = q[along];
  const cuts = [from];
  for (let v = Math.floor(Math.min(from, to)) + 1; v < Math.max(from, to); v++) cuts.push(v);
  cuts.push(to);
  cuts.sort((x, y) => (from < to ? x - y : y - x));
  const at = (v: number): Pt => (along === 'x' ? { x: v, y: p.y } : { x: p.x, y: v });
  return cuts.slice(0, -1).map((v, i) => [at(v), at(cuts[i + 1])] as [Pt, Pt]).filter(([s, e]) => Math.abs(s.x - e.x) + Math.abs(s.y - e.y) > 1e-6);
}
const r1 = (v: number) => Math.round(v * 10) / 10;
