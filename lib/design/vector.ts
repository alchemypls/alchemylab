// Vector pages — free elements on the fixed artboard, for one-page design docs. A DesignPage with `elements`
// renders full-bleed as SVG (workbench/ui/VectorArtboard.tsx) instead of as blocks.
//
// Coordinates are artboard px (1920×1080). Elements draw in array order: later = on top.
// Meaning stays linked to the bible: text can `bind` to a topic, `status` shows a topic's live status,
// and any element can `link` to a page — that's what makes an overview double as an index.
// Pure data + pure ops: the canvas tools and the agent produce the same shapes. Imports stay relative (CLI).

import { ARTBOARD, pageSize, type DesignPage } from './types';
import { layersOf, type VLayer } from './layers';
import { densify } from '../sketchErase';
import { reshape, reshapes } from './fx';

export interface Pt { x: number; y: number }
export interface Box extends Pt { w: number; h: number }

export type Anchor = Pt | { el: string };   // a fixed point, or attached to another element's edge

interface VBase {
  id: string; link?: string; opacity?: number;
  name?: string;     // what it is, in lists and to the agent ("left orbit shot", "dungeon floor"). Text and status dots say it themselves
  layer?: string;    // lib/design/layers.ts
  rotate?: number;   // degrees clockwise around the box's center. Boxes only: rect, ellipse, text, image, asset
  erased?: Rub[];    // eraser marks, drawn as holes (rubElements). Not on pen strokes: those are cut for real
  upright?: boolean; // a flat shape in a block that stands up (a ball, a post, a sign): seen from above it keeps its shape,
  base?: number;     // centered over the floor under its bottom edge, which is `base` px above the floor (default 0)
  on?: string;       // painted on this floor (a zone id): follows it tile for tile when the view flips (flat, or in the floor plane when isometric)
  group?: string;    // welded: elements sharing a group select and move as one (groupElements)
  fx?: Fx[];         // effects, applied in order (lib/design/fx): roughen reshapes the outline, blur paints over it
}

// One effect on an element: its kind and its settings (missing ones take the effect's defaults). off: kept, not drawn
export interface Fx { kind: string; off?: boolean; [setting: string]: string | number | boolean | undefined }

// One pass of the eraser over an element. Points are relative to the element's unturned box, so the hole moves and turns with it.
export interface Rub { pts: number[]; size: number; square?: boolean }   // pts: x, y, x, y, …
export type LinePattern = boolean | 'dot';   // true = dashed
export type TextBackground = 'block' | 'round' | 'pill' | 'ellipse';
export type VBrush = 'ink' | 'marker' | 'highlighter';
interface ShapeStyle { fill?: string; stroke?: string; strokeWidth?: number; dash?: LinePattern }

// A box shape can lie in a plane: drawn in its own box, then mapped onto the isometric floor or a block's wall (see Planes)
export type Plane = 'floor' | 'roof' | 'left' | 'right';
interface Planed {
  plane?: Plane;
  lift?: number;   // a roof: how far above the floor it sits, in px (default ROOF_LIFT). x, y stay its corner on the floor
  slope?: number;  // a roof: px it rises per px along `slopeAlong` (h by default), away from (x, y). Negative falls. |slope| < 1
  slopeAlong?: 'w' | 'h';
  walls?: boolean;  // a roof: walls drop from its outline to the floor, following every bump of it (and its slope)
  height?: number; // on the floor or a roof (rect, ellipse, capsule): extruded this many px straight up into a solid (see extrusion)
}

export type VRect    = VBase & ShapeStyle & Box & Planed & { type: 'rect'; radius?: number };
export type VEllipse = VBase & ShapeStyle & Box & Planed & {
  type: 'ellipse';
  n?: number;   // superellipse exponent |x|ⁿ+|y|ⁿ=1: 1 diamond, 2 ellipse (default), 4 squircle, high = box; below 1 pinches to a star
  lobes?: number;       // scalloped into this many bumps (3–24): a bush, a cloud, a tree's crown. None: a smooth edge
  lobeDepth?: number;   // how far the dips between bumps cut in, 0.05–0.8 of the radius; default 0.3
};
export const LOBE_DEPTH = 0.3;
// Two circles joined by their outer tangents, along the box's length: the left end fills the height, the right is `taper` of it
export type VCapsule = VBase & ShapeStyle & Box & Planed & { type: 'capsule'; taper?: number };   // taper 0.05–1, default 1 (a stadium)
// Any outline: corners as fractions of the box (0–1 each way), so it resizes, turns and lies in planes like a rect
export type VPoly = VBase & ShapeStyle & Box & Planed & { type: 'poly'; pts: [number, number][]; open?: boolean };   // open: a path, not filled
export type VLine    = VBase & {
  type: 'line'; from: Anchor; to: Anchor;
  stroke?: string; strokeWidth?: number; dash?: LinePattern;
  arrow?: 'none' | 'end' | 'both';  // default 'end'
  bend?: number;                    // curve: px sideways at the midpoint, 0 = straight
};
export type VText = VBase & Box & Planed & {
  type: 'text'; text: string;
  size?: number; weight?: number; font?: 'serif' | 'sans' | 'mono'; color?: string;
  align?: 'left' | 'center' | 'right'; valign?: 'top' | 'middle' | 'bottom';
  caps?: boolean;                   // uppercase + tracked out, for labels
  bind?: { topic: string; field: 'title' | 'summary' };  // text comes live from bible.json; `text` is ignored
  bg?: string; bgShape?: TextBackground;                 // colored backing behind the text; default shape is block
};
export type VStroke = VBase & {
  type: 'stroke'; points: [number, number][]; pressures?: number[]; color?: string;
  width?: number;   // default 4
  brush?: VBrush;   // default ink, which follows pressure; the others keep an even width
};
export type VImage  = VBase & Box & Planed & { type: 'image'; src: string; fit?: 'cover' | 'contain' };  // src: file in assets/
export type VStatus = VBase & { type: 'status'; x: number; y: number; size?: number; topic: string };  // live status dot

// A floor zone: a patch of tiles that images and shapes snap onto. Floors always draw under everything else.
export type VZone = VBase & ShapeStyle & Pt & {   // x, y: page position of tile (0, 0)'s first corner
  type: 'zone'; cols: number; rows: number;
  cell: number;      // tile size in px. An isometric tile is 2×cell wide and cell tall
  flat?: boolean;    // top-down square tiles instead of isometric
  noLines?: boolean; // hide the lines between tiles
};

