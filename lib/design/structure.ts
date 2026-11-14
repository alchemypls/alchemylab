// Structures: set pieces built on Fab from atoms (vault.ts Parts), Sims style. A structure is a block (part 'structure')
// whose drawing isn't stored: it's built from data, its atoms' own drawings put in place, so editing an atom changes
// every structure using it. Floors fill tiles; walls stand on the grid lines between tiles; objects stand on tiles.
// Levels stack: each sits `h` tiles above the one below. Pure. Imports stay relative (CLI).

import { blockFloor, turnedAsset, type VaultAsset } from './vault';
import { layerOf, layersOf } from './layers';
import { fromGrid, translateElements, type Box, type Pt, type VElement } from './vector';
import type { DesignPage } from './types';
import { roofElements, ROOF_SHAPES, type Roof } from './roof';
import { faceBands, mirroredFace, mod, patchDetail, STRIP, stripDetail, tileBase } from './strip';
import { faceBase, faceEls, wallSolid, WALL_T, type WallSpec } from './walls';

// ── Data ── Keys name grid spots on the structure's footprint: a tile "a,b" (from its top corner), an edge "a,b,a" (from
// corner (a, b) one tile along the columns) or "a,b,b" (along the rows). Values are vault ids.
export interface StructureLevel {
  h: number;                          // tiles up to the next level
  floors?: Record<string, string>;    // tile → floor atom
  walls?: Record<string, string>;     // edge → wall atom
  objects?: { asset: string; a: number; b: number; turn?: number }[];   // an object's footprint from tile (a, b); turn: degrees, quarter turns
  roofs?: Roof[];                     // at the top of this level's walls (roof.ts)
}
export interface Structure { levels: StructureLevel[] }
export type Axis = 'a' | 'b';
export const LEVEL_H = 3;
export const LEVELS_MAX = 8;
export const tileKey = (a: number, b: number) => `${a},${b}`;
export const edgeKey = (a: number, b: number, d: Axis) => `${a},${b},${d}`;
export const parseKey = (k: string) => { const [a, b, d] = k.split(','); return { a: Number(a), b: Number(b), d: d as Axis | undefined }; };
export const KEY = /^-?\d+,-?\d+(,[ab])?$/;

export const newStructure = (): Structure => ({ levels: [{ h: LEVEL_H }] });
export const structureOf = (a: VaultAsset): Structure => a.structure ?? newStructure();
export const levelBase = (s: Structure, level: number) => s.levels.slice(0, level).reduce((z, l) => z + l.h, 0);   // tiles up

// A sheet that holds the footprint and every level, with room round it. blockFloor puts the footprint's middle at 60%
// down the sheet, so the height leaves room above for the levels
export function structureSize(fp: { cols: number; rows: number }, s: Structure, cell: number) {
  const span = (fp.cols + fp.rows) * cell, up = levelBase(s, s.levels.length) * cell;
  const H = Math.max((span / 4 + cell) / 0.4, (span / 4 + up + 2 * cell) / 0.6), W = span + 4 * cell;
  const round = (v: number) => Math.ceil(v / cell) * cell;
  return { width: round(W), height: round(H) };
}

// ── Building it ── each atom's drawing is moved from its own sheet onto the spot; nothing is scaled (atoms and
// structures share a tile size), so it's a plain move, exact for every element. Drawn back to front: level by level,
// floors first, then walls and objects by how far back they stand (a + b on the isometric grid: larger is nearer).

type AtomOf = (id: string) => VaultAsset | undefined;
const visible = (a: VaultAsset, layer?: string) => {
  const ls = layersOf(a);
  return (a.elements ?? []).filter((e) => { const l = layerOf(ls, e); return !l.hidden && (!layer || l.id === layer); });
};
// The atom's elements moved so its grid corner `from` lands on `to`, ids made unique, off its layers
function moved(els: VElement[], dx: number, dy: number, tag: string): VElement[] {
  const page: DesignPage = { title: '', blocks: [], elements: els };
  return (translateElements(page, els, els.map((e) => e.id), dx, dy).elements ?? []).map((e) => ({ ...e, id: `${tag}:${e.id}`, layer: undefined, group: e.group && `${tag}:${e.group}` }) as VElement);
}


// How far a wall is from its run's near end (the +columns or +rows end), walls of the same atom in a line
const runIndex = (walls: Record<string, string>, a: number, b: number, d: Axis) => {
  const id = walls[edgeKey(a, b, d)];
  let k = 0;
  while (k < 64 && walls[d === 'a' ? edgeKey(a + k + 1, b, 'a') : edgeKey(a, b + k + 1, 'b')] === id) k++;
  return k;
};

