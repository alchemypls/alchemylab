import { Tier, TIER_COLUMNS, TIER_ORDER, ViewportSize } from './devices';
import { GLOBAL_THEME, Theme } from './library/theme';
import type { ProjectComponent, ListItem } from './library/recipe';
import type { FontLoad } from './library/fonts';
import type { VElement } from './design/vector';
import type { VLayer } from './design/layers';


// ── Wireframe Sketches ───────────────────────────────────────────

export type SketchElement =
  | { id: string; type: 'stroke'; color: string; points: [number, number][]; pressures?: number[] /* pen tablet, 0..1 per point */ }
  | { id: string; type: 'rect'; color: string; x: number; y: number; w: number; h: number }
  | { id: string; type: 'circle'; color: string; cx: number; cy: number; r: number }
  // Reference image (photo of a paper sketch, reMarkable export, screenshot…). Blob lives in
  // IndexedDB (lib/assets.ts), keyed by assetId. Always drawn beneath strokes/shapes.
  | { id: string; type: 'image'; assetId: string; x: number; y: number; w: number; h: number; opacity: number };


// Page wireframe for one breakpoint tier: a vector page (lib/design/vector.ts) in CSS px of the page at `width`,
// drawn on the Web canvas's wireframe layer. Switching to a narrower device of the same tier shows what no longer fits.
// Images are browser-side (IndexedDB, lib/assets.ts): an image element's `src` is `idb:<asset id>`.
export interface PageSketch {
  elements:   VElement[];
  layers?:    VLayer[];
  grid?:      { cell?: number; flat?: boolean };
  background?: string;
  width:      number;   // viewport width it was last drawn at
  deviceId?:  string;   // device it was last drawn on (lib/devices.ts), 'responsive' = custom
  height?:    number;   // page length it was given; the canvas keeps room below the drawing either way
}

// A sketch in the old format (strokes, rects, circles, images on IndexedDB) as vector elements, once (store v11)
export function sketchToVector(els: SketchElement[]): VElement[] {
  return els.map((el): VElement => {
    switch (el.type) {
      case 'stroke': return { id: el.id, type: 'stroke', points: el.points, pressures: el.pressures, color: el.color, width: 4 };
      case 'rect':   return { id: el.id, type: 'rect', x: el.x, y: el.y, w: el.w, h: el.h, stroke: el.color, strokeWidth: 4 };
      case 'circle': return { id: el.id, type: 'ellipse', x: el.cx - el.r, y: el.cy - el.r, w: 2 * el.r, h: 2 * el.r, stroke: el.color, strokeWidth: 4 };
      case 'image':  return { id: el.id, type: 'image', src: `idb:${el.assetId}`, x: el.x, y: el.y, w: el.w, h: el.h, opacity: el.opacity, fit: 'contain' };
    }
  });
}

export type PageSketches = Partial<Record<Tier, PageSketch>>;

// Sketch to show at a given width, mobile-first: that width's tier, else the nearest smaller
// tier with content, else any tier with content.
export function sketchForWidth(sketches: PageSketches | undefined, width: number): PageSketch | undefined {
  if (!sketches) return undefined;
  const order: Tier[] = ['mobile', 'tablet', 'desktop'];
  const at = width >= 1024 ? 2 : width >= 600 ? 1 : 0;
  const has = (t: Tier) => (sketches[t]?.elements.length ?? 0) > 0;
  for (let i = at; i >= 0; i--) if (has(order[i])) return sketches[order[i]];
  const any = order.find(has);
  return any ? sketches[any] : undefined;
}

// ── Page Layout — spatial component arrangement ───────────────────

export type ArtboardViewportWidth = 375 | 768 | 1280 | 1440;

// Selectable artboard breakpoints, and their page-pixel dimensions —
// shared by PageArtboardViewport, PagePreviewViewport and the Web canvas.
export const VIEWPORT_OPTIONS: ArtboardViewportWidth[] = [375, 768, 1280, 1440];

export const VIEWPORT_DIM: Record<ArtboardViewportWidth, { width: number; height: number }> = {
  375:  { width: 375,  height: 812  },
  768:  { width: 768,  height: 1024 },
  1280: { width: 1280, height: 800  },
  1440: { width: 1440, height: 900  },
};

// A grid row's least height (rows grow to their content: grid-auto-rows: minmax(32px, auto)) and the gutter. Two rows
// and their gutter are one 80px row of the old grid, two columns and theirs one old column (upgradeGrid).
export const ROW_HEIGHT = 32;
export const GRID_GAP = 16;     // the gutter between columns and rows, and the page's side margin

// ── Placements — mobile-first, per-tier overrides ────────────────
// Base geometry (col/row/span, hidden) is the MOBILE layout on its grid (TIER_COLUMNS). Tablet and desktop
// inherit it cascading upward like mobile-first CSS; an unset tier inherits the tier below,
// scaled to its column count (full width stays full width). `at[tier]` stores only what that
// tier changes. Raw grid numbers + a semantic tier key → any generator can emit it.