// A drawing from the vault, by id: editing the asset changes every page using it (lib/design/vault.ts)
export type VAsset = VBase & Box & {
  type: 'asset'; asset: string; tint?: string;
  layers?: string[];   // the asset's layers this placement shows; default its visible ones
  at?: Pt;             // a block: where in its box it stands (0–1 each way). Its box follows the vault (fitBlocks in vault.ts)
  projected?: boolean; // a block standing on a floor of the other view (flat vs isometric): its drawing is projected onto it
  turn?: number;       // a block: degrees it's turned about where it stands. Top-down any angle; isometric in quarter turns (shownBlock)
  mirror?: boolean;    // mirrored: a block flips end to end along its columns (a left flipper from a right one); other assets flip sideways
};

export type VElement = VRect | VEllipse | VCapsule | VPoly | VLine | VText | VStroke | VImage | VStatus | VZone | VAsset;
export type VType = VElement['type'];

export const SNAP = 8;
export const snap = (v: number) => Math.round(v / SNAP) * SNAP;
// Pulls a value onto the nearest grid line when it's within `tol`, so edges line up with the grid without hard snapping
export const magnet = (v: number, cell: number, tol: number): number | undefined => {
  const n = Math.round(v / cell) * cell;
  return Math.abs(v - n) <= tol ? n : undefined;
};
// The smallest shift per axis that puts one of the box's edges on a grid line (undefined: none close enough)
export function pullBox(b: Box, cell: number, tol: number): { x?: number; y?: number } {
  const best = (edges: number[]) => {
    let out: number | undefined;
    for (const e of edges) { const m = magnet(e, cell, tol); if (m !== undefined && (out === undefined || Math.abs(m - e) < Math.abs(out))) out = m - e; }
    return out;
  };
  return { x: best([b.x, b.x + b.w]), y: best([b.y, b.y + b.h]) };
}
const rid = () => Math.random().toString(36).slice(2, 6);
export const newId = (type: VType) => `${type}-${rid()}`;

// A drawn stroke as saved: whole px, no repeats, pressures to 2 places. Keeps page files small
// (a tablet samples far finer than the sheet's pixels).
export function tidyStroke(points: [number, number][], pressures?: number[]): Pick<VStroke, 'points' | 'pressures'> {
  const pts: [number, number][] = [], ps: number[] = [];
  points.forEach(([x, y], i) => {
    const q: [number, number] = [Math.round(x), Math.round(y)], last = pts[pts.length - 1];
    if (last && last[0] === q[0] && last[1] === q[1]) return;
    pts.push(q);
    if (pressures) ps.push(Math.round(pressures[i] * 100) / 100);
  });
  return pressures ? { points: pts, pressures: ps } : { points: pts };
}

// How a line pattern draws at a given line width
export const dashProps = (dash: LinePattern | undefined, width: number) =>
  dash === 'dot' ? { strokeDasharray: `0.01 ${width * 2.2}`, strokeLinecap: 'round' as const }
  : dash ? { strokeDasharray: '12 8' } : {};

// Cuts every pen stroke under the eraser. r is half its size. Returns `p` itself when nothing was touched.
export function cutStrokes(p: DesignPage, c: Pt, r: number, square = false, skip?: Set<string>): DesignPage {   // skip: ids it can't touch
  const inside = ([x, y]: [number, number]) => square
    ? Math.abs(x - c.x) <= r && Math.abs(y - c.y) <= r
    : Math.hypot(x - c.x, y - c.y) <= r;
  let changed = false;
  const out: VElement[] = [];
  for (const el of elementsOf(p)) {
    if (el.type !== 'stroke' || skip?.has(el.id)) { out.push(el); continue; }
    const d = densify(el.points, el.pressures);
    if (!d.points.some(inside)) { out.push(el); continue; }
    changed = true;
    let run: number[] = [], part = 0;
    const flush = () => {
      if (run.length >= 2) {
        const tidy = tidyStroke(run.map((i) => d.points[i]), d.pressures && run.map((i) => d.pressures![i]));
        if (tidy.points.length >= 2) out.push({ ...el, ...tidy, id: part++ ? newId('stroke') : el.id });
      }
      run = [];
    };
    d.points.forEach((pt, i) => { if (inside(pt)) flush(); else run.push(i); });
    flush();
  }
  return changed ? withElements(p, out) : p;
}

// Where an element's eraser marks are measured from: its unturned box's top-left
export const rubOrigin = (el: VElement, all: VElement[]): Pt => { const b = boundsOf(el, all); return { x: b.x, y: b.y }; };

// The eraser over everything but pen strokes and floors (Fab): leaves a hole in each element its path from `from` to `to` crosses.
// `open` maps element id → its mark from this same drag, which grows instead of starting a new one. Returns `p` when nothing was touched.
const RUBBABLE: VType[] = ['rect', 'ellipse', 'capsule', 'poly', 'line', 'text', 'image'];
export function rubElements(p: DesignPage, from: Pt, to: Pt, size: number, square: boolean, skip: Set<string> | undefined, open: Map<string, number>): DesignPage {
  const all = elementsOf(p), pad = size / 2 + 8;   // 8: room for a border drawn past the box
  let changed = false;
  const out = all.map((e) => {
    if (!RUBBABLE.includes(e.type) || skip?.has(e.id)) return e;
    const b = boundsOf(e, all);
    const loc = (q: Pt) => { const r = toLocal(e, all, q); return [Math.round((r.x - b.x) * 10) / 10, Math.round((r.y - b.y) * 10) / 10]; };
    const f = loc(from), t = loc(to);
    if (Math.max(f[0], t[0]) < -pad || Math.min(f[0], t[0]) > b.w + pad || Math.max(f[1], t[1]) < -pad || Math.min(f[1], t[1]) > b.h + pad) return e;
    changed = true;
    const rubs = [...(e.erased ?? [])], i = open.get(e.id);
    if (i !== undefined && rubs[i]) rubs[i] = { ...rubs[i], pts: [...rubs[i].pts, ...t] };
    else { open.set(e.id, rubs.length); rubs.push({ pts: [...f, ...t], size, ...(square && { square: true }) }); }
    return { ...e, erased: rubs } as VElement;
  });
  return changed ? withElements(p, out) : p;
}

const isAttached = (a: Anchor): a is { el: string } => 'el' in a;

// ── Grid ── (a, b) are tile coordinates; whole numbers are tile corners.

export interface Lattice { cell: number; flat?: boolean }
export interface GridPt { a: number; b: number }

export const GRID_CELLS = [16, 24, 32, 48, 64, 96];   // even, so isometric corners land on whole px
export const gridOf = (p: DesignPage): Lattice => ({ cell: p.grid?.cell ?? 32, flat: p.grid?.flat });

export const fromGrid = (g: Lattice, { a, b }: GridPt): Pt =>
  g.flat ? { x: a * g.cell, y: b * g.cell } : { x: (a - b) * g.cell, y: ((a + b) * g.cell) / 2 };