// The structure's drawing, on its own sheet. `levels`: how many to draw from the bottom (Fab hides the ones above the
// level being built)
// How walls show while building (Sims): up; cut, the walls in front of a room lowered so you see in; down, all lowered
export const WALL_VIEWS = ['up', 'cut', 'down'] as const;
export type WallView = (typeof WALL_VIEWS)[number];
export const CUT_H = 0.4;   // tiles: how high a lowered wall stays
export interface ComposeOpts { roofs?: boolean; walls?: WallView; details?: boolean }   // details: false, the walls' solid only (no face details, no joints)

// A standing drawing lowered to `cut` px above its base line (`base`: the line's page y at an x): what's higher is
// rubbed out (shapes on a wall face, things standing up), solids are cut down, what lies on the floor stays
function lowered(els: VElement[], cut: number, base: (x: number) => number): VElement[] {
  return els.flatMap((e): VElement[] => {
    const plane = 'plane' in e ? e.plane : undefined, b = e as VElement & Box & { height?: number; lift?: number; base?: number; upright?: boolean };
    if ((plane === 'floor' || plane === 'roof') && b.height) { const h = Math.min(b.height, cut - (b.lift ?? 0)); return h > 0 ? [{ ...e, height: h } as VElement] : []; }
    if (plane === 'roof') return (b.lift ?? 0) > cut ? [] : [e];
    const top = plane === 'left' || plane === 'right' ? base(b.x) - b.y : !plane && b.upright ? (b.base ?? 0) + b.h : undefined;   // how high its box's top is
    if (top === undefined || top <= cut) return [e];
    if (top - b.h >= cut) return [];
    const m = 4, v = Math.round((top - cut) * 10) / 10;
    return [{ ...e, erased: [...(e.erased ?? []), { pts: [-m, -m, b.w + m, -m, b.w + m, v, -m, v], size: 0, area: true }] } as VElement];
  });
}

// The walls a view lowers: all (down), none (up), or those with a room behind them, which face you from inside it (cut)
export function loweredWalls(l: StructureLevel, view: WallView, cols: number, rows: number): Set<string> {
  const keys = Object.keys(l.walls ?? {});
  if (view !== 'cut') return new Set(view === 'down' ? keys : []);
  const inRoom = new Set(roomsOf(l, cols, rows).flat());
  return new Set(keys.filter((k) => { const { a, b, d } = parseKey(k); return inRoom.has(d === 'a' ? tileKey(a, b - 1) : tileKey(a - 1, b)); }));
}