export interface PlacementGeom { col: number; row: number; colSpan: number; rowSpan: number; hidden?: boolean; pin?: Pin }

// ── Editing a layout: blocks make room instead of overlapping ─────

type Cell = { id: string; col: number; row: number; colSpan: number; rowSpan: number };
const overlaps = (a: Cell, b: Cell) =>
  a.col < b.col + b.colSpan && b.col < a.col + a.colSpan && a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan;

// Where a dropped block lands: on the lower half of a block it goes under that block instead of pushing it down,
// again and again (dropped just under a block's middle, it means "after this one")
export function landing(cells: Cell[], moved: Cell): Cell {
  const at = { ...moved };
  for (let hit = cells.find((c) => c.id !== at.id && overlaps(c, at) && at.row >= c.row + c.rowSpan / 2); hit;
    hit = cells.find((c) => c.id !== at.id && overlaps(c, at) && at.row >= c.row + c.rowSpan / 2)) at.row = hit.row + hit.rowSpan;
  return at;
}

// The blocks pushed down out of the way of `moved` (as it lands), each only as far as it must, top to bottom, so a
// pushed block pushes the ones under it in turn. Nothing moves up.
export function makeRoom(cells: Cell[], moved: Cell): { id: string; row: number }[] {
  const settled: Cell[] = [moved], out: { id: string; row: number }[] = [];
  for (const c of cells.filter((x) => x.id !== moved.id).sort((a, b) => a.row - b.row || a.col - b.col)) {
    const at = { ...c };
    for (let hit = settled.find((s) => overlaps(s, at)); hit; hit = settled.find((s) => overlaps(s, at))) at.row = hit.row + hit.rowSpan;
    settled.push(at);
    if (at.row !== c.row) out.push({ id: c.id, row: at.row });
  }
  return out;
}

// The visible blocks sharing a container with `p` (the page, or a group), as cells
function siblingCells(placements: PagePlacement[], tier: Tier, p: PagePlacement): Cell[] {
  return childrenOf(placements, parentOf(placements, p)).map((x) => ({ x, g: placedAt(placements, x, tier) })).filter(({ g }) => !g.hidden)
    .map(({ x, g }): Cell => ({ id: x.id, col: g.col, row: g.row, colSpan: g.colSpan, rowSpan: g.rowSpan }));
}

// One block's new geometry at a tier (kept inside its container's columns), and the blocks beside it that it pushes
// down: every grid edit as the list of geometry patches to apply together. Pinned and hidden blocks stay put.
export function layoutEdit(placements: PagePlacement[], tier: Tier, id: string, patch: Partial<Cell>, land = true): { id: string; geom: Partial<PlacementGeom> }[] {
  const p = placements.find((x) => x.id === id);
  if (!p || p.pin) return [];
  const cols = containerCols(placements, parentOf(placements, p), tier), cells = siblingCells(placements, tier, p);
  const was = cells.find((c) => c.id === id);
  if (!was) return [];
  const colSpan = Math.max(1, Math.min(cols, patch.colSpan ?? was.colSpan));
  const rowSpan = p.bounded ? 1 : Math.max(1, patch.rowSpan ?? was.rowSpan);   // a block that scrolls inside is as tall as it shows
  const asked: Cell = { id, colSpan, rowSpan, col: Math.max(0, Math.min(cols - colSpan, patch.col ?? was.col)), row: Math.max(0, patch.row ?? was.row) };
  const next = land && rowSpan === was.rowSpan ? landing(cells, asked) : asked;   // a drop lands; a resize or a key nudge (one row at a time) takes what it's given
  const geom: Partial<PlacementGeom> = {};
  for (const k of ['col', 'row', 'colSpan', 'rowSpan'] as const) if (next[k] !== was[k]) geom[k] = next[k];
  if (!Object.keys(geom).length) return [];
  return [{ id, geom }, ...makeRoom(cells, next).map((m) => ({ id: m.id, geom: { row: m.row } }))];
}

// A new block's landing: under a block whose lower half it's dropped on, and the blocks it then lands on move down
export function roomFor(placements: PagePlacement[], tier: Tier, added: PagePlacement): { id: string; geom: Partial<PlacementGeom> }[] {
  const all = placements.some((x) => x.id === added.id) ? placements : [...placements, added], g = placedAt(all, added, tier);
  const cells = siblingCells(all, tier, added);
  const lands = landing(cells, { id: added.id, col: g.col, row: g.row, colSpan: g.colSpan, rowSpan: g.rowSpan });
  return [...(lands.row !== g.row ? [{ id: added.id, geom: { row: lands.row } }] : []), ...makeRoom(cells, lands).map((m) => ({ id: m.id, geom: { row: m.row } }))];
}