export const toGrid = (g: Lattice, { x, y }: Pt): GridPt =>
  g.flat ? { a: x / g.cell, b: y / g.cell } : { a: (x / g.cell + (2 * y) / g.cell) / 2, b: ((2 * y) / g.cell - x / g.cell) / 2 };

export const zonePoint = (z: VZone, a: number, b: number): Pt => {
  const p = fromGrid(z, { a, b });
  return { x: z.x + p.x, y: z.y + p.y };
};
export const zoneGrid = (z: VZone, p: Pt): GridPt => toGrid(z, { x: p.x - z.x, y: p.y - z.y });
export const zoneCorners = (z: VZone): Pt[] =>
  [zonePoint(z, 0, 0), zonePoint(z, z.cols, 0), zonePoint(z, z.cols, z.rows), zonePoint(z, 0, z.rows)];

export const onZone = (z: VZone, p: Pt) => {
  const { a, b } = zoneGrid(z, p);
  return a >= 0 && b >= 0 && a < z.cols && b < z.rows;
};

// The zone edges `dir` pulls (n, s, w, e, or a corner), moved to the tile line nearest `p`. A zone keeps at least one tile.
export function pullZone(z: VZone, dir: string, p: Pt): Pick<VZone, 'x' | 'y' | 'cols' | 'rows'> {
  const at = zoneGrid(z, p), a = Math.round(at.a), b = Math.round(at.b);
  let a0 = 0, b0 = 0, a1 = z.cols, b1 = z.rows;
  if (dir.includes('w')) a0 = Math.min(a, a1 - 1);
  if (dir.includes('e')) a1 = Math.max(a, a0 + 1);
  if (dir.includes('n')) b0 = Math.min(b, b1 - 1);
  if (dir.includes('s')) b1 = Math.max(b, b0 + 1);
  return { ...zonePoint(z, a0, b0), cols: a1 - a0, rows: b1 - b0 };
}

// The lattice corner nearest `p`, when it's within `tol`
export function latticeVertex(g: Lattice, p: Pt, tol: number): Pt | undefined {
  const t = toGrid(g, p), v = fromGrid(g, { a: Math.round(t.a), b: Math.round(t.b) });
  return Math.hypot(v.x - p.x, v.y - p.y) <= tol ? v : undefined;
}
// The smallest shift that puts one of the box's corners or its middle on a lattice corner (empty: none close enough)
export function pullBoxToLattice(b: Box, g: Lattice, tol: number): { x?: number; y?: number } {
  let best: Pt | undefined;
  for (const p of [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x, y: b.y + b.h }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x + b.w / 2, y: b.y + b.h / 2 }]) {
    const v = latticeVertex(g, p, tol);
    if (v && (!best || Math.hypot(v.x - p.x, v.y - p.y) < Math.hypot(best.x, best.y))) best = { x: v.x - p.x, y: v.y - p.y };
  }
  return best ?? {};
}
// The slope of an isometric grid line, in degrees: a shape turned this much lies along the floor
export const ISO_DEG = (Math.atan(0.5) * 180) / Math.PI;

// The tiles a piece covers on a floor (a block's footprint, lib/design/vault.ts), and where in its box it stands,
// as a fraction of the box each way. Without a footing a piece covers one tile and stands on its base (isometric) or middle (flat).
export interface Footprint { cols: number; rows: number }
export interface Footing { footprint: Footprint; at?: Pt }
export type FootingOf = (e: VElement) => Footing | undefined;

type Piece = VRect | VEllipse | VCapsule | VPoly | VImage | VAsset;
const isPiece = (e: VElement): e is Piece => e.type === 'rect' || e.type === 'ellipse' || e.type === 'capsule' || e.type === 'poly' || e.type === 'image' || e.type === 'asset';
const standPoint = (e: Piece, flat?: boolean, footing?: Pt): Pt => {
  const at = (e.type === 'asset' && e.at) || footing;
  return at ? { x: e.x + e.w * at.x, y: e.y + e.h * at.y } : { x: e.x + e.w / 2, y: flat ? e.y + e.h / 2 : e.y + e.h };
};

// Pieces standing on these zones, which travel with them
export function tenants(all: VElement[], zoneIds: string[], footingOf?: FootingOf): string[] {
  const zones = all.filter((e): e is VZone => e.type === 'zone' && zoneIds.includes(e.id));
  return all.filter((e) => isPiece(e) && !zoneIds.includes(e.id) && zones.some((z) => onZone(z, standPoint(e as Piece, z.flat, footingOf?.(e)?.at)))).map((e) => e.id);
}

// Every floor follows the page's grid (tile size and view). A floor keeps its tiles and stays about where it was,
// on the grid; vault pieces on it keep their spot on those tiles, and drawings painted on it (`on`) go with it tile for
// tile. Nothing else moves: rects, text and images over a floor are the page's layout unless they say they're on it.
export function regridZones(p: DesignPage, footingOf?: FootingOf): DesignPage {
  const g = gridOf(p), els = p.elements ?? [];
  const zones = els.filter((e): e is VZone => e.type === 'zone');
  const moved = new Map<string, VZone>();
  for (const z of zones) {
    if (z.cell === g.cell && !!z.flat === !!g.flat) continue;
    const c = zonePoint(z, z.cols / 2, z.rows / 2), half = fromGrid(g, { a: z.cols / 2, b: z.rows / 2 });
    const t = toGrid(g, { x: c.x - half.x, y: c.y - half.y }), o = fromGrid(g, { a: Math.round(t.a), b: Math.round(t.b) });
    moved.set(z.id, { ...z, cell: g.cell, flat: g.flat || undefined, x: o.x, y: o.y });
  }
  if (!moved.size) return p;
  const top = [...zones].reverse();
  return withElements(p, els.map((e) => {
    if (e.type === 'zone') return moved.get(e.id) ?? e;
    const host = e.on ? zones.find((z) => z.id === e.on) : undefined, nh = host && moved.get(host.id);
    if (host && nh) return paintedOn(e, host, nh);
    if (e.type !== 'asset') return e;
    const at = footingOf?.(e)?.at, z = top.find((z) => onZone(z, standPoint(e, z.flat, at))), nz = z && moved.get(z.id);
    if (!z || !nz) return e;
    const t = zoneGrid(z, standPoint(e, z.flat, at)), to = zonePoint(nz, t.a, t.b), now = standPoint(e, nz.flat, at);
    return { ...e, x: Math.round(e.x + to.x - now.x), y: Math.round(e.y + to.y - now.y) };
  }));
}

