// Roofs on a structure (structure.ts): a box of tiles roofed at the top of its level's walls. Every shape is the lowest of
// a few sloped planes over the box (its overhang included): flat is one level plane, shed one slope, gable two meeting
// at a ridge, hip four. Each plane's part is where it's the lowest, so ridges and hips fall out on their own. The roof
// atom's surface tile repeats over each slope (its floor-plane shapes laid in a sloped roof plane, cut where the slope
// ends); an eave strip runs round the edge; where the roof stands above the walls (a gable end, a shed's high side) the
// gap is filled in the walls' color. Pure. Imports stay relative (CLI).

import { blockFloor, type VaultAsset } from './vault';
import { layerOf, layersOf } from './layers';
import { polyFrom, toGrid, type Pt, type VElement } from './vector';
import { faceColor, WALL_T } from './walls';
import { mod, patchDetail, tileBase } from './strip';

export const ROOF_SHAPES = ['flat', 'shed', 'gable', 'hip'] as const;
export type RoofShape = (typeof ROOF_SHAPES)[number];
export interface Roof {
  a0: number; b0: number; a1: number; b1: number;   // the tiles it covers, both ends included
  atom: string;
  shape: RoofShape;
  pitch?: number;        // tiles it rises per tile (default ROOF_PITCH, at most PITCH_MAX)
  over?: number;         // tiles it reaches past the walls (default ROOF_OVER)
  along?: 'a' | 'b';     // a gable's ridge runs this way; a shed rises this way (default: along the longer side)
  flip?: boolean;        // a shed rises the other way
}
export const ROOF_PITCH = 0.5, ROOF_OVER = 0.25, PITCH_MAX = 0.9;
const FASCIA = 0.12;   // tiles: how deep the eave strip is
const SEAM = 0.02;     // tiles
const along = (r: Roof): 'a' | 'b' => r.along ?? (r.a1 - r.a0 >= r.b1 - r.b0 ? 'a' : 'b');

interface Plane { k: number; ca: number; cb: number }   // z = k + ca·a + cb·b, tiles
const zOf = (p: Plane, a: number, b: number) => p.k + p.ca * a + p.cb * b;

// The roof's box (overhang included) and its planes; top: the walls' top, in tiles up
export function roofPlanes(r: Roof, top: number) {
  const o = r.over ?? ROOF_OVER, pitch = Math.min(Math.max(r.pitch ?? ROOF_PITCH, 0), PITCH_MAX), eave = top - pitch * o;
  const A0 = r.a0 - o, A1 = r.a1 + 1 + o, B0 = r.b0 - o, B1 = r.b1 + 1 + o, dir = along(r);
  const up = { a: { k: eave - pitch * A0, ca: pitch, cb: 0 }, a_: { k: eave + pitch * A1, ca: -pitch, cb: 0 }, b: { k: eave - pitch * B0, ca: 0, cb: pitch }, b_: { k: eave + pitch * B1, ca: 0, cb: -pitch } };
  const planes: Plane[] = r.shape === 'flat' ? [{ k: top, ca: 0, cb: 0 }]
    : r.shape === 'shed' ? [dir === 'a' ? (r.flip ? up.a_ : up.a) : (r.flip ? up.b_ : up.b)]
    : r.shape === 'gable' ? (dir === 'a' ? [up.b, up.b_] : [up.a, up.a_])
    : [up.a, up.a_, up.b, up.b_];
  return { A0, A1, B0, B1, planes, z: (a: number, b: number) => Math.min(...planes.map((p) => zOf(p, a, b))) };
}

