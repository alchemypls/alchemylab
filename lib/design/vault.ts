// The vault: global assets the Fab canvas makes, as files in vault/assets/<id>.json. Agent and canvas both write them.
// A vector asset is a vector page with a `kind`. A page places one with an `asset` element that names it,
// so editing the asset changes every page using it. Pure data + ops. Imports stay relative (CLI).

import { pageSize, type DesignPage } from './types';
import { newStructure, structureSize, structureTurner, type Structure } from './structure';
import { capsuleAsPoly, coverPoints, polyFrom, type VPoly, dragDelta, fromGrid, gridOf, invert, mapPt, offPlane, onPlane, PLANES, rotatePt, standing, toGrid, zonePoint, type Mat, visualBounds, newId, onZone, snap, type Box, type Footing, type Footprint, type Pt, type VAsset, type VElement, type VZone } from './vector';

// A shape or icon is visual identity. A block is a game piece: drawn on top of its footprint, it stands on floor tiles.
export const ASSET_KINDS = ['shape', 'icon', 'block'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];
export type VaultAsset = DesignPage & {
  kind: AssetKind;
  part?: BlockPart;        // a block's part: what structures build with it, or a structure (see Parts). Default object
  structure?: Structure;   // a structure's floors, walls, objects per level (lib/design/structure.ts). Its drawing is built from them
  wall?: { h: number; t?: number };   // a wall part: how tall and thick, in tiles (thickness default walls.ts WALL_T)
  footprint?: Footprint;   // a block's tiles on a floor, centered under it; default 1×1. Atoms are always 1×1
  dims?: Dims;             // the real thing's size: the spec the drawing is drawn to
};

// A real-world bounding box: length × width × height (a cylinder: length × diameter). Inches first, mm alongside.
// `estimated`: a modeling target, not a verified spec. Metadata only: nothing is sized from it.
export interface Dims { in: number[]; mm?: number[]; estimated?: boolean; note?: string }
export const dimsText = (d: Dims, unit: 'in' | 'mm' = 'in') => { const v = unit === 'in' ? d.in : d.mm; return v ? `${v.join(' × ')} ${unit}` : ''; };

export const FOOTPRINT_MAX = 16;

// ── Parts ── A block is one of four parts. Floors, walls and roofs are atoms: a structure is built from them on Fab and
// they reshape to fit it (a wall's joints, a roof's slope); an object is a piece that never changes shape (a flipper, a
// chest). Atoms are drawn on one tile. A part's layers are its states: a structure shows the one that fits where it is.
//   floor  one tile, flat on the floor plane
//   wall   one tile-long length on each face it can stand on: `left` runs along the floor's columns, `right` along its
//          rows (empty right: the left one, mirrored). Joints stand on the grid corner where they meet, by how many
//          walls meet there: end (1), corner (2 at an angle), tee (3), cross (4). Two in a line need none
//   roof   one tile of its surface, flat (the roof slopes it), its eave (the low edge) and ridge (the top)
export const PARTS = ['object', 'floor', 'wall', 'roof'] as const;
export type Part = (typeof PARTS)[number];
export type BlockPart = Part | 'structure';   // a structure: built from the others on Fab, placed like any block
export const PART_LABEL: Record<BlockPart, string> = { object: 'Objects', floor: 'Floors', wall: 'Walls', roof: 'Roofs', structure: 'Structures' };
export const PART_LAYERS: Record<Exclude<Part, 'object'>, { id: string; name: string }[]> = {
  floor: [{ id: 'base', name: 'Tile' }],
  wall: [{ id: 'faces', name: 'Faces' }, { id: 'end', name: 'Joint: end' }, { id: 'corner', name: 'Joint: corner' }, { id: 'tee', name: 'Joint: tee' }, { id: 'cross', name: 'Joint: cross' }],
  roof: [{ id: 'surface', name: 'Surface' }, { id: 'eave', name: 'Eave' }, { id: 'ridge', name: 'Ridge' }],
};
export const WALL_H = 3;   // tiles, a new wall's height
export const partOf = (a: VaultAsset): BlockPart | undefined => (a.kind === 'block' ? a.part ?? 'object' : undefined);
export const isAtom = (a: VaultAsset) => { const p = partOf(a); return !!p && p !== 'object' && p !== 'structure'; };
export const isStructure = (a?: VaultAsset) => !!a && partOf(a) === 'structure';
// The Fab editor a vault file opens in
export const fabEditorFor = (a?: Pick<VaultAsset, 'kind' | 'part'>): 'identity' | 'blocks' | 'structures' =>
  a?.kind !== 'block' ? 'identity' : a.part === 'structure' ? 'structures' : 'blocks';