// A drawing painted on floor `z` (its `on`), moved to the same tiles of `nz`: points map tile for tile; a box keeps its
// size in tiles and lies in the floor plane when the floor is isometric. Shapes standing in a wall or roof plane stay put.
function paintedOn(e: VElement, z: VZone, nz: VZone): VElement {
  const map = (p: Pt): Pt => { const t = zoneGrid(z, p), q = zonePoint(nz, t.a, t.b); return { x: Math.round(q.x * 100) / 100, y: Math.round(q.y * 100) / 100 }; };
  const k = nz.cell / z.cell;
  if (e.type === 'line') {
    const end = (q: VLine['from']) => ('el' in q ? q : map(q));
    return { ...e, from: end(e.from), to: end(e.to) };
  }
  if (e.type === 'stroke') return { ...e, points: e.points.map(([x, y]) => { const q = map({ x, y }); return [q.x, q.y] as [number, number]; }) };
  if (!PLANAR.includes(e.type) || !('w' in e)) return e;
  const plane = 'plane' in e ? e.plane : undefined;
  if (plane && plane !== 'floor') return e;
  const o = map({ x: e.x, y: e.y });
  return { ...e, ...o, w: Math.round(e.w * k * 100) / 100, h: Math.round(e.h * k * 100) / 100, plane: nz.flat ? undefined : 'floor' } as VElement;
}

// The tiles a piece standing at `s` covers on zone `z`: its footprint, centered under it and kept on the floor
export function footprintAt(z: VZone, s: Pt, fp: Footprint = { cols: 1, rows: 1 }): { a: number; b: number; cols: number; rows: number } {
  const t = zoneGrid(z, s), cols = Math.min(fp.cols, z.cols), rows = Math.min(fp.rows, z.rows);
  const a = Math.max(0, Math.min(Math.round(t.a - cols / 2), z.cols - cols)), b = Math.max(0, Math.min(Math.round(t.b - rows / 2), z.rows - rows));
  return { a, b, cols, rows };
}

// The floor a piece stands on and the tiles it covers there (undefined: not on a floor)
export function standing(all: VElement[], e: VElement, footingOf?: FootingOf): { zone: VZone; a: number; b: number; cols: number; rows: number } | undefined {
  if (!isPiece(e)) return undefined;
  const f = footingOf?.(e);
  const z = all.filter((x): x is VZone => x.type === 'zone').reverse().find((z) => onZone(z, standPoint(e, z.flat, f?.at)));
  return z && { zone: z, ...footprintAt(z, standPoint(e, z.flat, f?.at), f?.footprint) };
}

// Floor tiles more than one vault piece stands on. A soft warning: nothing stops the drop, since a sketch may stack on purpose.
export function crowdedTiles(all: VElement[], footingOf?: FootingOf): { zone: VZone; a: number; b: number }[] {
  const count = new Map<string, { zone: VZone; a: number; b: number; n: number }>();
  for (const e of all) {
    const s = e.type === 'asset' ? standing(all, e, footingOf) : undefined;
    if (!s) continue;
    for (let a = s.a; a < s.a + s.cols; a++) for (let b = s.b; b < s.b + s.rows; b++) {
      const k = `${s.zone.id}:${a}:${b}`, c = count.get(k);
      if (c) c.n++; else count.set(k, { zone: s.zone, a, b, n: 1 });
    }
  }
  return Array.from(count.values()).filter((c) => c.n > 1);
}

// The move a drag lands on: a zone snaps to the page grid, so floors fit together edge to edge;
// a single piece over a zone clicks into the tiles under it (its footing, from `footingOf`); anything else snaps to the 8px grid.
export function dragDelta(p: DesignPage, base: VElement[], ids: string[], dx: number, dy: number, pull?: (b: Box) => { x?: number; y?: number }, footingOf?: FootingOf): Pt {
  const picked = base.filter((e) => ids.includes(e.id));
  const zone = picked.find((e): e is VZone => e.type === 'zone');
  if (zone) {
    const g = gridOf(p), at = toGrid(g, { x: zone.x + dx, y: zone.y + dy });
    const to = fromGrid(g, { a: Math.round(at.a), b: Math.round(at.b) });
    return { x: to.x - zone.x, y: to.y - zone.y };
  }
  const only = picked.length === 1 ? picked[0] : undefined;
  if (only && isPiece(only)) {
    // Floors draw in array order, so the last one under the piece is the one you see
    const zones = base.filter((e): e is VZone => e.type === 'zone').reverse();
    for (const z of zones) {
      const ft = footingOf?.(only), s = standPoint(only, z.flat, ft?.at), to = { x: s.x + dx, y: s.y + dy };
      if (!onZone(z, to)) continue;
      const f = footprintAt(z, to, ft?.footprint), mid = zonePoint(z, f.a + f.cols / 2, f.b + f.rows / 2);
      return { x: mid.x - s.x, y: mid.y - s.y };
    }
  }
  if (pull && picked.length) {
    const bs = picked.map((e) => visualBounds(e, base));
    const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
    const m = pull({ x: x + dx, y: y + dy, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y });
    return { x: m.x !== undefined ? Math.round(dx + m.x) : snap(dx), y: m.y !== undefined ? Math.round(dy + m.y) : snap(dy) };
  }
  return { x: snap(dx), y: snap(dy) };
}

// ── Geometry ────────────────────────────────────────────────────