export function composeStructure(st: VaultAsset, atomOf: AtomOf, levels?: number, opts: ComposeOpts = {}): VElement[] {
  const s = structureOf(st), f = blockFloor(st), cell = f.cell, O = f.corners[0], out: VElement[] = [];
  const at = (a: number, b: number, z: number): Pt => { const p = fromGrid({ cell }, { a, b }); return { x: O.x + p.x, y: O.y + p.y - z * cell }; };
  s.levels.slice(0, levels ?? s.levels.length).forEach((lv, li) => {
    const z = levelBase(s, li);
    const place = (atom: VaultAsset, els: VElement[], from: { a: number; b: number }, a: number, b: number, tag: string) => {
      const o = blockFloor(atom).corners[0], g = fromGrid({ cell }, from), src = { x: o.x + g.x, y: o.y + g.y }, to = at(a, b, z);
      return moved(els, to.x - src.x, to.y - src.y, tag);
    };
    // Floors: each tile takes its piece of the atom's patch (strip.ts), counted from the floor's near edges; its base
    // tile on every one
    const floors = lv.floors ?? {};
    const along = (a: number, b: number, da: number, db: number) => { const id = floors[tileKey(a, b)]; let k = 0; while (k < 64 && floors[tileKey(a + (k + 1) * da, b + (k + 1) * db)] === id) k++; return k; };
    for (const [k, id] of Object.entries(floors).sort(([x], [y]) => depth(x) - depth(y))) {
      const atom = atomOf(id), { a, b } = parseKey(k);
      if (!atom) continue;
      const els = visible(atom, 'base'), base = tileBase(atom, els);
      const own = [...(base ? [base] : []), ...patchDetail(atom, els.filter((e) => e !== base), mod(along(a, b, 1, 0)), mod(along(a, b, 0, 1)))];
      out.push(...place(atom, own, { a: 0, b: 0 }, a, b, `L${li}f${k}`));
    }
    const standing: { key: number; els: VElement[] }[] = [];
    // Lowered walls: all of them (down), or those with a room behind them, which face you from inside it (cut)
    const lows = loweredWalls(lv, opts.walls ?? 'up', st.footprint?.cols ?? 1, st.footprint?.rows ?? 1), low = (k: string) => lows.has(k);
    const cutPx = CUT_H * cell;
    // The walls as one solid (walls.ts): merged slabs, so runs and corners join. What else is drawn on a wall atom's
    // face (not its base) is a detail, laid on each tile of the wall's face toward you
    const specs: WallSpec[] = [];
    for (const [k, id] of Object.entries(lv.walls ?? {})) {
      const atom = atomOf(id), { a, b, d } = parseKey(k);
      if (!atom) continue;
      specs.push({ key: k, a, b, d: d!, atom, h: low(k) ? CUT_H : atom.wall?.h ?? LEVEL_H });
      const t = (atom.wall?.t ?? WALL_T) / 2, face = d === 'a' ? 'left' : 'right', base = faceBase(atom, face);
      if (opts.details === false) continue;
      const sk = runIndex(lv.walls!, a, b, d!) % STRIP, right = d === 'b' && !faceEls(atom, 'right').length;
      const detail = right
        ? mirroredFace(atom, stripDetail(atom, faceEls(atom, 'left').filter((e) => e !== faceBase(atom, 'left')), 'left', sk))
        : stripDetail(atom, faceEls(atom, face).filter((e) => e !== base), face, sk);
      if (!detail.length) continue;
      const off = fromGrid({ cell }, d === 'a' ? { a: 0, b: t } : { a: t, b: 0 });   // out to the face's side of the slab
      let els = moved(place(atom, detail, d === 'a' ? { a: 0, b: 1 } : { a: 1, b: 0 }, a, b, `L${li}w${k}`), off.x, off.y, 'd');
      if (low(k)) { const P = at(a, b, z), k2 = d === 'a' ? 0.5 : -0.5; els = lowered(els, cutPx, (x) => P.y + off.y + k2 * (x - P.x - off.x)); }
      standing.push({ key: a + b + 0.5 + t + 0.01, els });
    }
    standing.push(...wallSolid(specs, z, cell, at, `L${li}w`));
    (lv.objects ?? []).forEach((o, i) => {
      const raw = atomOf(o.asset), atom = raw && (o.turn ? turnedAsset(raw, Math.round(o.turn / 90)) : raw), fp = atom?.footprint ?? { cols: 1, rows: 1 };
      if (atom) standing.push({ key: o.a + o.b + (fp.cols + fp.rows) / 2 + 0.01, els: place(atom, visible(atom), { a: 0, b: 0 }, o.a, o.b, `L${li}o${i}`) });
    });
    for (const j of opts.details === false ? [] : jointsOf(lv)) {   // where walls meet: the state's layer, drawn on the corner it was drawn on (the faces' meeting corner)
      const atom = atomOf(j.atom), els = atom && JOINT_FALLBACK[j.state].map((st) => visible(atom, st)).find((x) => x.length);
      // after every wall touching its corner (a + b ± 0.5), before anything a tile further forward
      if (!els) continue;
      let placed = place(atom, els, { a: 1, b: 1 }, j.a, j.b, `L${li}j${j.a},${j.b}`);
      const near = [edgeKey(j.a, j.b, 'a'), edgeKey(j.a - 1, j.b, 'a'), edgeKey(j.a, j.b, 'b'), edgeKey(j.a, j.b - 1, 'b')].filter((e) => lv.walls?.[e]);
      if (near.some(low)) { const y = at(j.a, j.b, z).y; placed = lowered(placed, cutPx, () => y); }   // lowered with its walls
      standing.push({ key: j.a + j.b + 0.75, els: placed });
    }
    standing.sort((x, y) => x.key - y.key).forEach((x) => out.push(...x.els));
    if (opts.roofs === false) return;
    // Roofs, over everything on their level: back ones first. A gable end takes the color of a wall on its line
    const wallAt = (line: 'a' | 'b', v: number, from: number, to: number) => {
      for (let u = from; u < to; u++) { const id = lv.walls?.[line === 'a' ? edgeKey(v, u, 'b') : edgeKey(u, v, 'a')]; if (id && atomOf(id)) return atomOf(id); }
      return undefined;
    };
    (lv.roofs ?? []).map((r, i) => ({ r, i })).sort((x, y) => x.r.a0 + x.r.b0 - y.r.a0 - y.r.b0).forEach(({ r, i }) => {
      const atom = atomOf(r.atom);
      if (atom) out.push(...roofElements(r, atom, z + lv.h, cell, at, wallAt, `L${li}r${i}`));
    });
  });
  return out;
}
const depth = (k: string) => { const { a, b } = parseKey(k); return a + b; };