// Where an atom's drawing goes on its sheet, as guides under it (Fab): a wall's two faces (left along the tile's front-left
// edge, right along its front-right edge, meeting at the joint corner), a floor's or roof's tile is its footprint
// n: strip tiles shown (structure.ts STRIP): each face's outline per tile, the single's first
export function partGuides(a: VaultAsset, n = 1): { name: string; pts: Pt[] }[] {
  if (partOf(a) !== 'wall') return [];
  const [, c1, c2, c3] = blockFloor(a).corners, cell = gridOf(a).cell, up = (a.wall?.h ?? WALL_H) * cell;
  const at = (p: Pt, dx: number, dy: number) => ({ x: p.x + dx, y: p.y + dy }), raise = (p: Pt) => ({ x: p.x, y: p.y - up });
  return Array.from({ length: n }, (_, k) => {
    const l = { x: -k * cell, y: -k * cell / 2 }, r = { x: k * cell, y: -k * cell / 2 }, L = [at(c3, l.x, l.y), at(c2, l.x, l.y)], R = [at(c2, r.x, r.y), at(c1, r.x, r.y)];
    return [{ name: `Left face${k ? ` ${k + 1}` : ''}`, pts: [L[0], L[1], raise(L[1]), raise(L[0])] }, { name: `Right face${k ? ` ${k + 1}` : ''}`, pts: [R[0], R[1], raise(R[1]), raise(R[0])] }];
  }).flat();
}

// A new atom's first drawing, on its layers: plain faces, a plain tile. Something to draw over, not a blank sheet
function starter(a: VaultAsset): VElement[] {
  const part = partOf(a), cell = gridOf(a).cell, [c0] = blockFloor(a).corners;
  const edge = { stroke: '#1f1b16', strokeWidth: 1.5 };
  if (part === 'floor' || part === 'roof') return [{ id: newId('rect'), type: 'rect', name: part === 'floor' ? 'tile' : 'surface', layer: part === 'floor' ? 'base' : 'surface', plane: 'floor', x: c0.x, y: c0.y, w: cell, h: cell, fill: part === 'floor' ? '#d9c9a3' : '#b3202a', ...edge }];
  if (part !== 'wall') return [];
  return partGuides(a).map((g, i) => {
    const plane = i ? 'right' : 'left', o = g.pts[3];   // a face's box starts at its top left
    return { id: newId('rect'), type: 'rect', name: g.name.toLowerCase(), layer: 'faces', plane, x: o.x, y: o.y, w: cell, h: (a.wall?.h ?? WALL_H) * cell, fill: i ? '#cdbb92' : '#e8dcc0', ...edge } as VElement;
  });
}

export const KIND_LABEL: Record<AssetKind, string> = { shape: 'Shapes', icon: 'Icons', block: 'Blocks' };

const MAX_PLACED = 480;   // a large drawing lands at this size at most
const ICON_PLACED = 96;

const BLOCK_CELL = 64;   // a new block's tile size on its sheet. A floor's tile size scales it when placed

export function newAsset(kind: AssetKind, title: string, today: string, part?: BlockPart): VaultAsset {
  const base = { kind, title, updated: today, blocks: [], elements: [] };
  if (kind === 'icon') return { ...base, size: { width: 256, height: 256 }, grid: { cell: 16, flat: true } };
  if (kind === 'block' && part === 'structure') {
    const footprint = { cols: 6, rows: 6 }, structure = newStructure();
    return { ...base, part, footprint, structure, size: structureSize(footprint, structure, BLOCK_CELL), grid: { cell: BLOCK_CELL } };
  }
  if (kind === 'block' && part && part !== 'object') {
    const a: VaultAsset = { ...base, part, ...(part === 'wall' && { wall: { h: WALL_H } }), layers: PART_LAYERS[part as Exclude<Part, 'object'>], size: { width: 1024, height: 1024 }, grid: { cell: BLOCK_CELL } };
    return { ...a, elements: starter(a) };
  }
  if (kind === 'block') return { ...base, size: { width: 1024, height: 1024 }, grid: { cell: BLOCK_CELL } };
  return { ...base, size: { width: 1024, height: 1024 } };
}