// ── Pinned blocks — fixed to the viewport, outside the grid ──────
// A block with a base `pin` is pinned on every tier (a rail, a corner plate, a joystick); `at[tier].pin` moves it to
// another spot there. Bars (top/bottom/left/right) span their edge; corners take colSpan of the tier's columns and are
// as tall as their content. `reserve` keeps that much of its edge clear, so the grid starts past it.

export type PinAt = 'top-left' | 'top' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';
export const PIN_SPOTS: PinAt[] = ['top-left', 'top', 'top-right', 'left', 'right', 'bottom-left', 'bottom', 'bottom-right'];
export interface Pin { at: PinAt; reserve?: number }
export const PIN_MARGIN = 16;   // a corner's distance from the viewport edges; bars sit flush

export type Insets = { top: number; right: number; bottom: number; left: number };
const reserveSide = (at: PinAt): keyof Insets => (at.startsWith('top') ? 'top' : at.startsWith('bottom') ? 'bottom' : at as 'left' | 'right');

// The page edges kept clear at a tier: the largest reserve pinned to each
export function pageInsets(ps: PagePlacement[], tier: Tier): Insets {
  const out: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const p of ps) {
    const g = resolvePlacement(p, tier);
    if (!p.pin || g.hidden || !g.pin?.reserve) continue;
    const side = reserveSide(g.pin.at);
    out[side] = Math.max(out[side], g.pin.reserve);
  }
  return out;
}

// Where a pinned block sits, as CSS properties (camelCase; the export turns them to kebab-case). Percentages are of
// the viewport (fixed) or of a viewport-sized box (the Workbench preview), so one answer serves both.
// A corner keeps clear of a phone's notch and home bar too (env(safe-area-inset-*), 0 elsewhere); bars sit flush.
export function pinStyle(pin: Pin, colSpan: number, cols: number): Record<string, string> {
  const m = (side: 'top' | 'right' | 'bottom' | 'left') => `calc(${PIN_MARGIN}px + env(safe-area-inset-${side}, 0px))`;
  const w = `calc(${(100 * Math.min(colSpan, cols)) / cols}% - ${2 * PIN_MARGIN}px)`;
  switch (pin.at) {
    case 'top':          return { top: '0', left: '0', right: '0' };
    case 'bottom':       return { bottom: '0', left: '0', right: '0' };
    case 'left':         return { top: '0', bottom: '0', left: '0', width: w };
    case 'right':        return { top: '0', bottom: '0', right: '0', width: w };
    case 'top-left':     return { top: m('top'), left: m('left'), width: w };
    case 'top-right':    return { top: m('top'), right: m('right'), width: w };
    case 'bottom-left':  return { bottom: m('bottom'), left: m('left'), width: w };
    case 'bottom-right': return { bottom: m('bottom'), right: m('right'), width: w };
  }
}

// How much of the screen a bounded block may take at its row: the viewport less the kept-clear edges, the rows above
// (counted at their 80px minimum, plus the gap) and a gap below
export const boundedMax = (row: number, ins: Insets, gap = 16) => `calc(100dvh - ${ins.top + ins.bottom + row * (ROW_HEIGHT + gap) + gap}px)`;

interface PlacementBase extends PlacementGeom {
  id: string;
  // This placement's own choices — what makes one Button "Buy now / danger / large" without
  // touching the shared component. Unset = the recipe's defaults.
  name?:    string;   // workbench label for this block ("Hero CTA") — also the comment in generated code
  color?:   string;   // workbench-only block colour on the Artboard (planning aid, never emitted)
  options?: Record<string, string>;            // variant axis → option
  props?:   Record<string, string | boolean | ListItem[]>;  // prop name → value (lists: nav links…)
  bounded?: boolean;   // scrolls inside itself, never taller than the screen between the kept-clear edges; always one row
                       // (resolvePlacement), which grows to what it shows, so its area is exactly what's drawn
  parent?:  string;    // the group it sits in (its col/row count inside the group); unset = the page
  at?: Partial<Record<Exclude<Tier, 'mobile'>, Partial<PlacementGeom>>>;
}
// A block is a component's use, or a group (a box with its own grid, no component). The two are told apart by `kind`,
// so code reaching for a component id has to say what a group does there (TypeScript won't index with one that may
// be missing).
export type ComponentPlacement = PlacementBase & { kind?: undefined; componentId: string };   // a ProjectComponent id in the same project
export type GroupPlacement = PlacementBase & { kind: 'group'; componentId?: undefined };
export type PagePlacement = ComponentPlacement | GroupPlacement;