// ── Joints ── at each grid corner, the walls meeting there pick the state: end (1), corner (2 at an angle), tee (3),
// cross (4); two in a line need none. A state the wall hasn't drawn takes the next simpler one that it has (cross → tee →
// corner → end), so one post drawn as the corner serves every joint. The joint wears the wall that comes first
// (along the columns, then the rows)
export type JointState = 'end' | 'corner' | 'tee' | 'cross';
const JOINT_FALLBACK: Record<JointState, JointState[]> = { end: ['end'], corner: ['corner', 'end'], tee: ['tee', 'corner', 'end'], cross: ['cross', 'tee', 'corner', 'end'] };
export function jointsOf(l: StructureLevel): { a: number; b: number; state: JointState; atom: string }[] {
  const walls = l.walls ?? {}, corners = new Set<string>(), out: ReturnType<typeof jointsOf> = [];
  for (const k of Object.keys(walls)) { const { a, b, d } = parseKey(k); corners.add(tileKey(a, b)); corners.add(d === 'a' ? tileKey(a + 1, b) : tileKey(a, b + 1)); }
  for (const c of Array.from(corners)) {
    const { a, b } = parseKey(c);
    const ends = [walls[edgeKey(a, b, 'a')], walls[edgeKey(a - 1, b, 'a')], walls[edgeKey(a, b, 'b')], walls[edgeKey(a, b - 1, 'b')]];   // +a, -a, +b, -b
    const n = ends.filter(Boolean).length, straight = n === 2 && ((ends[0] && ends[1]) || (ends[2] && ends[3]));
    if (straight) continue;
    out.push({ a, b, state: n === 1 ? 'end' : n === 2 ? 'corner' : n === 3 ? 'tee' : 'cross', atom: ends.find(Boolean)! });
  }
  return out.sort((x, y) => x.a + x.b - y.a - y.b);
}

// ── Rooms ── tiles closed in by walls on every side, found by spreading from each tile until walls stop it. Reaching
// the footprint's edge through a gap means outside: not a room
export function roomsOf(l: StructureLevel, cols: number, rows: number): string[][] {
  const walls = l.walls ?? {}, seen = new Set<string>(), rooms: string[][] = [];
  for (let a0 = 0; a0 < cols; a0++) for (let b0 = 0; b0 < rows; b0++) {
    if (seen.has(tileKey(a0, b0))) continue;
    const room: string[] = [], todo = [[a0, b0]];
    let open = false;
    seen.add(tileKey(a0, b0));
    while (todo.length) {
      const [a, b] = todo.pop()!;
      room.push(tileKey(a, b));
      const steps: [number, number, string][] = [[a + 1, b, edgeKey(a + 1, b, 'b')], [a - 1, b, edgeKey(a, b, 'b')], [a, b + 1, edgeKey(a, b + 1, 'a')], [a, b - 1, edgeKey(a, b, 'a')]];
      for (const [na, nb, wall] of steps) {
        if (walls[wall]) continue;
        if (na < 0 || nb < 0 || na >= cols || nb >= rows) { open = true; continue; }
        if (!seen.has(tileKey(na, nb))) { seen.add(tileKey(na, nb)); todo.push([na, nb]); }
      }
    }
    if (!open) rooms.push(room.sort());
  }
  return rooms;
}
export const roomAt = (l: StructureLevel, cols: number, rows: number, a: number, b: number) => roomsOf(l, cols, rows).find((r) => r.includes(tileKey(a, b)));

// Rooms a wall edit closed (not rooms before it) get `floor` on their bare tiles, the way a new room comes floored
export function floorNewRooms(before: Structure, after: Structure, level: number, cols: number, rows: number, floor: string): Structure {
  const was = new Set(roomsOf(before.levels[level], cols, rows).map((r) => r.join(' ')));
  const fresh = roomsOf(after.levels[level], cols, rows).filter((r) => !was.has(r.join(' ')));
  if (!fresh.length) return after;
  return fillTiles(after, level, fresh.flat().filter((k) => !after.levels[level].floors?.[k]), floor);
}
export function fillTiles(s: Structure, level: number, keys: string[], floor: string): Structure {
  return withLevel(s, level, (l) => ({ ...l, floors: { ...l.floors, ...Object.fromEntries(keys.map((k) => [k, floor])) } }));
}

// ── Pieces ── what the select tool picks on a level: a floor (tile key), a wall (edge key), an object (its index)
export type PieceKind = 'floor' | 'wall' | 'object' | 'roof';
export interface Piece { kind: PieceKind; key: string }
export const pieceId = (p: Piece) => `${p.kind}:${p.key}`;
export const objFp = (atomOf: AtomOf, o: { asset: string; turn?: number }) => { const f = atomOf(o.asset)?.footprint ?? { cols: 1, rows: 1 }; return Math.round((o.turn ?? 0) / 90) % 2 ? { cols: f.rows, rows: f.cols } : f; };