// ── Projection ── A block is drawn in one view (its sheet's grid) and can stand on a floor of the other.
// Its floor plane maps tile for tile, so an isometric diamond becomes a top-down square and back. This is exact for
// what lies on the floor (a flipper, a bumper's base); anything drawn rising off it gets sheared, since a 2D drawing
// has no height to project.
const FLAT_TO_ISO = PLANES.floor, ISO_TO_FLAT = invert(PLANES.floor);   // the floor plane is exactly flat → isometric
const WALL_BAND = 10;   // px a wall is thick when seen from above
const bboxOf = (c: Pt[]): Box => {
  const x = Math.min(...c.map((p) => p.x)), y = Math.min(...c.map((p) => p.y));
  return { x, y, w: Math.max(...c.map((p) => p.x)) - x, h: Math.max(...c.map((p) => p.y)) - y };
};

// The turn that stands a block on a floor of view `flat` (undefined: same view as its sheet, no view given, or not a block)
export function blockProjection(a: VaultAsset, flat?: boolean): Mat | undefined {
  if (a.kind !== 'block' || flat === undefined || !!gridOf(a).flat === flat) return undefined;
  return flat ? ISO_TO_FLAT : FLAT_TO_ISO;
}

// Seen from above, a block's walls stand edge-on: each shape in a wall plane squashes to its base edge on the floor,
// drawn as a thin band in its own style, like a floor plan. Floor-plane shapes map exactly; flat ones shear. Text on a wall is dropped.
export function projectedElements(a: VaultAsset, flat?: boolean): VElement[] {
  const els = a.elements ?? [];
  if (!flat || !blockProjection(a, flat)) return els;
  return els.flatMap((e): VElement[] => {
    const plane = 'plane' in e ? e.plane : undefined;
    if (plane === 'roof' || (plane === 'floor' && 'height' in e && e.height)) return [{ ...e, plane: 'floor', lift: undefined, slope: undefined, slopeAlong: undefined, height: undefined } as VElement];   // from above: its footprint   // from above, a roof covers its footprint
    if (!plane && e.upright && 'w' in e && 'x' in e) {   // stands up: from above, itself, centered over the floor under its bottom
      const over = mapPt(ISO_TO_FLAT, { x: e.x + e.w / 2, y: e.y + e.h + (e.base ?? 0) });
      const at = mapPt(FLAT_TO_ISO, { x: over.x - e.w / 2, y: over.y - e.h / 2 });   // a floor shape's box lands here unsheared
      return [{ ...e, plane: 'floor', x: at.x, y: at.y, rotate: undefined, upright: undefined, base: undefined } as VElement];
    }
    if (plane !== 'left' && plane !== 'right') return [e];
    if (e.type === 'text') return [];
    // A thin band along its base edge, laid out on the flat floor so it comes out even, wearing the wall's own fill,
    // border and dash (a wall with neither gets an ink line)
    const b = e as Box & { fill?: string; stroke?: string; strokeWidth?: number; dash?: VPoly['dash'] }, m = PLANES[plane];
    const q0 = mapPt(ISO_TO_FLAT, onPlane(m, b, { x: b.x, y: b.y + b.h })), q1 = mapPt(ISO_TO_FLAT, onPlane(m, b, { x: b.x + b.w, y: b.y + b.h }));
    const len = Math.hypot(q1.x - q0.x, q1.y - q0.y) || 1, nx = (-(q1.y - q0.y) / len) * WALL_BAND / 2, ny = ((q1.x - q0.x) / len) * WALL_BAND / 2;
    const band = [{ x: q0.x + nx, y: q0.y + ny }, { x: q1.x + nx, y: q1.y + ny }, { x: q1.x - nx, y: q1.y - ny }, { x: q0.x - nx, y: q0.y - ny }].map((q) => mapPt(FLAT_TO_ISO, q));
    const bare = !b.fill && !b.stroke;
    return [{
      id: e.id, type: 'poly', layer: e.layer, opacity: e.opacity, ...polyFrom(band),
      fill: b.fill, stroke: bare ? '#1f1c17' : b.stroke, strokeWidth: b.strokeWidth, dash: b.dash,
    } as VElement];
  });
}