// Geometry of a placement at a tier, on that tier's column grid
export function resolvePlacement(p: PagePlacement, tier: Tier): PlacementGeom {
  let g: PlacementGeom = { col: p.col, row: p.row, colSpan: p.colSpan, rowSpan: p.rowSpan, hidden: p.hidden, pin: p.pin };
  let cols = TIER_COLUMNS.mobile;
  for (const t of TIER_ORDER.slice(1, TIER_ORDER.indexOf(tier) + 1) as Exclude<Tier, 'mobile'>[]) {
    const n = TIER_COLUMNS[t], k = n / cols;
    const colSpan = Math.max(1, Math.min(n, Math.round(g.colSpan * k)));
    g = { ...g, col: Math.min(n - colSpan, Math.round(g.col * k)), colSpan };
    const o = p.at?.[t];
    if (o) { g = { ...g, ...o }; g.colSpan = Math.max(1, Math.min(n, g.colSpan)); g.col = Math.max(0, Math.min(n - g.colSpan, g.col)); }
    cols = n;
  }
  return p.bounded ? { ...g, rowSpan: 1 } : g;   // one row that grows to what it shows (content, capped by the screen): no rows it never fills
}

// What a tier would show without its own override (the tiers below, scaled)
const inheritedAt = (p: PagePlacement, tier: Exclude<Tier, 'mobile'>): PlacementGeom => resolvePlacement({ ...p, at: { ...p.at, [tier]: undefined } }, tier);

// A placement after a geometry edit at a tier. On a wider tier the override keeps only what differs from what that
// tier inherits, so the rest still follows edits below (move it down on Desktop and its columns still track Mobile);
// an edit back to the inherited value drops that field, and an override left empty goes away.
export function withTierGeom(p: PagePlacement, tier: Tier, geom: Partial<PlacementGeom>): PagePlacement {
  if (tier === 'mobile') return { ...p, ...geom };
  const base = inheritedAt(p, tier), o: Partial<PlacementGeom> = { ...p.at?.[tier], ...geom };
  for (const k of ['col', 'row', 'colSpan', 'rowSpan', 'hidden'] as const) if (k in o && (o[k] ?? false) === (base[k] ?? false)) delete o[k];
  const at = { ...p.at };
  if (Object.keys(o).length) at[tier] = o; else delete at[tier];
  return { ...p, at: Object.keys(at).length ? at : undefined };
}

// True when `tier` has its own override (vs. inheriting)
export const isOverridden = (p: PagePlacement, tier: Tier) => tier !== 'mobile' && !!p.at?.[tier];

// ── Groups — boxes within boxes ──────────────────────────────────
// A group is a placement with no component: a box on its container's grid whose own grid splits that box further. Its
// columns are its container's (CSS subgrid, so everything inside still lines up with the page), its rows its own. A
// placement inside one names it as `parent`, and its col/row count from the group's first column and row. Groups nest.
// Pinned blocks float over the screen whatever their parent.
export const GROUP = '@group';   // what the editor places or drags in when it's a group (not stored: groups are `kind: 'group'`)
export const isGroup = (p: PagePlacement): p is GroupPlacement => p.kind === 'group';
// The component a block uses (none for a group, or one that's gone)
export const componentOf = (components: Record<string, ProjectComponent> | undefined, p: PagePlacement) => (isGroup(p) ? undefined : components?.[p.componentId]);
// The group a placement sits in, or null for the page (a parent that's gone or isn't a group: the page)
export const parentOf = (ps: PagePlacement[], p: PagePlacement): string | null =>
  p.parent && !p.pin && ps.some((x) => x.id === p.parent && isGroup(x)) ? p.parent : null;
export const childrenOf = (ps: PagePlacement[], parent: string | null) => ps.filter((p) => !p.pin && parentOf(ps, p) === parent);
// The ids inside a group, all the way down
export function descendants(ps: PagePlacement[], id: string): Set<string> {
  const out = new Set<string>();
  for (let more = [id]; more.length;) more = ps.filter((p) => p.parent && more.includes(p.parent) && !out.has(p.id)).map((p) => (out.add(p.id), p.id));
  return out;
}
// How many columns a container has at a tier (the page's, or the group's span, kept inside its own container)
export function containerCols(ps: PagePlacement[], parent: string | null, tier: Tier, depth = 0): number {
  const g = parent && depth < 16 && ps.find((p) => p.id === parent);   // depth: a hand-edited loop of parents ends
  if (!g) return TIER_COLUMNS[tier];
  return Math.min(resolvePlacement(g, tier).colSpan, containerCols(ps, parentOf(ps, g), tier, depth + 1));
}
// A placement's first column on the page's grid at a tier
export function pageCol(ps: PagePlacement[], id: string, tier: Tier, depth = 0): number {
  const p = depth < 16 && ps.find((x) => x.id === id);
  if (!p) return 0;
  const up = parentOf(ps, p);
  return (up ? pageCol(ps, up, tier, depth + 1) : 0) + Math.min(resolvePlacement(p, tier).col, containerCols(ps, up, tier) - 1);
}
// A block's geometry at a tier, kept inside its container's columns: a group's insides scale up the tiers like the page
// does, and rounding can carry one a column past the group's own width
export function placedAt(ps: PagePlacement[], p: PagePlacement, tier: Tier): PlacementGeom {
  const g = resolvePlacement(p, tier), up = parentOf(ps, p);
  if (!up) return g;
  const n = containerCols(ps, up, tier), colSpan = Math.min(g.colSpan, n);
  return { ...g, colSpan, col: Math.max(0, Math.min(g.col, n - colSpan)) };
}
// About where a block's row sits on the page's grid (a group's rows are its own; counted here as page rows, which is
// what the height cap of a block that scrolls inside wants: boundedMax)
export function pageRow(ps: PagePlacement[], p: PagePlacement, tier: Tier, depth = 0): number {
  const up = depth < 16 ? parentOf(ps, p) : null, g = up ? ps.find((x) => x.id === up) : undefined;
  return resolvePlacement(p, tier).row + (g ? pageRow(ps, g, tier, depth + 1) : 0);
}
// A placement moved into another container (null = the page), landing at `geom` on this tier: its mobile base is the
// same spot scaled to the container's mobile columns, and a wider tier keeps the exact spot as its own (withTierGeom).
// Its old overrides counted from the old container, so they go.
export function reparented(ps: PagePlacement[], p: PagePlacement, parent: string | null, tier: Tier, geom: Omit<PlacementGeom, 'hidden' | 'pin'>): PagePlacement {
  const moved: PagePlacement = { ...p, parent: parent ?? undefined, at: undefined };
  if (tier === 'mobile') return { ...moved, ...geom };
  const n = containerCols(ps, parent, 'mobile'), k = n / containerCols(ps, parent, tier);
  const colSpan = Math.max(1, Math.min(n, Math.round(geom.colSpan * k)));
  const base = { ...moved, col: Math.min(n - colSpan, Math.round(geom.col * k)), colSpan, row: geom.row, rowSpan: geom.rowSpan };
  return withTierGeom(base, tier, geom);
}

