import { Tier, TIER_COLUMNS, TIER_ORDER, ViewportSize, tierOf } from './devices';
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

// Page-pixel units per grid row, and the column count for a given breakpoint.
export const ROW_HEIGHT = 80;

// Grid columns at a viewport width — follows the breakpoint tiers (4 / 8 / 12)
export function numColumns(width: number): number {
  return TIER_COLUMNS[tierOf(width)];
}

// ── Placements — mobile-first, per-tier overrides ────────────────
// Base geometry (col/row/span, hidden) is the MOBILE layout on a 4-col grid. Tablet and desktop
// inherit it cascading upward like mobile-first CSS; an unset tier inherits the tier below,
// scaled to its column count (full width stays full width). `at[tier]` stores only what that
// tier changes. Raw grid numbers + a semantic tier key → any generator can emit it.

export interface PlacementGeom { col: number; row: number; colSpan: number; rowSpan: number; hidden?: boolean; pin?: Pin }

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
export function pinStyle(pin: Pin, colSpan: number, cols: number): Record<string, string> {
  const m = `${PIN_MARGIN}px`, w = `calc(${(100 * Math.min(colSpan, cols)) / cols}% - ${2 * PIN_MARGIN}px)`;
  switch (pin.at) {
    case 'top':          return { top: '0', left: '0', right: '0' };
    case 'bottom':       return { bottom: '0', left: '0', right: '0' };
    case 'left':         return { top: '0', bottom: '0', left: '0', width: w };
    case 'right':        return { top: '0', bottom: '0', right: '0', width: w };
    case 'top-left':     return { top: m, left: m, width: w };
    case 'top-right':    return { top: m, right: m, width: w };
    case 'bottom-left':  return { bottom: m, left: m, width: w };
    case 'bottom-right': return { bottom: m, right: m, width: w };
  }
}

// How much of the screen a bounded block may take at its row: the viewport less the kept-clear edges, the rows above
// (counted at their 80px minimum, plus the gap) and a gap below
export const boundedMax = (row: number, ins: Insets, gap = 16) => `calc(100dvh - ${ins.top + ins.bottom + row * (ROW_HEIGHT + gap) + gap}px)`;

export interface PagePlacement extends PlacementGeom {
  id: string;
  componentId: string;   // a ProjectComponent id in the same project
  // This placement's own choices — what makes one Button "Buy now / danger / large" without
  // touching the shared component. Unset = the recipe's defaults.
  name?:    string;   // workbench label for this block ("Hero CTA") — also the comment in generated code
  color?:   string;   // workbench-only block colour on the Artboard (planning aid, never emitted)
  options?: Record<string, string>;            // variant axis → option
  props?:   Record<string, string | boolean | ListItem[]>;  // prop name → value (lists: nav links…)
  bounded?: boolean;   // scrolls inside itself, never taller than the screen between the kept-clear edges
  at?: Partial<Record<Exclude<Tier, 'mobile'>, Partial<PlacementGeom>>>;
}

// Geometry of a placement at a tier, on that tier's column grid
export function resolvePlacement(p: PagePlacement, tier: Tier): PlacementGeom {
  let g: PlacementGeom = { col: p.col, row: p.row, colSpan: p.colSpan, rowSpan: p.rowSpan, hidden: p.hidden, pin: p.pin };
  let cols = TIER_COLUMNS.mobile;
  for (const t of TIER_ORDER.slice(1, TIER_ORDER.indexOf(tier) + 1) as Exclude<Tier, 'mobile'>[]) {
    const n = TIER_COLUMNS[t], k = n / cols;
    const colSpan = Math.max(1, Math.min(n, Math.round(g.colSpan * k)));
    g = { ...g, col: Math.min(n - colSpan, Math.round(g.col * k)), colSpan };
    const o = p.at?.[t];
    if (o) g = { ...g, ...o };
    cols = n;
  }
  return g;
}

// True when `tier` has its own override (vs. inheriting)
export const isOverridden = (p: PagePlacement, tier: Tier) => tier !== 'mobile' && !!p.at?.[tier];

// Stack a wide arrangement into a single mobile column, in reading order (row, then col).
// Used to derive a mobile base from layouts designed at desktop/tablet width.
export function stackForMobile(ps: PagePlacement[]): Map<string, PlacementGeom> {
  const out = new Map<string, PlacementGeom>();
  let y = 0;
  for (const p of [...ps].sort((a, b) => a.row - b.row || a.col - b.col)) {
    if (p.id === 'slot-bg') { out.set(p.id, { col: 0, row: 0, colSpan: TIER_COLUMNS.mobile, rowSpan: p.rowSpan }); continue; }
    out.set(p.id, { col: 0, row: y, colSpan: TIER_COLUMNS.mobile, rowSpan: p.rowSpan });
    y += p.rowSpan;
  }
  return out;
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
