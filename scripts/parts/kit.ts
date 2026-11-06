// The parts kit: helpers for writing vault assets as code, in inches. A part file describes one asset; build.ts writes it.
// Units: 1" = 64px = one tile on a block sheet. Heights too: 1" up = 64px.
// Block coordinates: (u, v) inches into the footprint, u along its columns (down-right), v along its rows (down-left).
// Shape coordinates: (u, v) inches from the sheet's center, u right, v down. Relative imports only (runs as a script).

import { blockFloor, newAsset, type AssetKind, type Dims, type VaultAsset } from '../../lib/design/vault';
import { hull, onPlane, PLANES, type Plane, type Pt } from '../../lib/design/vector';

export const IN = 64;
export const r = (v: number) => Math.round(v * 10) / 10;
const frac = (v: number) => Math.round(v * 1e4) / 1e4;

// The Pinball palette's colors (vault/palettes/pinball.json), plus a few shades parts need
export const C = {
  ink: '#1f1b16', white: '#f4efe6', rubber: '#b3202a', black: '#2a2623', chrome: '#9aa0a6', steel: '#7c8288', copper: '#b8733a',
  wood: '#c9a36b', red: '#d6332f', yellow: '#f2c230', blue: '#2f6fd6',
  wire: '#8a5328', paper: '#e8dcc0', paper2: '#d9c9a3', nylon: '#efe9d8', well: '#5b5f63',
};
export const EDGE = { stroke: C.ink, strokeWidth: 1.5 };

type El = Record<string, unknown>;
export interface Part { id: string; make: () => VaultAsset }

// How high a block piece sits: `up` inches off the floor (a roof), `h` inches tall (extruded), and anything else to add
export interface Rise { up?: number; h?: number; extra?: El }
const rise = (o: Rise = {}) => ({
  plane: (o.up ? 'roof' : 'floor') as Plane, ...(o.up ? { lift: r(o.up * IN) } : {}), ...(o.h ? { height: r(o.h * IN) } : {}), ...o.extra,
});

export interface BlockKit {
  pt: (u: number, v: number) => Pt;                                                       // a floor point on the sheet
  disc: (id: string, u: number, v: number, d: number, fill: string, o?: Rise) => El;      // centered on (u, v); a cylinder with h
  box: (id: string, u: number, v: number, du: number, dv: number, fill: string, o?: Rise) => El;
  capsule: (id: string, u: number, v: number, len: number, wid: number, taper: number, fill: string, o?: Rise) => El;   // from (u, v) along u
  poly: (id: string, corners: [number, number][], fill: string, o?: Rise) => El;         // corners in (u, v) inches
  ring: (centers: [number, number][], radius: number) => [number, number][];              // the hull of circles round points: a band round posts
  upright: (id: string, u: number, v: number, w: number, h: number, shape: 'ellipse' | 'rect', fill: string, o?: { base?: number; extra?: El }) => El;   // stands at (u, v)
  wall: (id: string, face: 'left' | 'right', u: number, v: number, w: number, h: number, shape: 'ellipse' | 'rect', fill: string, o?: { base?: number; extra?: El }) => El;
}