export function boundsOf(el: VElement, all: VElement[]): Box {
  switch (el.type) {
    case 'zone': {
      const c = zoneCorners(el), xs = c.map((p) => p.x), ys = c.map((p) => p.y);
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    case 'stroke': {
      const xs = el.points.map((p) => p[0]), ys = el.points.map((p) => p[1]);
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    case 'status': { const s = el.size ?? 20; return { x: el.x, y: el.y, w: s, h: s }; }
    case 'line': {
      const [a, b] = lineEnds(el, all);
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      return { x, y, w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
    }
    default: return { x: el.x, y: el.y, w: el.w, h: el.h };
  }
}

const center = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

// ── Rotation ── stored on box elements, drawn as an SVG rotate around the box's center.

export const ROTATABLE: VType[] = ['rect', 'ellipse', 'capsule', 'poly', 'text', 'image', 'asset'];
export const rotationOf = (el: VElement) => (ROTATABLE.includes(el.type) && el.rotate && !planeOf(el) ? el.rotate : 0);   // a shape in a plane doesn't turn

// ── Planes ── A shape in a plane keeps x, y, w, h as its own flat box; drawing maps that box onto the plane, with its
// top-left corner (x, y) staying put. Units follow the grid: w = 2 × cell on the floor covers two tiles' edges.
export type Mat = [number, number, number, number];   // SVG matrix order: x' = m0·x + m2·y, y' = m1·x + m3·y
export const PLANES: Record<Plane, Mat> = {
  floor: [1, 0.5, -1, 0.5],   // the isometric floor: x runs down-right along tile columns, y down-left along rows
  roof:  [1, 0.5, -1, 0.5],   // the floor, lifted (liftOf): the top of a block
  left:  [1, 0.5, 0, 1],      // a block's left face: x runs down-right, y straight down
  right: [1, -0.5, 0, 1],     // a block's right face: x runs up-right, y straight down
};
export const PLANAR: VType[] = ['rect', 'ellipse', 'capsule', 'poly', 'text', 'image'];
export const SLOPE_MAX = 0.9;
// A sloped roof is the floor with one side tipped up: that side's direction also climbs `slope` px per px
export function planeOf(el: VElement): Mat | undefined {
  if (!PLANAR.includes(el.type) || !('plane' in el) || !el.plane) return undefined;
  const m = PLANES[el.plane];
  if (el.plane !== 'roof' || !el.slope) return m;
  const s = Math.max(-SLOPE_MAX, Math.min(el.slope, SLOPE_MAX));
  return el.slopeAlong === 'w' ? [m[0], m[1] - s, m[2], m[3]] : [m[0], m[1], m[2], m[3] - s];
}
export const ROOF_LIFT = 64;
export const liftOf = (el: VElement): number => (planeOf(el) && 'plane' in el && el.plane === 'roof' ? el.lift ?? ROOF_LIFT : 0);
export const mapPt = (m: Mat, p: Pt): Pt => ({ x: m[0] * p.x + m[2] * p.y, y: m[1] * p.x + m[3] * p.y });
export const invert = (m: Mat): Mat => { const d = m[0] * m[3] - m[2] * m[1]; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d]; };
// A point of the flat box (about origin o) where it's drawn, and back
export const onPlane = (m: Mat, o: Pt, p: Pt): Pt => { const q = mapPt(m, { x: p.x - o.x, y: p.y - o.y }); return { x: o.x + q.x, y: o.y + q.y }; };
export const offPlane = (m: Mat, o: Pt, p: Pt): Pt => onPlane(invert(m), o, p);

// A page point in the element's own unturned, flat box
export function toLocal(el: VElement, all: VElement[], p: Pt): Pt {
  const m = planeOf(el), b = boundsOf(el, all);
  if (m) return offPlane(m, b, { x: p.x, y: p.y + liftOf(el) });
  const deg = rotationOf(el);
  return deg ? rotatePt(p, center(b), -deg) : p;
}

// ── Solids ── A floor or roof shape with a height is swept straight up: its sides are the hull of its outline and the
// outline raised, its top face is the shape raised. Exact for convex shapes (box, cylinder, capsule slab); a pinched
// superellipse gets its hull's sides. Worked in the shape's own flat box, so it draws inside the plane's transform.

const EXTRUDABLE: VType[] = ['rect', 'ellipse', 'capsule', 'poly'];
export const heightOf = (el: VElement): number =>
  EXTRUDABLE.includes(el.type) && 'plane' in el && (el.plane === 'floor' || el.plane === 'roof') && el.height && el.height > 0 ? el.height : 0;

// The shape's outline, sampled, in its own flat box
export function outlineOf(el: VElement): Pt[] {
  const b = el as Box & { radius?: number; n?: number; taper?: number }, pts: Pt[] = [];
  const arc = (cx: number, cy: number, rx: number, ry: number, n = 48, e = 1) => {
    for (let i = 0; i < n; i++) {
      const t = (i / n) * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t);
      pts.push({ x: cx + rx * Math.sign(c) * Math.abs(c) ** e, y: cy + ry * Math.sign(s) * Math.abs(s) ** e });
    }
  };
  if (el.type === 'poly') return el.pts.map(([fx, fy]) => ({ x: b.x + fx * b.w, y: b.y + fy * b.h }));
  if (el.type === 'ellipse') return ellipsePoints(el, 96);
  else if (el.type === 'capsule') {   // the hull of its two end circles is the capsule
    const r1 = b.h / 2, r2 = Math.max(0.05, Math.min(b.taper ?? 1, 1)) * r1;
    arc(b.x + r1, b.y + r1, r1, r1); arc(Math.max(b.x + b.w - r2, b.x + r1), b.y + r1, r2, r2);
  } else {
    const r = Math.min(b.radius ?? 0, b.w / 2, b.h / 2);
    if (!r) pts.push({ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h });
    else for (const [cx, cy] of [[b.x + r, b.y + r], [b.x + b.w - r, b.y + r], [b.x + b.w - r, b.y + b.h - r], [b.x + r, b.y + b.h - r]]) arc(cx, cy, r, r, 16);
  }
  // Rounded boxes and capsules are sampled as whole circles at their corners/ends: their hull is the outline, in order
  return el.type === 'capsule' || pts.length > 4 ? hull(pts) : pts;
}

// A capsule only tapers one way (narrow end right); as a polygon it can face any way. Anything else comes back as it is
export function capsuleAsPoly(e: VElement): VElement {
  if (e.type !== 'capsule') return e;
  const frac = (v: number) => Math.min(1, Math.max(0, Math.round(v * 1e4) / 1e4));
  return { ...e, type: 'poly', taper: undefined, pts: hull(outlineOf(e)).map((p) => [frac((p.x - e.x) / e.w), frac((p.y - e.y) / e.h)]) } as unknown as VElement;
}

// The outline as drawn: with its shape effects (roughen…) applied. Solids sweep up from this
export function shapeOutline(el: VElement): Pt[] {
  return reshape(el, outlineOf(el), !(el.type === 'poly' && el.open));
}
// A shape whose effects change its outline draws as this path instead of its own rect/ellipse/…
export const reshapedPath = (el: VElement) => {
  const pts = shapeOutline(el);
  return `M${pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L')}${el.type === 'poly' && el.open ? '' : ' Z'}`;
};
export { reshapes };

export function hull(pts: Pt[]): Pt[] {   // monotone chain
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Pt[]) => { const h: Pt[] = []; for (const q of list) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); } h.pop(); return h; };
  return [...half(p), ...half([...p].reverse())];
}

// Straight up on the page, in the shape's own box: where its top face sits (up) and the outline of its sides. A shape
// with dents (a bush's bumps, a pinched star, a polygon) also gets `walls`: each edge swept up as its own quad, all
// wound the same way so they fill as one, keeping the dents a hull would iron out. Filled shapes only (see Solid).
export function extrusion(el: VElement): { up: Pt; sides: string; walls?: string } | undefined {
  const h = heightOf(el), m = planeOf(el);
  if (!h || !m) return undefined;
  const up = mapPt(invert(m), { x: 0, y: -h });
  const base = shapeOutline(el), all = [...base, ...base.map((p) => ({ x: p.x + up.x, y: p.y + up.y }))];
  const sides = `M${hull(all).map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L')} Z`;
  const dented = el.type === 'poly' || reshapes(el) || (el.type === 'ellipse' && (!!el.lobes || (el.n ?? 2) < 1));
  if (!dented || !('fill' in el && el.fill)) return { up, sides };
  const f = (p: Pt) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  const walls = base.map((p, i) => {
    const q = base[(i + 1) % base.length], quad = [p, q, { x: q.x + up.x, y: q.y + up.y }, { x: p.x + up.x, y: p.y + up.y }];
    const area = (q.x - p.x) * up.y - (q.y - p.y) * up.x;
    return `M${(area < 0 ? quad.reverse() : quad).map(f).join(' L')} Z`;
  }).join('');
  return { up, sides, walls };
}