// Reading order at a tier: top to bottom, then left to right, a group's insides right after it; then the pinned
// blocks. Hidden ones (and what's in a hidden group) aren't numbered.
export function readingOrder(ps: PagePlacement[], tier: Tier): Map<string, number> {
  const out = new Map<string, number>(), byPos = (a: { g: PlacementGeom }, b: { g: PlacementGeom }) => a.g.row - b.g.row || a.g.col - b.g.col, kids = byParent(ps);
  const walk = (parent: string | null) => (kids.get(parent) ?? []).map((p) => ({ p, g: resolvePlacement(p, tier) })).filter(({ g }) => !g.hidden).sort(byPos)
    .forEach(({ p }) => { out.set(p.id, out.size + 1); if (isGroup(p)) walk(p.id); });
  walk(null);
  ps.filter((p) => p.pin).map((p) => ({ p, g: resolvePlacement(p, tier) })).filter(({ g }) => !g.hidden).sort(byPos).forEach(({ p }) => out.set(p.id, out.size + 1));
  return out;
}
// The page's blocks as they nest, in source order (the mobile layout's reading order: row, then column), each visited
// with what its group holds (visited first): the export, the layout editor and the Layout and Preview layers all walk
// this one way. `show` leaves a block (and what's in it) out.
export function nest<T>(ps: PagePlacement[], visit: (p: PagePlacement, inner: T[]) => T, show: (p: PagePlacement) => boolean = () => true): T[] {
  const kids = byParent(ps);
  const walk = (parent: string | null, depth: number): T[] => (kids.get(parent) ?? []).filter(show).sort((a, b) => a.row - b.row || a.col - b.col)
    .map((p) => visit(p, isGroup(p) && depth < 16 ? walk(p.id, depth + 1) : []));
  return walk(null, 0);
}
// Each container's blocks (null: the page's), in one pass: what childrenOf answers for one container, for all of them
function byParent(ps: PagePlacement[]): Map<string | null, PagePlacement[]> {
  const groups = new Set(ps.filter(isGroup).map((p) => p.id)), out = new Map<string | null, PagePlacement[]>();
  for (const p of ps) {
    if (p.pin) continue;
    const up = p.parent && groups.has(p.parent) ? p.parent : null;
    out.set(up, [...(out.get(up) ?? []), p]);
  }
  return out;
}
// Every block's geometry at a tier (placedAt) and its row on the page (pageRow), worked out once: views that draw
// every block on every frame of a drag read this instead of walking the parents per block
export function geometryAt(ps: PagePlacement[], tier: Tier): Map<string, { g: PlacementGeom; top: number }> {
  return new Map(ps.map((p) => [p.id, { g: placedAt(ps, p, tier), top: pageRow(ps, p, tier) }]));
}
// What a tier doesn't show: hidden blocks and everything inside a hidden group
export function hiddenAt(ps: PagePlacement[], tier: Tier): Set<string> {
  const out = new Set<string>();
  for (const p of ps) if (resolvePlacement(p, tier).hidden) { out.add(p.id); descendants(ps, p.id).forEach((id) => out.add(id)); }
  return out;
}

// ── Block edits from the menu — each the page's whole new list, applied in one update ─────