export function block(id: string, title: string, footprint: { cols: number; rows: number }, dims: Dims, draw: (k: BlockKit) => El[]): Part {
  return {
    id,
    make: () => {
      const a = { ...newAsset('block', title, today()), footprint, dims } as VaultAsset;
      const O = blockFloor(a).corners[0];
      const pt = (u: number, v: number): Pt => { const p = onPlane(PLANES.floor, O, { x: O.x + u * IN, y: O.y + v * IN }); return { x: r(p.x), y: r(p.y) }; };
      const poly = (pid: string, corners: [number, number][], fill: string, o?: Rise): El => {
        const us = corners.map((c) => c[0]), vs = corners.map((c) => c[1]), u0 = Math.min(...us), v0 = Math.min(...vs);
        const w = Math.max(...us) - u0 || 1e-3, h = Math.max(...vs) - v0 || 1e-3;
        return { id: pid, type: 'poly', ...pt(u0, v0), w: r(w * IN), h: r(h * IN), pts: corners.map(([u, v]) => [frac((u - u0) / w), frac((v - v0) / h)]), fill, ...EDGE, ...rise(o) };
      };
      // A face standing on the floor line from (u, v): left faces run along +u, right faces along -v; w, h inches
      const wall: BlockKit['wall'] = (wid, face, u, v, w, h, shape, fill, o = {}) => {
        const b = pt(u, v), top = (o.base ?? 0) + h;
        return { id: wid, type: shape, plane: face, x: b.x, y: r(b.y - top * IN), w: r(w * IN), h: r(h * IN), fill, ...EDGE, ...o.extra };
      };
      const kit: BlockKit = {
        pt, poly, wall,
        disc: (did, u, v, d, fill, o) => ({ id: did, type: 'ellipse', ...pt(u - d / 2, v - d / 2), w: r(d * IN), h: r(d * IN), fill, ...EDGE, ...rise(o) }),
        box: (bid, u, v, du, dv, fill, o) => ({ id: bid, type: 'rect', ...pt(u, v), w: r(du * IN), h: r(dv * IN), fill, ...EDGE, ...rise(o) }),
        capsule: (cid, u, v, len, wid, taper, fill, o) => ({ id: cid, type: 'capsule', ...pt(u, v), w: r(len * IN), h: r(wid * IN), taper, fill, ...EDGE, ...rise(o) }),
        ring: (centers, radius) => {
          const all = centers.flatMap(([u, v]) => Array.from({ length: 24 }, (_, k) => ({ x: u + radius * Math.cos((k / 24) * 2 * Math.PI), y: v + radius * Math.sin((k / 24) * 2 * Math.PI) })));
          return hull(all).map((q) => [q.x, q.y]);
        },
        upright: (uid, u, v, w, h, shape, fill, o = {}) => {
          const b = pt(u, v), base = o.base ?? 0;
          return { id: uid, type: shape, x: r(b.x - (w * IN) / 2), y: r(b.y - (base + h) * IN), w: r(w * IN), h: r(h * IN), fill, ...EDGE, upright: true, ...(base ? { base: r(base * IN) } : {}), ...o.extra };
        },
      };
      a.elements = draw(kit) as unknown as VaultAsset['elements'];
      return a;
    },
  };
}

export interface ShapeKit {
  box: (id: string, u: number, v: number, w: number, h: number, fill: string, o?: El) => El;   // from its top-left
  disc: (id: string, u: number, v: number, d: number, fill: string, o?: El) => El;            // centered
  capsule: (id: string, u: number, v: number, w: number, h: number, fill: string, taper?: number, o?: El) => El;
  poly: (id: string, corners: [number, number][], fill: string, o?: El) => El;
  line: (id: string, u1: number, v1: number, u2: number, v2: number, stroke: string, width: number, o?: El) => El;
  ink: (id: string, pts: [number, number][], color: string, width: number) => El;
}
const X = (u: number) => r(512 + u * IN), Y = (v: number) => r(512 + v * IN);
const shapeKit: ShapeKit = {
  box: (id, u, v, w, h, fill, o = {}) => ({ id, type: 'rect', x: X(u), y: Y(v), w: r(w * IN), h: r(h * IN), fill, ...EDGE, ...o }),
  disc: (id, u, v, d, fill, o = {}) => ({ id, type: 'ellipse', x: X(u - d / 2), y: Y(v - d / 2), w: r(d * IN), h: r(d * IN), fill, ...EDGE, ...o }),
  capsule: (id, u, v, w, h, fill, taper = 1, o = {}) => ({ id, type: 'capsule', x: X(u), y: Y(v), w: r(w * IN), h: r(h * IN), taper, fill, ...EDGE, ...o }),
  poly: (id, corners, fill, o = {}) => {
    const us = corners.map((c) => c[0]), vs = corners.map((c) => c[1]), u0 = Math.min(...us), v0 = Math.min(...vs);
    const w = Math.max(...us) - u0 || 1e-3, h = Math.max(...vs) - v0 || 1e-3;
    return { id, type: 'poly', x: X(u0), y: Y(v0), w: r(w * IN), h: r(h * IN), pts: corners.map(([u, v]) => [frac((u - u0) / w), frac((v - v0) / h)]), fill, ...EDGE, ...o };
  },
  line: (id, u1, v1, u2, v2, stroke, width, o = {}) => ({ id, type: 'line', from: { x: X(u1), y: Y(v1) }, to: { x: X(u2), y: Y(v2) }, stroke, strokeWidth: width, arrow: 'none', ...o }),
  ink: (id, pts, color, width) => ({ id, type: 'stroke', points: pts.map(([u, v]) => [X(u), Y(v)]), color, width, brush: 'marker' }),
};

export function shape(id: string, title: string, dims: Dims, draw: (k: ShapeKit) => El[], kind: AssetKind = 'shape'): Part {
  return { id, make: () => ({ ...newAsset(kind, title, today()), dims, elements: draw(shapeKit) } as unknown as VaultAsset) };
}

export const today = () => new Date().toISOString().slice(0, 10);