// A roof's walls, in its own flat box: each outline edge dropped to the floor as a quad, all wound the same way so they
// fill as one (like a dented solid's walls). A point p of the roof lies over the floor point F(p) (the unsloped floor,
// no lift); `down` finds the local point that draws there through the roof's own matrix and lift.
export function roofWalls(el: VElement): string | undefined {
  if (!('plane' in el) || el.plane !== 'roof' || !el.walls || !('fill' in el) || !EXTRUDABLE.includes(el.type)) return undefined;
  const m = planeOf(el)!, inv = invert(m), lift = liftOf(el), b = el as VElement & Box;
  const down = (p: Pt): Pt => {
    const f = mapPt(PLANES.floor, { x: p.x - b.x, y: p.y - b.y }), q = mapPt(inv, { x: f.x, y: f.y + lift });
    return { x: b.x + q.x, y: b.y + q.y };
  };
  const base = shapeOutline(el), f = (p: Pt) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  return base.map((p, i) => {
    const q = base[(i + 1) % base.length], quad = [p, q, down(q), down(p)];
    const area = quad.reduce((s, a, k) => { const c = quad[(k + 1) % 4]; return s + a.x * c.y - c.x * a.y; }, 0);
    return `M${(area < 0 ? quad.reverse() : quad).map(f).join(' L')} Z`;
  }).join('');
}

// ── Shape paths ── in the element's own box, so planes, turns and eraser marks apply the same as for a rect

export const polyPath = (el: Box & { pts: [number, number][]; open?: boolean }) =>
  `M${el.pts.map(([fx, fy]) => `${(el.x + fx * el.w).toFixed(2)},${(el.y + fy * el.h).toFixed(2)}`).join(' L')}${el.open ? '' : ' Z'}`;

// A polygon from page points: its box, and the corners as fractions of it. Points in a plane go back to the flat box first.
export function polyFrom(points: Pt[]): Pick<VPoly, 'x' | 'y' | 'w' | 'h' | 'pts'> {
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y), x = Math.min(...xs), y = Math.min(...ys);
  const w = Math.max(Math.max(...xs) - x, 1), h = Math.max(Math.max(...ys) - y, 1);
  return { x, y, w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10, pts: points.map((p) => [Math.round(((p.x - x) / w) * 1e4) / 1e4, Math.round(((p.y - y) / h) * 1e4) / 1e4]) };
}

// An ellipse's outline, sampled: the superellipse |x/a|ⁿ + |y/b|ⁿ = 1 (points cluster where it bends, so a corner stays
// sharp), scalloped when it has lobes. Each bump is a rounded arch between two dips; the bumps differ a little in size,
// always the same way, so a bush looks grown rather than stamped.
type EllipseShape = Box & { n?: number; lobes?: number; lobeDepth?: number };
export const smoothEllipse = (el: EllipseShape) => (!el.n || el.n === 2) && !el.lobes;
export function ellipsePoints(el: EllipseShape, N = 144): Pt[] {
  const a = el.w / 2, r = el.h / 2, cx = el.x + a, cy = el.y + r, e = 2 / (el.n ?? 2);
  const pow = (v: number) => Math.sign(v) * Math.abs(v) ** e;
  const L = el.lobes ? Math.max(3, Math.min(24, Math.round(el.lobes))) : 0, d = Math.max(0.05, Math.min(0.8, el.lobeDepth ?? LOBE_DEPTH));
  const size = (k: number) => 0.86 + 0.14 * Math.abs(Math.sin(k * 2.39996 + 1));   // per bump, 0.86–1
  const n = L ? Math.max(N, L * 16) : N, pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI;
    let f = 1;
    if (L) { const at = (t / (2 * Math.PI)) * L, k = Math.floor(at); f = 1 - d + d * Math.sqrt(Math.sin(Math.PI * (at - k))) * size(k); }
    pts.push({ x: cx + a * f * pow(Math.cos(t)), y: cy + r * f * pow(Math.sin(t)) });
  }
  return pts;
}
export const ellipsePath = (el: EllipseShape) => `M${ellipsePoints(el).map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L')} Z`;
export const superellipsePath = (b: Box, n: number) => ellipsePath({ ...b, n });

// Two circles (left: radius h/2, right: taper × that) and their outer tangents
export function capsulePath(b: Box, taper = 1): string {
  const r1 = b.h / 2, r2 = Math.max(0.05, Math.min(taper, 1)) * r1, cy = b.y + r1;
  const c1 = b.x + r1, c2 = Math.max(b.x + b.w - r2, c1), d = c2 - c1;
  if (d <= r1 - r2) return `M${c1 - r1},${cy} a${r1},${r1} 0 1 0 ${2 * r1},0 a${r1},${r1} 0 1 0 ${-2 * r1},0 Z`;   // one circle holds the other
  const k = (r1 - r2) / d, s = Math.sqrt(1 - k * k);   // the tangent's normal: (k, ∓s)
  const p = (c: number, r: number, sy: number) => `${(c + r * k).toFixed(2)},${(cy + sy * r * s).toFixed(2)}`;
  return `M${p(c1, r1, -1)} L${p(c2, r2, -1)} A${r2},${r2} 0 ${k < 0 ? 1 : 0} 1 ${p(c2, r2, 1)} L${p(c1, r1, 1)} A${r1},${r1} 0 ${k > 0 ? 1 : 0} 1 ${p(c1, r1, -1)} Z`;
}