// What's under a grid point: a roof (`up`: the point at the roof's height, when roofs show), a wall when it's on a grid
// line with one, else an object standing on the tile, else its floor
export function pieceAt(l: StructureLevel, t: { a: number; b: number }, atomOf: AtomOf, up?: { a: number; b: number }, near = 0.18): Piece | undefined {
  const roofs = l.roofs ?? [];
  if (up) for (let i = roofs.length - 1; i >= 0; i--) { const r = roofs[i]; if (up.a >= r.a0 && up.a < r.a1 + 1 && up.b >= r.b0 && up.b < r.b1 + 1) return { kind: 'roof', key: String(i) }; }
  const ra = Math.round(t.a), rb = Math.round(t.b);
  if (Math.abs(t.b - rb) < near && l.walls?.[edgeKey(Math.floor(t.a), rb, 'a')]) return { kind: 'wall', key: edgeKey(Math.floor(t.a), rb, 'a') };
  if (Math.abs(t.a - ra) < near && l.walls?.[edgeKey(ra, Math.floor(t.b), 'b')]) return { kind: 'wall', key: edgeKey(ra, Math.floor(t.b), 'b') };
  const a = Math.floor(t.a), b = Math.floor(t.b), objs = l.objects ?? [];
  for (let i = objs.length - 1; i >= 0; i--) { const o = objs[i], f = objFp(atomOf, o); if (a >= o.a && a < o.a + f.cols && b >= o.b && b < o.b + f.rows) return { kind: 'object', key: String(i) }; }
  return l.floors?.[tileKey(a, b)] ? { kind: 'floor', key: tileKey(a, b) } : undefined;
}
// Everything in a box of tiles: its floors, objects standing in it, walls on its lines (its outline included)
export function piecesIn(l: StructureLevel, r: Span): Piece[] {
  const inA = (v: number) => v >= r.a0 && v <= r.a1, inB = (v: number) => v >= r.b0 && v <= r.b1;
  return [
    ...Object.keys(l.floors ?? {}).filter((k) => { const p = parseKey(k); return inA(p.a) && inB(p.b); }).map((key) => ({ kind: 'floor' as const, key })),
    ...Object.keys(l.walls ?? {}).filter((k) => { const p = parseKey(k); return p.d === 'a' ? inA(p.a) && p.b >= r.b0 && p.b <= r.b1 + 1 : inB(p.b) && p.a >= r.a0 && p.a <= r.a1 + 1; }).map((key) => ({ kind: 'wall' as const, key })),
    ...(l.objects ?? []).map((o, i) => ({ o, i })).filter(({ o }) => inA(o.a) && inB(o.b)).map(({ i }) => ({ kind: 'object' as const, key: String(i) })),
    ...(l.roofs ?? []).map((o, i) => ({ o, i })).filter(({ o }) => inA(o.a0) && inA(o.a1) && inB(o.b0) && inB(o.b1)).map(({ i }) => ({ kind: 'roof' as const, key: String(i) })),
  ];
}
export function removePieces(s: Structure, level: number, ps: Piece[]): Structure {
  const gone = new Set(ps.map(pieceId));
  return withLevel(s, level, (l) => clean({
    ...l,
    floors: l.floors && Object.fromEntries(Object.entries(l.floors).filter(([k]) => !gone.has(`floor:${k}`))),
    walls: l.walls && Object.fromEntries(Object.entries(l.walls).filter(([k]) => !gone.has(`wall:${k}`))),
    objects: l.objects?.filter((_, i) => !gone.has(`object:${i}`)),
    roofs: l.roofs?.filter((_, i) => !gone.has(`roof:${i}`)),
  }));
}
// Moves the pieces by whole tiles, as far as the footprint lets them go that way (they land over what was there)
export function movePieces(s: Structure, level: number, ps: Piece[], da: number, db: number, cols: number, rows: number, atomOf: AtomOf): { s: Structure; da: number; db: number } {
  const l = s.levels[level];
  let a0 = -Infinity, a1 = Infinity, b0 = -Infinity, b1 = Infinity;   // the moves that keep every piece inside
  const room = (a: number, b: number, w: number, h: number, ea: number, eb: number) => { a0 = Math.max(a0, -a); b0 = Math.max(b0, -b); a1 = Math.min(a1, ea - a - w); b1 = Math.min(b1, eb - b - h); };
  for (const p of ps) {
    if (p.kind === 'floor') { const k = parseKey(p.key); room(k.a, k.b, 1, 1, cols, rows); }
    else if (p.kind === 'wall') { const k = parseKey(p.key); if (k.d === 'a') room(k.a, k.b, 1, 0, cols, rows); else room(k.a, k.b, 0, 1, cols, rows); }
    else if (p.kind === 'roof') { const r = l.roofs?.[Number(p.key)]; if (r) room(r.a0, r.b0, r.a1 - r.a0 + 1, r.b1 - r.b0 + 1, cols, rows); }
    else { const o = l.objects?.[Number(p.key)]; if (o) { const f = objFp(atomOf, o); room(o.a, o.b, f.cols, f.rows, cols, rows); } }
  }
  da = Math.max(a0, Math.min(a1, da)); db = Math.max(b0, Math.min(b1, db));
  if (!da && !db) return { s, da, db };
  const sel = new Set(ps.map(pieceId)), shift = (k: string) => { const p = parseKey(k); return p.d ? edgeKey(p.a + da, p.b + db, p.d) : tileKey(p.a + da, p.b + db); };
  const moveRec = (rec: Record<string, string> | undefined, kind: PieceKind) => {
    if (!rec) return rec;
    const stay = Object.entries(rec).filter(([k]) => !sel.has(`${kind}:${k}`)), go = Object.entries(rec).filter(([k]) => sel.has(`${kind}:${k}`)).map(([k, v]) => [shift(k), v]);
    return Object.fromEntries([...stay, ...go]);
  };
  return { da, db, s: withLevel(s, level, (lv) => clean({
    ...lv, floors: moveRec(lv.floors, 'floor'), walls: moveRec(lv.walls, 'wall'),
    objects: lv.objects?.map((o, i) => (sel.has(`object:${i}`) ? { ...o, a: o.a + da, b: o.b + db } : o)),
    roofs: lv.roofs?.map((r, i) => (sel.has(`roof:${i}`) ? { ...r, a0: r.a0 + da, a1: r.a1 + da, b0: r.b0 + db, b1: r.b1 + db } : r)),
  })) };
}
// Another atom of the same part on the picked pieces (a floor swaps floors, a wall walls, an object objects)
export function swapPieces(s: Structure, level: number, ps: Piece[], kind: PieceKind, id: string): Structure {
  const on = new Set(ps.filter((p) => p.kind === kind).map((p) => p.key));
  if (!on.size) return s;
  const swap = (rec?: Record<string, string>) => rec && Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, on.has(k) ? id : v]));
  return withLevel(s, level, (l) => kind === 'floor' ? { ...l, floors: swap(l.floors) } : kind === 'wall' ? { ...l, walls: swap(l.walls) }
    : kind === 'roof' ? { ...l, roofs: l.roofs?.map((r, i) => (on.has(String(i)) ? { ...r, atom: id } : r)) }
    : { ...l, objects: l.objects?.map((o, i) => (on.has(String(i)) ? { ...o, asset: id } : o)) });
}
// Turns the picked objects a quarter (1 clockwise, -1 back) on their corner tile, kept inside the footprint
export function turnObjects(s: Structure, level: number, ps: Piece[], dir: 1 | -1, cols: number, rows: number, atomOf: AtomOf): Structure {
  const on = new Set(ps.filter((p) => p.kind === 'object').map((p) => Number(p.key)));
  return withLevel(s, level, (l) => ({ ...l, objects: l.objects?.map((o, i) => {
    if (!on.has(i)) return o;
    const t = ((((o.turn ?? 0) + 90 * dir) % 360) + 360) % 360, n = { ...o, turn: t || undefined }, f = objFp(atomOf, n);
    return clean({ ...n, a: Math.max(0, Math.min(o.a, cols - f.cols)), b: Math.max(0, Math.min(o.b, rows - f.rows)) });
  }) }));
}
export function addRoof(s: Structure, level: number, r: Roof): Structure {
  return withLevel(s, level, (l) => ({ ...l, roofs: [...(l.roofs ?? []), r] }));
}
// Changes the picked roofs' shape, pitch, overhang or ridge
export function setRoofs(s: Structure, level: number, ps: Piece[], patch: Partial<Roof>): Structure {
  const on = new Set(ps.filter((p) => p.kind === 'roof').map((p) => Number(p.key)));
  return withLevel(s, level, (l) => ({ ...l, roofs: l.roofs?.map((r, i) => (on.has(i) ? clean({ ...r, ...patch }) : r)) }));
}