// A block's isometric sheet seen from above, for Fab's top-down preview: the SVG transform for its drawing
// (projectedElements) and its footprint's corners. The footprint's first corner lands on the flat grid, so tiles line up.
export function topDownView(a: VaultAsset): { transform: string; corners: Pt[] } | undefined {
  if (!blockProjection(a, true)) return undefined;
  const f = blockFloor(a), g = gridOf(a), o = f.corners[0];
  const to = { x: Math.round(o.x / g.cell) * g.cell, y: Math.round(o.y / g.cell) * g.cell };
  const at = (p: Pt) => { const q = mapPt(ISO_TO_FLAT, { x: p.x - o.x, y: p.y - o.y }); return { x: to.x + q.x, y: to.y + q.y }; };
  const e = at({ x: 0, y: 0 }), m = ISO_TO_FLAT;
  return { transform: `matrix(${m.join(' ')} ${e.x} ${e.y})`, corners: f.corners.map(at) };
}

// Where a block's footprint sits on its own sheet: on the sheet's grid, centered a little below the middle,
// so drawing to the grid builds on its tiles. Its center is where the block stands. With `flat`, as projected onto that view.
export function blockFloor(a: VaultAsset, flat?: boolean): { corners: Pt[]; center: Pt; cell: number } {
  const m = blockProjection(a, flat);
  if (m) { const f = blockFloor(a); return { corners: f.corners.map((p) => mapPt(m, p)), center: mapPt(m, f.center), cell: f.cell }; }
  const g = gridOf(a), { width, height } = pageSize(a), fp = a.footprint ?? { cols: 1, rows: 1 };
  const half = fromGrid(g, { a: fp.cols / 2, b: fp.rows / 2 });
  const t = toGrid(g, { x: width / 2 - half.x, y: height * 0.6 - half.y }), o = fromGrid(g, { a: Math.round(t.a), b: Math.round(t.b) });
  const at = (ta: number, tb: number) => { const p = fromGrid(g, { a: ta, b: tb }); return { x: o.x + p.x, y: o.y + p.y }; };
  return { corners: [at(0, 0), at(fp.cols, 0), at(fp.cols, fp.rows), at(0, fp.rows)], center: at(fp.cols / 2, fp.rows / 2), cell: g.cell };
}

// ── Turning ── A placed block can turn about where it stands. Seen top-down, any angle is exact: the drawing spins.
// Seen isometric, only quarter turns can be redrawn: the block is rebuilt on its floor a quarter turn around (quarterTurn),
// its footprint's columns and rows swap, and the view is drawn again from the same corner.

const quarterOf = (turn: number) => ((Math.round(turn / 90) % 4) + 4) % 4;
const turnedFootprint = (fp: Footprint, turn: number): Footprint => (quarterOf(turn) % 2 ? { cols: fp.rows, rows: fp.cols } : fp);