export function rotatePt(p: Pt, c: Pt, deg: number): Pt {
  const r = (deg * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r), dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

// The SVG transform that draws an element turned or in its plane, or undefined
export function rotateTransform(el: VElement, all: VElement[]): string | undefined {
  const m = planeOf(el);
  if (m) { const b = boundsOf(el, all), o = onPlane(m, b, { x: 0, y: 0 }); return `matrix(${m.join(' ')} ${o.x} ${o.y - liftOf(el)})`; }
  const deg = rotationOf(el);
  if (!deg) return undefined;
  const c = center(boundsOf(el, all));
  return `rotate(${deg} ${c.x} ${c.y})`;
}

// The box the element covers on the page once turned
// The points that outline what the element covers on the page: a turned or planed box's corners (and a solid's top
// corners), a line's ends, a stroke's points. Mapping these, not a box around them, keeps a projection tight.
export function coverPoints(el: VElement, all: VElement[]): Pt[] {
  if (el.type === 'line') return lineEnds(el, all);
  if (el.type === 'stroke') return el.points.map(([x, y]) => ({ x, y }));
  const b = boundsOf(el, all), deg = rotationOf(el), m = planeOf(el), up = liftOf(el), tall = heightOf(el);
  const corners: Pt[] = [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }];
  if (m) {
    const rise = tall ? mapPt(invert(m), { x: 0, y: -tall }) : null;
    const local = rise ? [...corners, ...corners.map((p) => ({ x: p.x + rise.x, y: p.y + rise.y }))] : corners;
    const out = local.map((p) => { const q = onPlane(m, b, p); return { x: q.x, y: q.y - up }; });
    return 'walls' in el && el.walls && el.plane === 'roof' ? [...out, ...corners.map((p) => onPlane(PLANES.floor, b, p))] : out;   // its walls reach the floor
  }
  return deg ? corners.map((p) => rotatePt(p, center(b), deg)) : corners;
}