// A half plane n·(a, b) ≤ c, and the part of a polygon outside it (Sutherland–Hodgman against the other side)
type Half = { na: number; nb: number; c: number };
function outside(poly: Pt[], h: Half): Pt[] {
  const f = (p: Pt) => h.na * p.x + h.nb * p.y - h.c, out: Pt[] = [];   // > 0: outside
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length], fp = f(p), fq = f(q);
    if (fp > 0) out.push(p);
    if ((fp > 0) !== (fq > 0)) { const t = fp / (fp - fq); out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); }
  });
  return out;
}
const area = (ps: Pt[]) => Math.abs(ps.reduce((s, p, i) => { const q = ps[(i + 1) % ps.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;

const fillOf = (a: VaultAsset | undefined, layer: string) => {
  if (!a) return undefined;
  const ls = layersOf(a);
  return (a.elements ?? []).find((e) => layerOf(ls, e).id === layer && 'fill' in e && e.fill)?.['fill' as never] as string | undefined;
};
const darker = (hex: string, k = 0.7) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16), c = (s: number) => Math.round(((n >> s) & 255) * k).toString(16).padStart(2, '0');
  return `#${c(16)}${c(8)}${c(0)}`;
};

// The roof's drawing on the structure's sheet, back to front. at: a grid point `z` tiles up, on the sheet. top: the walls'
// top. wallAt: the wall atom on a grid line of this level (its color fills a gable end)
export function roofElements(r: Roof, atom: VaultAsset, top: number, cell: number, at: (a: number, b: number, z: number) => Pt, wallAt: (line: 'a' | 'b', v: number, from: number, to: number) => VaultAsset | undefined, tag: string): VElement[] {
  const { A0, A1, B0, B1, planes, z } = roofPlanes(r, top);
  const ls = layersOf(atom), c0 = blockFloor(atom).corners[0];
  const surf = (atom.elements ?? []).filter((e) => layerOf(ls, e).id === 'surface' && !layerOf(ls, e).hidden && 'plane' in e && e.plane === 'floor' && 'w' in e);
  // Each roof tile takes its piece of the atom's patch (strip.ts), counted from the roof's near corner; its base on every one
  const base = tileBase(atom, surf), rest = surf.filter((e) => e !== base);
  const tileAt = (ta: number, tb: number) => [...(base ? [base] : []), ...patchDetail(atom, rest, mod(r.a1 - ta), mod(r.b1 - tb))];
  const surface = fillOf(atom, 'surface') ?? '#8a5328', eaveFill = fillOf(atom, 'eave') ?? darker(surface);
  const poly = (id: string, pts: Pt[], fill: string): VElement => ({ id, type: 'poly', ...polyFrom(pts), fill, stroke: '#1f1b16', strokeWidth: 1.5 } as VElement);
  const parts = { back: [] as VElement[], walls: [] as VElement[], eaves: [] as VElement[] }, faces: { key: number; back: boolean; el: VElement }[] = [];

  // Each plane's tiles: the surface tile placed on the slope, cut to where this plane is the roof
  planes.forEach((p, pi) => {
    const halves: Half[] = [{ na: -1, nb: 0, c: -A0 }, { na: 1, nb: 0, c: A1 }, { na: 0, nb: -1, c: -B0 }, { na: 0, nb: 1, c: B1 },
      ...planes.filter((_, j) => j !== pi).map((q) => ({ na: p.ca - q.ca, nb: p.cb - q.cb, c: q.k - p.k + SEAM * Math.hypot(p.ca - q.ca, p.cb - q.cb) }))];   // slopes overlap a hair at a ridge or hip, so no seam shows
    const isBack = p.ca > 0 || p.cb > 0;   // rising toward the viewer: it faces away
    for (let ta = Math.floor(A0); ta < Math.ceil(A1); ta++) for (let tb = Math.floor(B0); tb < Math.ceil(B1); tb++) {
      tileAt(ta, tb).forEach((e0, ei) => {
        const e = e0 as VElement & { x: number; y: number; w: number; h: number };
        const g = toGrid({ cell }, { x: e.x - c0.x, y: e.y - c0.y }), ga = ta + g.a, gb = tb + g.b, w = e.w / cell, h = e.h / cell;
        const box: Pt[] = [{ x: ga, y: gb }, { x: ga + w, y: gb }, { x: ga + w, y: gb + h }, { x: ga, y: gb + h }];
        // What's cut away reaches a little past the box, so the shape's border doesn't show along the cut's far side
        const m = 4 / cell, wide: Pt[] = [{ x: ga - m, y: gb - m }, { x: ga + w + m, y: gb - m }, { x: ga + w + m, y: gb + h + m }, { x: ga - m, y: gb + h + m }];
        const rubs: number[][] = [];
        for (const hf of halves) {
          const cut = outside(box, hf);
          if (cut.length < 3 || area(cut) < 1e-6) continue;
          if (area(cut) >= area(box) - 1e-6) return;   // wholly off this part of the roof
          const out = outside(wide, hf);
          rubs.push(out.flatMap((q) => [Math.round((q.x - ga) * cell * 10) / 10, Math.round((q.y - gb) * cell * 10) / 10]));
        }
        const corner = at(ga, gb, 0), lift = zOf(p, ga, gb) * cell;
        const el = {
          ...e, id: `${tag}p${pi}t${ta},${tb}e${ei}`, layer: undefined, x: corner.x, y: corner.y, plane: 'roof', lift: Math.round(lift * 10) / 10,
          slope: p.ca || p.cb || undefined, slopeAlong: p.ca ? 'w' : p.cb ? 'h' : undefined, height: undefined,
          erased: [...(e.erased ?? []), ...rubs.map((pts) => ({ pts, size: 0, area: true }))],
        } as VElement;
        if (!el.erased?.length) delete el.erased;
        faces.push({ key: ta + tb, back: isBack, el });
      });
    }
  });

  // Where the roof stands above the walls, on the walls' lines: filled up to it in the walls' color
  const room = { a0: r.a0, a1: r.a1 + 1, b0: r.b0, b1: r.b1 + 1 };
  const infill = (line: 'a' | 'b', v0: number, isBack: boolean) => {
    const f0 = line === 'a' ? room.b0 : room.a0, t0 = line === 'a' ? room.b1 : room.a1;
    // on the face of the wall toward you (half its thickness out from its line), reaching round the walls' corners: a
    // line across the columns stands as the walls' right face, one across the rows as their left
    const wall = wallAt(line, v0, f0, t0), t = (wall?.wall?.t ?? WALL_T) / 2, v = v0 + t, fill = wall ? faceColor(wall, line === 'a' ? 'right' : 'left') : '#e8dcc0';
    const from = f0 - t, to = t0 + t, n = Math.max(2, Math.ceil((to - from) * 8));
    const pt = (u: number, up: number) => (line === 'a' ? at(v, u, up) : at(u, v, up));
    const tops = Array.from({ length: n + 1 }, (_, i) => { const u = from + ((to - from) * i) / n; return { u, h: line === 'a' ? z(v, u) : z(u, v) }; });
    if (!tops.some((t) => t.h > top + 1e-3)) return;
    (isBack ? parts.back : parts.walls).push(poly(`${tag}g${line}${v}`, [pt(from, top), ...tops.map((t) => pt(t.u, Math.max(t.h, top))), pt(to, top)], fill));
  };
  infill('a', room.a0, true); infill('b', room.b0, true);

  // The eave strip round the edge, following the roof's height along it
  const fascia = (line: 'a' | 'b', v: number, isBack: boolean) => {
    const from = line === 'a' ? B0 : A0, to = line === 'a' ? B1 : A1, n = Math.max(2, Math.ceil((to - from) * 8));
    const pts = Array.from({ length: n + 1 }, (_, i) => { const u = from + ((to - from) * i) / n; return line === 'a' ? { a: v, b: u } : { a: u, b: v }; });
    const upper = pts.map((q) => at(q.a, q.b, z(q.a, q.b))), lower = pts.map((q) => at(q.a, q.b, z(q.a, q.b) - FASCIA)).reverse();
    (isBack ? parts.back : parts.eaves).push(poly(`${tag}e${line}${v}`, [...upper, ...lower], eaveFill));
  };
  fascia('a', A0, true); fascia('b', B0, true);

  infill('a', room.a1, false); infill('b', room.b1, false); fascia('a', A1, false); fascia('b', B1, false);
  // Back to front: what's behind (back gable ends, back eaves), slopes facing away, the front gable ends, slopes facing
  // the viewer, the front eaves
  const order = (back: boolean) => faces.filter((x) => x.back === back).sort((x, y) => x.key - y.key).map((x) => x.el);
  return [...parts.back, ...order(true), ...parts.walls, ...order(false), ...parts.eaves];
}