// A structure as a page to draw: its asset with the built drawing as its elements (and one plain layer)
// A built structure remembers how to build itself turned (vault.ts turnedAsset asks): a quarter turn turns its data and
// builds that, exact, where turning the drawing would only move pictures of walls about
const turners = new WeakMap<VaultAsset, (q: number) => VaultAsset>();
export const structureTurner = (a: VaultAsset) => turners.get(a);
export function builtStructure(st: VaultAsset, atomOf: AtomOf, levels?: number, opts?: ComposeOpts): VaultAsset {
  const built: VaultAsset = { ...st, layers: undefined, elements: composeStructure(st, atomOf, levels, opts) }, turns = new Map<number, VaultAsset>();
  turners.set(built, (q) => {
    const k = ((q % 4) + 4) % 4;
    if (!k) return built;
    if (!turns.has(k)) turns.set(k, builtStructure(turnStructure(st, k), atomOf, levels, opts));
    return turns.get(k)!;
  });
  return built;
}

// Quarter turns clockwise, as a block turns (vault.ts quarterTurn): a tile (a, b) lands on (rows − 1 − b, a), so walls
// along the columns run along the rows and the footprint's sides swap. Objects turn with it; roofs keep their ridge
export function turnStructure(st: VaultAsset, quarters: number): VaultAsset {
  let out = st;
  for (let i = 0; i < ((quarters % 4) + 4) % 4; i++) out = quarterStructure(out);
  return out;
}
function quarterStructure(st: VaultAsset): VaultAsset {
  const fp = st.footprint ?? { cols: 1, rows: 1 }, R = fp.rows, s = structureOf(st);
  const tile = (k: string) => { const { a, b } = parseKey(k); return tileKey(R - 1 - b, a); };
  const edge = (k: string) => { const { a, b, d } = parseKey(k); return d === 'a' ? edgeKey(R - b, a, 'b') : edgeKey(R - b - 1, a, 'a'); };
  const rekey = (rec: Record<string, string> | undefined, f: (k: string) => string) => rec && Object.fromEntries(Object.entries(rec).map(([k, v]) => [f(k), v]));
  const levels = s.levels.map((l) => clean({
    ...l,
    floors: rekey(l.floors, tile), walls: rekey(l.walls, edge),
    objects: l.objects?.map((o) => { const f = objFp(() => undefined, o); return { ...o, a: R - o.b - f.rows, b: o.a, turn: (((o.turn ?? 0) + 90) % 360) || undefined }; }),
    roofs: l.roofs?.map((r) => clean({ ...r, a0: R - 1 - r.b1, a1: R - 1 - r.b0, b0: r.a0, b1: r.a1, along: r.along && ((r.along === 'a' ? 'b' : 'a') as 'a' | 'b'), flip: r.shape === 'shed' && (r.along ?? (r.a1 - r.a0 >= r.b1 - r.b0 ? 'a' : 'b')) === 'b' ? !r.flip || undefined : r.flip })),
  }));
  const structure = { levels }, footprint = { cols: fp.rows, rows: fp.cols };
  return { ...st, footprint, structure, size: structureSize(footprint, structure, blockFloor(st).cell) };
}