// The box the element covers on the page once turned or laid in a plane
export function visualBounds(el: VElement, all: VElement[]): Box {
  if (!rotationOf(el) && !planeOf(el)) return boundsOf(el, all);
  const pts = coverPoints(el, all), xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// 0–359, whole degrees. Near a multiple of 45 it lands on it; with `step`, only on multiples of step,
// or on one of `also` (the isometric slope) when that's closer.
export function snapAngle(deg: number, step?: number, also: number[] = []): number {
  let d = step ? Math.round(deg / step) * step : Math.round(deg);
  if (step) for (const a of also) for (const k of [-360, 0, 360]) if (Math.abs(deg - (a + k)) < Math.abs(deg - d)) d = Math.round((a + k) * 100) / 100;
  const near45 = Math.round(d / 45) * 45;
  if (!step && Math.abs(d - near45) <= 3) d = near45;
  return Math.round((((d % 360) + 360) % 360) * 100) / 100;
}

// Where the ray from a box's center toward `toward` leaves the box (plus a small gap)
function edgePoint(b: Box, toward: Pt, gap = 6): Pt {
  const c = center(b), dx = toward.x - c.x, dy = toward.y - c.y;
  if (!dx && !dy) return c;
  const t = Math.min(dx ? (b.w / 2 + gap) / Math.abs(dx) : Infinity, dy ? (b.h / 2 + gap) / Math.abs(dy) : Infinity);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

// Same for a zone's real outline, which on an isometric floor is a diamond and not its bounding box
function zoneEdgePoint(z: VZone, toward: Pt, gap = 6): Pt {
  const c = zonePoint(z, z.cols / 2, z.rows / 2), dx = toward.x - c.x, dy = toward.y - c.y;
  const len = Math.hypot(dx, dy);
  if (!len) return c;
  const d = toGrid(z, { x: dx, y: dy });
  const t = Math.min(d.a ? z.cols / 2 / Math.abs(d.a) : Infinity, d.b ? z.rows / 2 / Math.abs(d.b) : Infinity);
  return { x: c.x + dx * t + (dx / len) * gap, y: c.y + dy * t + (dy / len) * gap };
}

// Resolved endpoints. An anchor to a missing element falls back to the artboard center (validate warns).
export function lineEnds(line: VLine, all: VElement[]): [Pt, Pt] {
  const fallback = { x: ARTBOARD.width / 2, y: ARTBOARD.height / 2 };
  const targetOf = (a: { el: string }) => all.find((e) => e.id === a.el && e.type !== 'line');
  const box = (a: { el: string }) => {
    const target = targetOf(a);
    return target ? boundsOf(target, all) : null;
  };
  const aimOf = (a: Anchor): Pt => {
    if (!isAttached(a)) return a;
    const b = box(a);
    return b ? center(b) : fallback;
  };
  const aimFrom = aimOf(line.from), aimTo = aimOf(line.to);
  // With a bend the line leaves toward its control point, not straight at the other end
  const ctrl = lineControl(aimFrom, aimTo, line.bend);
  const end = (a: Anchor, aim: Pt) => {
    if (!isAttached(a)) return a;
    const target = targetOf(a);
    if (target?.type === 'zone') return zoneEdgePoint(target, aim);
    const b = box(a);
    if (!b) return fallback;
    // A rotated box: find the edge in its own frame, then turn the point back
    const deg = rotationOf(target!), c = center(b);
    return deg ? rotatePt(edgePoint(b, rotatePt(aim, c, -deg)), c, deg) : edgePoint(b, aim);
  };
  return [end(line.from, ctrl ?? aimTo), end(line.to, ctrl ?? aimFrom)];
}

// Quadratic control point for a bend (twice the sideways offset, so the curve's midpoint sits at `bend`)
export function lineControl(a: Pt, b: Pt, bend?: number): Pt | null {
  if (!bend) return null;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  return { x: (a.x + b.x) / 2 - (dy / len) * bend * 2, y: (a.y + b.y) / 2 + (dx / len) * bend * 2 };
}

export const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const outOfBounds = (b: Box, sheet: { width: number; height: number } = ARTBOARD) =>
  b.x < 0 || b.y < 0 || b.x + b.w > sheet.width || b.y + b.h > sheet.height;

// ── Ops ─────────────────────────────────────────────────────────

const elementsOf = (p: DesignPage) => p.elements ?? [];
const withElements = (p: DesignPage, elements: VElement[]): DesignPage => ({ ...p, elements });

export function addElement(p: DesignPage, el: VElement): DesignPage {
  return withElements(p, [...elementsOf(p), el]);
}

export function updateElement(p: DesignPage, id: string, patch: Partial<VElement>): DesignPage {
  return withElements(p, elementsOf(p).map((e) => (e.id === id ? ({ ...e, ...patch, id, type: e.type } as VElement) : e)));
}

// Lines attached to a removed element keep their current position as a fixed point
export function removeElements(p: DesignPage, ids: string[]): DesignPage {
  const all = elementsOf(p), gone = new Set(ids);
  return withElements(p, all.filter((e) => !gone.has(e.id)).map((e) => {
    if (e.type !== 'line') return e;
    const [a, b] = lineEnds(e, all);
    return {
      ...e,
      from: isAttached(e.from) && gone.has(e.from.el) ? a : e.from,
      to:   isAttached(e.to)   && gone.has(e.to.el)   ? b : e.to,
    };
  }));
}

// Moves `ids` by (dx, dy), measured from a snapshot so a drag never accumulates rounding
export function translateElements(p: DesignPage, base: VElement[], ids: string[], dx: number, dy: number): DesignPage {
  const on = new Set(ids);
  const shift = (a: Anchor): Anchor => (isAttached(a) ? a : { x: a.x + dx, y: a.y + dy });
  return withElements(p, base.map((e) => {
    if (!on.has(e.id)) return e;
    if (e.type === 'stroke') return { ...e, points: e.points.map(([x, y]): [number, number] => [x + dx, y + dy]) };
    if (e.type === 'line')   return { ...e, from: shift(e.from), to: shift(e.to) };
    return { ...e, x: e.x + dx, y: e.y + dy };
  }));
}

export function reorderElements(p: DesignPage, ids: string[], to: 'front' | 'back'): DesignPage {
  const on = new Set(ids), all = elementsOf(p);
  const picked = all.filter((e) => on.has(e.id)), rest = all.filter((e) => !on.has(e.id));
  return withElements(p, to === 'front' ? [...rest, ...picked] : [...picked, ...rest]);
}

// Elements that should carry a `name`: everything but text, status dots and pen strokes, which say what they are
export const NAMED: VType[] = ['rect', 'ellipse', 'capsule', 'poly', 'line', 'image', 'asset', 'zone'];
export const unnamed = (els: VElement[]) => els.filter((e) => NAMED.includes(e.type) && !e.name?.trim());

// ── Groups and the clipboard ────────────────────────────────────

// The ids plus every element welded to one of them
export function withGroups(all: VElement[], ids: string[]): string[] {
  const groups = new Set(all.filter((e) => e.group && ids.includes(e.id)).map((e) => e.group));
  if (!groups.size) return ids;
  return Array.from(new Set([...ids, ...all.filter((e) => e.group && groups.has(e.group)).map((e) => e.id)]));
}

// Welds the elements into one new group (out of any group they were in)
export function groupElements(p: DesignPage, ids: string[]): DesignPage {
  const on = new Set(ids), group = `group-${rid()}`;
  return withElements(p, elementsOf(p).map((e) => (on.has(e.id) ? { ...e, group } : e)));
}

export function ungroupElements(p: DesignPage, ids: string[]): DesignPage {
  const on = new Set(ids);
  return withElements(p, elementsOf(p).map((e) => { if (!on.has(e.id) || !e.group) return e; const c = { ...e }; delete c.group; return c; }));
}

// Fresh copies with new ids. What pointed inside the set points at the copies: arrow ends, a painted floor (`on`),
// and groups, which become new groups of their own. What pointed outside stays on the same page (`samePage`), else goes.
function cloneElements(els: VElement[], samePage: boolean): VElement[] {
  const map = new Map(els.map((e) => [e.id, newId(e.type)])), groups = new Map<string, string>();
  const remap = (a: Anchor): Anchor => (isAttached(a) && map.has(a.el) ? { el: map.get(a.el)! } : a);
  return els.map((e) => {
    const c = structuredClone(e); c.id = map.get(e.id)!;
    if (c.type === 'line') { c.from = remap(c.from); c.to = remap(c.to); }
    if (c.on) { if (map.has(c.on)) c.on = map.get(c.on); else if (!samePage) delete c.on; }
    if (c.group) { if (!groups.has(c.group)) groups.set(c.group, `group-${rid()}`); c.group = groups.get(c.group); }
    return c;
  });
}

// What Copy holds: the elements, with line ends on anything not copied pinned where they are, and the layers they're on
export interface VClip { elements: VElement[]; layers: VLayer[] }
export function copyElements(p: DesignPage, ids: string[]): VClip {
  const all = elementsOf(p), on = new Set(ids);
  const elements = all.filter((e) => on.has(e.id)).map((e) => {
    const c = structuredClone(e);
    if (c.type === 'line' && e.type === 'line') {
      const [a, b] = lineEnds(e, all), loose = (x: Anchor) => isAttached(x) && !on.has(x.el);
      if (loose(c.from)) c.from = { x: a.x, y: a.y };
      if (loose(c.to)) c.to = { x: b.x, y: b.y };
    }
    return c;
  });
  const used = new Set(elements.map((e) => e.layer).filter(Boolean));
  return { elements, layers: (p.layers ?? []).filter((l) => used.has(l.id)).map((l) => ({ id: l.id, name: l.name })) };
}

// Pastes a copy as new elements (attachments, floors and groups kept among themselves) and brings missing layers along.
// Back on the page it came from it steps aside like Duplicate; on another page it keeps its place, moved inside the
// page if it would hang off (in whole grid steps, so floors still line up with the page's lattice).
export function pasteElements(p: DesignPage, clip: VClip): { page: DesignPage; ids: string[] } {
  const all = elementsOf(p), copies = cloneElements(clip.elements, false);
  const g = gridOf(p), sx = g.flat ? g.cell : 2 * g.cell, sy = g.cell, size = pageSize(p);
  let dx = 0, dy = 0;
  if (clip.elements.some((e) => all.some((x) => x.id === e.id))) {
    const z = copies.some((c) => c.type === 'zone');
    dx = z ? sx : 24; dy = z ? 0 : 24;
  } else if (copies.length) {
    const bs = copies.map((c) => visualBounds(c, copies));
    const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y));
    const x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h));
    // Whole steps toward the inside; a copy bigger than the page lines up with its top left
    const fit = (lo: number, hi: number, max: number, step: number) => {
      const d = lo < 0 || hi - lo > max ? -lo : hi > max ? max - hi : 0;
      return d > 0 ? Math.ceil(d / step) * step : d < 0 ? Math.floor(d / step) * step : 0;
    };
    dx = fit(x0, x1, size.width, sx); dy = fit(y0, y1, size.height, sy);
  }
  const moved = translateElements({ ...p, elements: copies }, copies, copies.map((c) => c.id), dx, dy).elements ?? [];
  const have = layersOf(p), missing = clip.layers.filter((l) => !have.some((h) => h.id === l.id));
  const layers = missing.length ? [...have, ...missing] : p.layers;
  return { page: { ...withElements(p, [...all, ...moved]), ...(layers ? { layers } : {}) }, ids: moved.map((c) => c.id) };
}

// Copies keep attachments, floors and groups among themselves (cloneElements); attachments to anything else stay on the original
export function duplicateElements(p: DesignPage, ids: string[], offset = 24): { page: DesignPage; ids: string[] } {
  const all = elementsOf(p), on = new Set(ids), copies = cloneElements(all.filter((e) => on.has(e.id)), true);
  // A copied zone steps one tile along its own grid, so it still fits the floors around it
  const z = copies.find((c): c is VZone => c.type === 'zone');
  const step = z ? fromGrid(z, { a: 1, b: 0 }) : { x: offset, y: offset };
  const moved = translateElements({ ...p, elements: copies }, copies, copies.map((c) => c.id), step.x, step.y).elements ?? [];
  return { page: withElements(p, [...all, ...moved]), ids: moved.map((c) => c.id) };
}