// One quarter turn of an isometric block, rebuilt on its sheet. Floor and roof shapes turn exactly (a capsule becomes a
// polygon, so its taper can face any way); walls move to the face they now stand along; flat shapes, lines and strokes
// move as if standing on the floor (they don't turn: a flat drawing has no depth to turn). Text keeps reading the same way.
function quarterTurn(a: VaultAsset): VaultAsset {
  const fp = a.footprint ?? { cols: 1, rows: 1 }, cell = gridOf(a).cell, H = fp.rows * cell;
  const next: VaultAsset = { ...a, footprint: { cols: fp.rows, rows: fp.cols } };
  const O = blockFloor(a).corners[0], O2 = blockFloor(next).corners[0], F = PLANES.floor;
  const toFloor = (p: Pt): Pt => { const q = offPlane(F, O, p); return { x: q.x - O.x, y: q.y - O.y }; };   // px along columns, rows
  const fromFloor = (q: Pt): Pt => onPlane(F, O2, { x: O2.x + q.x, y: O2.y + q.y });
  const spin = (q: Pt): Pt => ({ x: H - q.y, y: q.x });   // columns become rows
  const move = (p: Pt) => fromFloor(spin(toFloor(p)));
  const r1 = (v: number) => Math.round(v * 100) / 100;
  const poly = capsuleAsPoly;
  const turnRubs = (e: VElement, w: number, h: number, f: (x: number, y: number) => [number, number]) =>
    e.erased?.map((r) => ({ ...r, pts: r.pts.flatMap((_, i) => (i % 2 ? [] : f(r.pts[i], r.pts[i + 1]))) })) ?? undefined;

  next.elements = (a.elements ?? []).map((e0): VElement => {
    const plane = 'plane' in e0 ? e0.plane : undefined;
    if (plane === 'floor' || plane === 'roof') {
      const e = poly(e0) as VElement & Box, b = toFloor(e);
      if (e.type === 'text' || e.type === 'image') {   // moves, keeps reading the same way
        const c = spin({ x: b.x + e.w / 2, y: b.y + e.h / 2 }), p = fromFloor({ x: c.x - e.w / 2, y: c.y - e.h / 2 });
        return { ...e, x: r1(p.x), y: r1(p.y) };
      }
      const p = fromFloor({ x: H - (b.y + e.h), y: b.x }), out = { ...e, x: r1(p.x), y: r1(p.y), w: e.h, h: e.w } as VElement & Box & Record<string, unknown>;
      if (e.type === 'poly') out.pts = e.pts.map(([fx, fy]) => [r1(1 - fy), fx]);
      out.erased = turnRubs(e, e.w, e.h, (x, y) => [r1(e.h - y), x]);
      if (plane === 'roof' && 'slope' in e && e.slope) {   // its rise turns with it: along h becomes falling along w
        if (e.slopeAlong === 'w') out.slopeAlong = undefined;
        else { out.slopeAlong = 'w'; out.slope = -e.slope; out.lift = r1((e.lift ?? 64) + e.slope * e.h); }
      }
      return out as VElement;
    }
    if (plane === 'left' || plane === 'right') {   // stands on the floor along its base edge, which turns
      const e = poly(e0) as VElement & Box, m = PLANES[plane];
      const b0 = spin(toFloor({ x: e.x, y: e.y + e.h })), b1 = spin(toFloor(onPlane(m, e, { x: e.x + e.w, y: e.y + e.h })));
      const du = b1.x - b0.x, dv = b1.y - b0.y, alongU = Math.abs(du) > Math.abs(dv);
      const flip = alongU ? du < 0 : dv > 0;   // left faces run along +columns, right faces along -rows
      const base = fromFloor(flip ? b1 : b0), out = { ...e, plane: alongU ? 'left' : 'right', x: r1(base.x), y: r1(base.y - e.h) } as VElement & Box & Record<string, unknown>;
      if (flip && e.type === 'poly') out.pts = e.pts.map(([fx, fy]) => [r1(1 - fx), fy]);
      if (flip) out.erased = turnRubs(e, e.w, e.h, (x, y) => [r1(e.w - x), y]);
      return out as VElement;
    }
    if (e0.type === 'line') {
      const end = (q: typeof e0.from) => ('el' in q ? q : (({ x, y }) => ({ x: r1(x), y: r1(y) }))(move(q)));
      return { ...e0, from: end(e0.from), to: end(e0.to) };
    }
    if (e0.type === 'stroke') return { ...e0, points: e0.points.map(([x, y]) => { const q = move({ x, y }); return [r1(q.x), r1(q.y)] as [number, number]; }) };
    if ('w' in e0 && 'x' in e0) {   // a flat shape: stands on the floor under its bottom middle (and its base)
      const s = { x: e0.x + e0.w / 2, y: e0.y + e0.h + (e0.base ?? 0) }, t = move(s);
      return { ...e0, x: r1(e0.x + t.x - s.x), y: r1(e0.y + t.y - s.y) };
    }
    return e0;
  });
  return next;
}

export function turnedAsset(a: VaultAsset, quarters: number): VaultAsset {
  if (a.kind !== 'block' || gridOf(a).flat) return a;
  const built = structureTurner(a);   // a built structure turns its data and builds that
  if (built) return built(quarters);
  let out = a;
  for (let i = 0; i < ((quarters % 4) + 4) % 4; i++) out = quarterTurn(out);
  return out;
}

// What a placed block shows for its turn, in view `flat`: top-down it spins by `spin` degrees about where it stands;
// isometric, it's rebuilt to the nearest quarter turn
export function shownBlock(a: VaultAsset, flat?: boolean, turn = 0): { a: VaultAsset; spin: number } {
  if (a.kind !== 'block' || !turn) return { a, spin: 0 };
  return flat ?? !!gridOf(a).flat ? { a, spin: ((turn % 360) + 360) % 360 } : { a: turnedAsset(a, quarterOf(turn)), spin: 0 };
}