// ── Edits ── pure, on one level. Everything stays inside the footprint.
type Level = StructureLevel;
const withLevel = (s: Structure, i: number, f: (l: Level) => Level): Structure => ({ levels: s.levels.map((l, k) => (k === i ? f(l) : l)) });
const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v as object).length) && !(Array.isArray(v) && !v.length))) as T;
export interface Span { a0: number; b0: number; a1: number; b1: number }   // tiles, both ends included
export const spanOf = (p: { a: number; b: number }, q: { a: number; b: number }): Span => ({ a0: Math.min(p.a, q.a), b0: Math.min(p.b, q.b), a1: Math.max(p.a, q.a), b1: Math.max(p.b, q.b) });

export function paintFloors(s: Structure, level: number, r: Span, atom: string | null): Structure {
  return withLevel(s, level, (l) => {
    const floors = { ...l.floors };
    for (let a = r.a0; a <= r.a1; a++) for (let b = r.b0; b <= r.b1; b++) if (atom) floors[tileKey(a, b)] = atom; else delete floors[tileKey(a, b)];
    return clean({ ...l, floors });
  });
}

// The edges a wall drag covers: from corner p along one axis to q (the longer way), or with `room`, the outline of the
// box between them
export function wallEdges(p: { a: number; b: number }, q: { a: number; b: number }, room = false): string[] {
  const out: string[] = [], a0 = Math.min(p.a, q.a), a1 = Math.max(p.a, q.a), b0 = Math.min(p.b, q.b), b1 = Math.max(p.b, q.b);
  const along = (fixed: number, from: number, to: number, d: Axis) => { for (let i = from; i < to; i++) out.push(d === 'a' ? edgeKey(i, fixed, 'a') : edgeKey(fixed, i, 'b')); };
  if (room) { along(b0, a0, a1, 'a'); along(b1, a0, a1, 'a'); along(a0, b0, b1, 'b'); along(a1, b0, b1, 'b'); }
  else if (a1 - a0 >= b1 - b0) along(p.b, a0, a1, 'a');
  else along(p.a, b0, b1, 'b');
  return out;
}
export function paintWalls(s: Structure, level: number, edges: string[], atom: string | null): Structure {
  return withLevel(s, level, (l) => {
    const walls = { ...l.walls };
    for (const k of edges) if (atom) walls[k] = atom; else delete walls[k];
    return clean({ ...l, walls });
  });
}
export function placeObject(s: Structure, level: number, asset: string, a: number, b: number): Structure {
  return withLevel(s, level, (l) => ({ ...l, objects: [...(l.objects ?? []), { asset, a, b }] }));
}
// Floors and objects in the box go (an object goes when its corner tile is in it)
export function clearTiles(s: Structure, level: number, r: Span): Structure {
  const s2 = paintFloors(s, level, r, null), inside = (o: { a: number; b: number }) => o.a >= r.a0 && o.a <= r.a1 && o.b >= r.b0 && o.b <= r.b1;
  return withLevel(s2, level, (l) => clean({ ...l, objects: l.objects?.filter((o) => !inside(o)) }));
}
export const addLevel = (s: Structure): Structure => ({ levels: [...s.levels, { h: LEVEL_H }] });
export const removeLevel = (s: Structure, i: number): Structure => (s.levels.length > 1 ? { levels: s.levels.filter((_, k) => k !== i) } : s);
export const levelEmpty = (l: Level) => !Object.keys(l.floors ?? {}).length && !Object.keys(l.walls ?? {}).length && !l.objects?.length && !l.roofs?.length;
// What still fits on a smaller footprint
export function fitFootprint(s: Structure, cols: number, rows: number): Structure {
  const keep = <T,>(rec: Record<string, T> | undefined, edge: boolean) => rec && Object.fromEntries(Object.entries(rec).filter(([k]) => {
    const { a, b, d } = parseKey(k);
    return edge ? (d === 'a' ? a < cols && b <= rows : a <= cols && b < rows) : a < cols && b < rows;
  }));
  return { levels: s.levels.map((l) => clean({ ...l, floors: keep(l.floors, false), walls: keep(l.walls, true), objects: l.objects?.filter((o) => o.a < cols && o.b < rows), roofs: l.roofs?.filter((r) => r.a1 < cols && r.b1 < rows) })) };
}