const WIDER: Exclude<Tier, 'mobile'>[] = ['tablet', 'desktop'];
const freshId = (n: number) => `pl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}${n ? `-${n}` : ''}`;
// A block's geometry with its rows pushed: the others moved out of its way at `tier` (roomFor), applied
function landed(ps: PagePlacement[], tier: Tier, p: PagePlacement): PagePlacement[] {
  const edits = new Map(roomFor(ps, tier, p).map((e) => [e.id, e.geom]));
  return ps.map((x) => (edits.has(x.id) ? withTierGeom(x, tier, edits.get(x.id)!) : x));
}

// A copy of a block (a group with everything in it, fresh ids, parents kept among the copies), just under it at `tier`
export function duplicateBlock(ps: PagePlacement[], id: string, tier: Tier): { placements: PagePlacement[]; id: string } {
  const src = ps.find((p) => p.id === id);
  if (!src) return { placements: ps, id };
  const inside = descendants(ps, id), ids = new Map([id, ...Array.from(inside)].map((x, i) => [x, freshId(i)]));
  const copies = ps.filter((p) => ids.has(p.id)).map((p) => ({ ...p, id: ids.get(p.id)!, ...(p.parent && ids.has(p.parent) && { parent: ids.get(p.parent) }) }));
  const top = copies.find((c) => c.id === ids.get(id))!, g = placedAt(ps, src, tier);
  const moved = src.pin ? top : withTierGeom(top, tier, { row: g.row + g.rowSpan });
  const all = [...ps, ...copies.map((c) => (c.id === moved.id ? moved : c))];
  return { placements: src.pin ? all : landed(all, tier, moved), id: moved.id };
}

// A block put in a new group that takes its place on every tier (its spot, its overrides, hidden-ness); the block fills
// the group's first row
export function wrapInGroup(ps: PagePlacement[], id: string): { placements: PagePlacement[]; id: string } {
  const p = ps.find((x) => x.id === id);
  if (!p || p.pin) return { placements: ps, id };
  const geomOnly = (o: Partial<PlacementGeom>) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'pin')) as Partial<PlacementGeom>;
  const at = p.at && Object.fromEntries(Object.entries(p.at).map(([t, o]) => [t, geomOnly(o ?? {})]).filter(([, o]) => Object.keys(o as object).length));
  const group: GroupPlacement = {
    id: freshId(0), kind: 'group', col: p.col, row: p.row, colSpan: p.colSpan, rowSpan: p.rowSpan, hidden: p.hidden,
    ...(p.parent && { parent: p.parent }), ...(at && Object.keys(at).length && { at }),
  };
  // inside: from the group's corner, as wide as it on every tier its own width was set
  const inAt = p.at && Object.fromEntries(WIDER.flatMap((t) => {
    const o = p.at?.[t]; if (!o) return [];
    const w = { ...(o.colSpan !== undefined && { colSpan: o.colSpan }), ...(o.rowSpan !== undefined && { rowSpan: o.rowSpan }), ...(o.pin && { pin: o.pin }) };
    return Object.keys(w).length ? [[t, w]] : [];
  }));
  const child: PagePlacement = { ...p, parent: group.id, col: 0, row: 0, hidden: undefined, at: inAt && Object.keys(inAt).length ? inAt : undefined };
  return { placements: ps.flatMap((x) => (x.id === id ? [group, child] : [x])), id: group.id };
}

// A block taken out of its group to the group's container, where it showed on every tier (its spot in the group, moved
// by the group's); what it lands on at `tier` moves down. Rows count as the container's: a group's own rows may be
// sized differently, so that part is close, not exact.
function lifted(ps: PagePlacement[], p: PagePlacement, up: string): PagePlacement {
  const grp = ps.find((x) => x.id === up)!, outer = parentOf(ps, grp);
  const abs = (t: Tier) => { const g = placedAt(ps, grp, t), c = placedAt(ps, p, t); return { col: g.col + c.col, row: g.row + c.row, colSpan: c.colSpan, rowSpan: c.rowSpan }; };
  const m = abs('mobile');
  let out: PagePlacement = { ...p, parent: outer ?? undefined, at: undefined, ...m, hidden: p.hidden || grp.hidden || undefined };   // a hidden group's blocks stay hidden
  for (const t of WIDER) {
    const own = p.at?.[t], a = abs(t);
    out = withTierGeom(out, t, { ...a, hidden: resolvePlacement(p, t).hidden || resolvePlacement(grp, t).hidden || undefined });
    if (own?.pin) out = { ...out, at: { ...out.at, [t]: { ...out.at?.[t], pin: own.pin } } };
  }
  return out;
}
export function moveOutOfGroup(ps: PagePlacement[], id: string, tier: Tier): PagePlacement[] {
  const p = ps.find((x) => x.id === id), up = p && parentOf(ps, p);
  if (!p || !up) return ps;
  const out = lifted(ps, p, up);
  return landed(ps.map((x) => (x.id === id ? out : x)), tier, out);
}
// A group's blocks taken out to its container (each where it showed), and the group gone
export function ungroupBlock(ps: PagePlacement[], id: string, tier: Tier): PagePlacement[] {
  const grp = ps.find((x) => x.id === id);
  if (!grp || !isGroup(grp)) return ps;
  const kids = childrenOf(ps, id), out = new Map(kids.map((k) => [k.id, lifted(ps, k, id)]));
  let next = ps.filter((x) => x.id !== id).map((x) => out.get(x.id) ?? x);
  for (const k of kids) next = landed(next, tier, next.find((x) => x.id === k.id)!);
  return next;
}