export type Pose = Pick<VAsset, 'turn' | 'mirror'>;
type M2 = [number, number, number, number];

// How a placed block is drawn: which sheet (turned by quarters when isometric), its projection, then a mirror and a spin
// about where it stands. Mirroring flips the block end to end along its columns (a left flipper from a right one; the
// footprint stays). Top-down that's a plain flip; isometric it's the sheet turned back a quarter, then the picture flipped
// sideways (which swaps the floor's columns and rows), so walls stay upright. `place` takes a sheet point to the drawn
// view; `transform` is the same for SVG.
export function blockPose(a: VaultAsset, flat?: boolean, pose: Pose = {}) {
  const iso = a.kind === 'block' && !(flat ?? !!gridOf(a).flat);
  const { a: shown, spin } = iso && pose.mirror ? { a: turnedAsset(a, -1 - quarterOf(pose.turn ?? 0)), spin: 0 } : shownBlock(a, flat, pose.turn ?? 0);
  const m = blockProjection(shown, flat), f = blockFloor(shown, flat), c = f.center;
  const mir: M2 | null = pose.mirror ? [-1, 0, 0, 1] : null;
  const after = (q: Pt): Pt => {   // mirror and spin, for points already in the drawn view
    if (mir) q = { x: c.x + mir[0] * (q.x - c.x) + mir[2] * (q.y - c.y), y: c.y + mir[1] * (q.x - c.x) + mir[3] * (q.y - c.y) };
    return spin ? rotatePt(q, c, spin) : q;
  };
  const transform = [
    spin && `rotate(${spin} ${c.x} ${c.y})`,
    mir && `matrix(${mir.join(' ')} ${c.x - mir[0] * c.x - mir[2] * c.y} ${c.y - mir[1] * c.x - mir[3] * c.y})`,
    m && `matrix(${m.join(' ')} 0 0)`,
  ].filter(Boolean).join(' ') || undefined;
  const fp = turnedFootprint(a.footprint ?? { cols: 1, rows: 1 }, pose.turn ?? 0);
  return {
    shown, center: c, transform, corners: f.corners.map(after),
    place: (p: Pt) => after(m ? mapPt(m, p) : p),
    footprint: fp,
  };
}

// The part of the sheet that gets placed. An icon keeps its whole sheet, so a set of icons lines up.
// A shape is trimmed to its drawing, so empty sheet doesn't count toward its size. A block is as it's drawn in view
// `flat`, posed (turned, mirrored).
export function assetView(a: VaultAsset, flat?: boolean, pose: Pose = {}): Box {
  const sheet = pageSize(a);
  if (a.kind === 'block') {   // a block's box always holds its footprint, so where it stands is inside it
    const b = blockPose(a, flat, pose), els = projectedElements(b.shown, flat);
    const v = bboxOf([...els.flatMap((e) => coverPoints(e, els).map(b.place)), ...b.corners]);
    return { ...v, w: Math.max(v.w, 1), h: Math.max(v.h, 1) };
  }
  const els = a.elements ?? [];
  if (a.kind === 'icon' || !els.length) return { x: 0, y: 0, w: sheet.width, h: sheet.height };
  const boxes = els.map((e) => visualBounds(e, els));
  const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
  return { x, y, w: Math.max(Math.max(...boxes.map((b) => b.x + b.w)) - x, 1), h: Math.max(Math.max(...boxes.map((b) => b.y + b.h)) - y, 1) };
}

// How a placed block covers its footprint and where in its box it stands. Other kinds have none.
export function footingOf(a: VaultAsset, flat?: boolean, pose: Pose = {}): Footing | undefined {
  if (a.kind !== 'block') return undefined;
  const v = assetView(a, flat, pose), b = blockPose(a, flat, pose), c = b.center;   // a mirror or spin keeps c put
  return { footprint: b.footprint, at: { x: (c.x - v.x) / v.w, y: (c.y - v.y) / v.h } };
}