export function checkStructure(raw: unknown, errors: string[]) {
  const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const rec = (v: unknown, edge: boolean) => v === undefined || (obj(v) && Object.entries(v).every(([k, id]) => KEY.test(k) && !!k.split(',')[2] === edge && typeof id === 'string'));
  if (!obj(raw) || !Array.isArray(raw.levels) || !raw.levels.length || raw.levels.length > LEVELS_MAX) return errors.push(`structure: {levels: 1–${LEVELS_MAX} levels}`);
  raw.levels.forEach((l, i) => {
    if (!obj(l) || typeof l.h !== 'number' || !(l.h > 0)) return errors.push(`structure.levels[${i}].h: tiles up to the next level, > 0`);
    if (!rec(l.floors, false)) errors.push(`structure.levels[${i}].floors: {"a,b": floor id}`);
    if (!rec(l.walls, true)) errors.push(`structure.levels[${i}].walls: {"a,b,a" | "a,b,b": wall id}`);
    if (l.objects !== undefined && !(Array.isArray(l.objects) && l.objects.every((o) => obj(o) && typeof o.asset === 'string' && Number.isInteger(o.a) && Number.isInteger(o.b) && (o.turn === undefined || (typeof o.turn === 'number' && o.turn % 90 === 0)))))
      errors.push(`structure.levels[${i}].objects: [{asset, a, b, turn?: quarter turns in degrees}]`);
    const whole = (v: unknown) => Number.isInteger(v), opt = (v: unknown, ok: (x: number) => boolean) => v === undefined || (typeof v === 'number' && ok(v));
    if (l.roofs !== undefined && !(Array.isArray(l.roofs) && l.roofs.every((r) => obj(r) && typeof r.atom === 'string' && ROOF_SHAPES.includes(r.shape as never)
      && whole(r.a0) && whole(r.b0) && whole(r.a1) && whole(r.b1) && (r.a1 as number) >= (r.a0 as number) && (r.b1 as number) >= (r.b0 as number)
      && opt(r.pitch, (x) => x >= 0 && x <= 0.9) && opt(r.over, (x) => x >= 0 && x <= 2) && (r.along === undefined || r.along === 'a' || r.along === 'b') && (r.flip === undefined || typeof r.flip === 'boolean'))))
      errors.push(`structure.levels[${i}].roofs: [{a0, b0, a1, b1 (tiles), atom, shape: ${ROOF_SHAPES.join(' | ')}, pitch? 0–0.9, over? 0–2, along? a | b, flip?}]`);
  });
}

// A wall atom on Blocks' sheet shown `n` strip tiles long, in place: the single's faces carried on back along both
// faces. under: the walls' solid for those tiles (look only, drawn under the atom's own drawing, its faces on the
// atom's lines); hide: the strip tiles past n, where the drawing on the sheet is kept out of sight
export function wallStrip(atom: VaultAsset, n: number): { under?: { elements: VElement[]; transform: string }; hide: Pt[][] } {
  const { corners: [, , c2], cell } = blockFloor(atom), h = (atom.wall?.h ?? LEVEL_H) * cell, m = 0.25 * cell;
  const hide = faceBands(atom, n, -m, h + m, ['left', 'right']);
  if (n < 2) return { hide };
  const self = '__atom__', walls: Record<string, string> = {};
  for (let i = 0; i < n; i++) { walls[edgeKey(i, n, 'a')] = self; walls[edgeKey(n, i, 'b')] = self; }
  const fp = { cols: n, rows: n }, st0: Structure = { levels: [{ h: atom.wall?.h ?? LEVEL_H, walls }] };
  const st = { kind: 'block', part: 'structure', title: '', updated: '', blocks: [], footprint: fp, structure: st0, size: structureSize(fp, st0, cell), grid: { cell } } as unknown as VaultAsset;
  const elements = composeStructure(st, (id) => (id === self ? atom : undefined), undefined, { details: false });
  const t = (atom.wall?.t ?? WALL_T) / 2, back = fromGrid({ cell }, { a: t, b: t }), k = blockFloor(st).corners[2];
  return { hide, under: { elements, transform: `translate(${Math.round((c2.x - k.x - back.x) * 10) / 10} ${Math.round((c2.y - k.y - back.y) * 10) / 10})` } };
}