// ── The grid's version ───────────────────────────────────────────
// 1: 4 / 8 / 12 columns, 80px rows. 2: 8 / 12 / 24 columns, 32px rows (finer, more spots). A project from before is
// carried over once, wherever it's read or written (lib/server/projects.ts): mobile and desktop columns double
// exactly, tablet's go from 8 to 12; rows double (two 32px rows and their gutter are one 80px row).
export const GRID_VERSION = 2;
export function upgradeGrid(p: ProjectData): ProjectData {
  if ((p.grid ?? 1) >= GRID_VERSION || !p.layouts) return { ...p, grid: GRID_VERSION };
  const cols = (g: Partial<PlacementGeom>, k: number): Partial<PlacementGeom> => ({
    ...g,
    ...(g.col !== undefined && { col: Math.round(g.col * k) }),
    ...(g.colSpan !== undefined && { colSpan: Math.max(1, Math.round(g.colSpan * k)) }),
    ...(g.row !== undefined && { row: g.row * 2 }),
    ...(g.rowSpan !== undefined && { rowSpan: g.rowSpan * 2 }),
  });
  const one = (x: PagePlacement): PagePlacement => ({
    ...x, ...(cols(x, 2) as PlacementGeom),
    ...(x.at && { at: { ...(x.at.tablet && { tablet: cols(x.at.tablet, 1.5) }), ...(x.at.desktop && { desktop: cols(x.at.desktop, 2) }) } }),
  });
  const layouts = Object.fromEntries(Object.entries(p.layouts).map(([path, l]) => [path, {
    ...l, placements: (l.placements ?? []).map(one), ...(l.layers && { layers: l.layers.map((y) => ({ ...y, placements: y.placements.map(one) })) }),
  }]));
  return { ...p, layouts, grid: GRID_VERSION };
}

export interface PageLayer {
  id: string;
  name: string;
  placements: PagePlacement[];
}

export interface PageLayout {
  viewportWidth?: ArtboardViewportWidth;  // legacy (pre-tier) design width — unused since store v7
  placements: PagePlacement[];   // legacy flat list (kept for backward compat)
  layers?: PageLayer[];
  activeLayerId?: string;
}

// Returns the placements for the active layer (falls back to flat list for old data).
export function getActivePlacements(layout: PageLayout): PagePlacement[] {
  if (layout.layers?.length) {
    const active = layout.layers.find((l) => l.id === layout.activeLayerId) ?? layout.layers[0];
    return active?.placements ?? [];
  }
  return layout.placements;
}

// Returns a normalised layers array even for legacy layouts.
export function getEffectiveLayers(layout: PageLayout): PageLayer[] {
  if (layout.layers?.length) return layout.layers;
  return [{ id: 'base', name: 'Base', placements: layout.placements }];
}

// ── Project ───────────────────────────────────────────────────────

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  accent?: string;          // hub/picker identity color
  coreIntent?: string;
  globalTags?: string;
  headTitle?: string;       // default <title> suffix for pages without their own
  headDescription?: string; // fallback description for pages without their own
  archived?: boolean;       // hidden from the project picker (lib/workspace.ts); files kept
  fonts?: FontLoad[];       // web fonts every page loads in its head (lib/library/fonts.ts)
  backdrop?: string;        // a CSS background drawn fixed under every page (a gradient, url(…) cover); pages may override
  live?: LiveBackdrop;      // a live layer over the backdrop, under every page (the sky, a video); pages may override
}

// A live backdrop: drawn fixed under the page, over the CSS backdrop (which stays as the fallback: no script, no
// WebGL, calm). sky = a WebGL nebula and stars (lib/library/behaviors/backdrop.ts); video = a muted loop.
export interface LiveBackdrop {
  kind:    'sky' | 'video' | 'none';   // none: a page turns the project's off
  colors?: string;   // sky: CSS colors, comma-separated — night, nebula, its glow, stars (var(--color-…) works)
  stars?:  number;   // sky: how many stars, 0–1 (default 0.5)
  speed?:  number;   // sky: drift, 0–1 (default 0.5)
  src?:    string;   // video: a path on the site (/sky.mp4) or an https URL
  poster?: string;   // video: the still shown before it plays, and in calm mode
}
const SAFE_URL = /^(\/(?!\/)|\.\/|https:\/\/)[^\s"'<>`\\{}$]*$/;
const num01 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : undefined);