// A block lands at the scale of the tiles it's placed on (`cell`), so a 2×1 block covers two of them
export function placedSize(a: VaultAsset, cell = 32, flat?: boolean, pose: Pose = {}): { w: number; h: number } {
  if (a.kind === 'block') {
    const v = assetView(a, flat, pose), k = cell / blockFloor(a).cell;
    return { w: Math.max(Math.round(v.w * k), 4), h: Math.max(Math.round(v.h * k), 4) };
  }
  if (a.kind === 'icon') return { w: ICON_PLACED, h: ICON_PLACED };
  const v = assetView(a), scale = Math.min(MAX_PLACED / Math.max(v.w, v.h), 1);
  return { w: Math.max(Math.round(v.w * scale), 16), h: Math.max(Math.round(v.h * scale), 16) };
}

// Puts an asset on a page at this point. Over a floor it stands on the tiles under the point.
export function placeAsset(page: DesignPage, id: string, a: VaultAsset, at: Pt): { page: DesignPage; id: string } {
  const els = page.elements ?? [];
  const floor = [...els].reverse().find((e): e is VZone => e.type === 'zone' && onZone(e, at));
  const flat = !!(floor ? floor.flat : gridOf(page).flat), proj = !!blockProjection(a, flat);
  const { w, h } = placedSize(a, floor?.cell ?? gridOf(page).cell, flat), footing = footingOf(a, flat);
  const el: VAsset = {
    id: newId('asset'), type: 'asset', asset: id, w, h, ...(footing?.at && { at: roundAt(footing.at) }), ...(proj && { projected: true }),
    x: at.x - w * (footing?.at?.x ?? 0.5),
    y: at.y - h * (footing?.at?.y ?? (floor && !floor.flat ? 1 : 0.5)),   // an isometric floor holds a piece by its base
  };
  if (!floor) { el.x = snap(el.x); el.y = snap(el.y); }
  const next = [...els, el], d = floor ? dragDelta(page, next, [el.id], 0, 0, undefined, () => footing) : { x: 0, y: 0 };
  return { page: { ...page, elements: [...els, { ...el, x: el.x + d.x, y: el.y + d.y }] }, id: el.id };
}

const roundAt = (p: Pt): Pt => ({ x: Math.round(p.x * 1e4) / 1e4, y: Math.round(p.y * 1e4) / 1e4 });
const r2 = (v: number) => Math.round(v * 100) / 100;

// A placed block's box comes from the vault, so an edit on Fab refits every page using it: same size as its
// footprint's tiles, standing where it stood (on a floor, on the same tiles). A page only moves and tints a block.
// Returns the same page when nothing changes.
export function fitBlocks(page: DesignPage, assetOf: (id: string) => VaultAsset | undefined): DesignPage {
  const els = page.elements;
  if (!els?.some((e) => e.type === 'asset')) return page;
  let changed = false;
  const out = els.map((e): VElement => {
    if (e.type !== 'asset') return e;
    const a = assetOf(e.asset), f = a && footingOf(a, undefined, e);
    if (!a || !f?.at) return e;
    const s = standing(els, e, () => f), flat = !!(s ? s.zone.flat : gridOf(page).flat);
    const nf = footingOf(a, flat, e)!, at = roundAt(nf.at!), own = e.at ?? at, projected = !!blockProjection(a, flat) || undefined;
    const { w, h } = placedSize(a, s?.zone.cell ?? gridOf(page).cell, flat, e);
    const c = s ? zonePoint(s.zone, s.a + s.cols / 2, s.b + s.rows / 2) : { x: e.x + e.w * own.x, y: e.y + e.h * own.y };
    const x = r2(c.x - w * at.x), y = r2(c.y - h * at.y);
    if (x === e.x && y === e.y && w === e.w && h === e.h && e.at?.x === at.x && e.at?.y === at.y && !e.rotate && e.projected === projected) return e;
    changed = true;
    return { ...e, x, y, w, h, at, projected, rotate: undefined };
  });
  return changed ? { ...page, elements: out } : page;
}

// One color in place of every color in the drawing. Parts with no fill or stroke stay without one.
export function tintElements(els: VElement[], tint?: string): VElement[] {
  if (!tint) return els;
  return els.map((e) => {
    const out = { ...e } as Record<string, unknown>;
    for (const k of ['fill', 'stroke', 'color', 'bg']) if (out[k]) out[k] = tint;
    if (e.type === 'stroke' || e.type === 'text') out.color = tint;
    return out as unknown as VElement;
  });
}

export const usesAsset = (page: { elements?: unknown }, id: string) =>
  Array.isArray(page.elements) && page.elements.some((e) => (e as { type?: string; asset?: string })?.type === 'asset' && (e as { asset?: string }).asset === id);