// The live backdrop a page ships, made safe to write into markup: the page's own (kind none: no live layer), else
// the project's. Colors follow the backdrop's rule; addresses must be a site path or https.
export function liveBackdrop(page: { live?: LiveBackdrop } | undefined, meta: { live?: LiveBackdrop } | undefined): LiveBackdrop | undefined {
  const l = page?.live ?? meta?.live;
  if (!l || l.kind === 'none') return undefined;
  if (l.kind === 'sky') {
    const colors = safeBackdrop(l.colors);
    return { kind: 'sky', ...(colors && { colors }), ...(num01(l.stars) !== undefined && { stars: num01(l.stars) }), ...(num01(l.speed) !== undefined && { speed: num01(l.speed) }) };
  }
  if (l.kind === 'video' && l.src && SAFE_URL.test(l.src)) return { kind: 'video', src: l.src, ...(l.poster && SAFE_URL.test(l.poster) && { poster: l.poster }) };
  return undefined;
}

// A backdrop as it may be written into a page's CSS: one declaration's value, nothing that could end it or the
// style block (or the Next.js page's template string). Unsafe text gives undefined: no backdrop.
export const safeBackdrop = (v: string | undefined): string | undefined => {
  const t = v?.trim();
  return t && !/[<>{};`\\$]/.test(t) ? t : undefined;
};

// ── Pages — per-project routes ───────────────────────────────────

export type PageStatus = 'idea' | 'wireframed' | 'laid-out' | 'built';

export const PAGE_STATUSES: { value: PageStatus; label: string; color: string }[] = [
  { value: 'idea',       label: 'Idea',       color: '#8c8576' },
  { value: 'wireframed', label: 'Wireframed', color: '#818cf8' },
  { value: 'laid-out',   label: 'Laid out',   color: '#fbbf24' },
  { value: 'built',      label: 'Built',      color: '#34d399' },
];

// Head / SEO — raw strings, emitted by generator/page.ts as page metadata
export interface PageHead {
  title?:       string;
  description?: string;
  ogImage?:     string;
  noindex?:     boolean;
}

export interface PageDef {
  path:    string;
  name:    string;
  head?:   PageHead;
  backdrop?: string;     // this page's own backdrop (CSS background), over the project's
  live?: LiveBackdrop;   // this page's own live backdrop (kind none: off here), over the project's
  sections?: string[];   // other pages shown in place on this one, switched by #hash (pageSections)
  intent?: string;       // planning only — never emitted
  status?: PageStatus;   // unset = derived (see derivePageStatus)
  notes?:  string;       // planning only — never emitted
}

// One website. Library (prime.components/tokens) is shared; everything page-shaped is per-project.
export interface ProjectData {
  meta:        ProjectMeta;
  pages:       PageDef[];
  layouts:     Record<string, PageLayout>;  // keyed by page path
  wireframes:  Record<string, PageSketches>; // keyed by page path, then breakpoint tier
  activePath?: string;                      // selected page — every widget bound to this project follows it
  viewport?:   ViewportSize;                // selected device — Hub/Artboard/Preview all view at this size
  theme?:      Theme;                       // this project's own copy of the global theme (unset = global)
  components?: Record<string, ProjectComponent>; // this project's owned copies of library recipes
  grid?:       number;                       // the grid's version (GRID_VERSION); unset = 1, upgraded on read
}

export const PROJECT_ACCENTS = ['#818cf8', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#f87171', '#a78bfa', '#2dd4bf'];

// Explicit status wins; otherwise inferred from what exists for the page.
export function derivePageStatus(project: ProjectData, path: string): PageStatus {
  const page = project.pages.find((p) => p.path === path);
  if (page?.status) return page.status;
  const layout = project.layouts[path];
  if (layout && getEffectiveLayers(layout).some((l) => l.placements.length > 0)) return 'laid-out';
  if (Object.values(project.wireframes[path] ?? {}).some((s) => (s?.elements.length ?? 0) > 0)) return 'wireframed';
  return 'idea';
}

export const projectTheme = (p: ProjectData): Theme => p.theme ?? GLOBAL_THEME;

// ── In-place sections ────────────────────────────────────────────
// A page can show other pages in place, one at a time, picked by the #hash: /about becomes #about on it. Each
// section is that page's grid (its pinned blocks stay its own; the host's pinned blocks are the shell), and links to
// it become #about. A section can't have sections of its own.

export interface PageSection { id: string; path: string; name: string; layout: PageLayout }

export const sectionId = (path: string) => path.split('/').filter(Boolean).pop()?.replace(/[^a-zA-Z0-9_-]/g, '-') || 'top';

export function pageSections(project: ProjectData, page: PageDef): PageSection[] {
  const seen = new Set<string>();
  return (page.sections ?? []).flatMap((path) => {
    const p = project.pages.find((x) => x.path === path), layout = project.layouts[path];
    const id = sectionId(path);
    if (!p || !layout || path === page.path || p.sections?.length || seen.has(id)) return [];
    seen.add(id);
    return [{ id, path, name: p.name, layout }];
  });
}
