// What a vector sheet's pointer gestures are made of: the edit contract a canvas hands VectorArtboard,
// the gesture states, and the small geometry they share. Pure (no React).

import type { DesignPage } from '@/lib/design/types';
import type { VaultAsset } from '@/lib/design/vault';
import type { ToolStyles } from '@/lib/design/toolStyles';
import { fromGrid, toGrid, type Anchor, type Box, type GridPt, type Lattice, type Mat, type Plane, type Pt, type VElement, type VZone } from '@/lib/design/vector';

export type VTool = 'select' | 'shape' | 'text' | 'zone' | 'asset' | 'pen' | 'erase';

export interface VectorEdit {
  tool:     VTool;
  selected: string[];
  select:   (ids: string[]) => void;
  apply:    (next: DesignPage, key?: string) => void;
  scale:    number;   // screen px per artboard px — keeps handles a constant size on screen
  showGrid?: boolean; // keep the placement grid on; it also shows while placing or editing a zone
  styles:   ToolStyles;
  placing?: { id: string; asset: VaultAsset };   // what the Place from vault tool puts down
  eraseAll?: boolean; // the eraser makes holes in shapes, lines, text and images too (Fab); otherwise it cuts pen strokes only
  placed?: () => void;   // after a shape, text box or zone is put down (the canvas goes back to select)
}

// A tablet pen sample, in page coordinates. x/y are only meaningful while prox is true.
export interface PagePen { x: number; y: number; p: number; prox: boolean; down: boolean; eraser: boolean }

export const DRAG_START = 4;   // page px of movement before a press on an element counts as a drag
export const ZONE_TAP = 4;   // tiles per side when the zone tool is tapped instead of dragged
export const MIN_SIZE = 16;
export const DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
export type Dir = (typeof DIRS)[number];

export type Gesture =
  | { kind: 'move'; start: Pt; base: VElement[]; ids: string[]; carried: string[]; key: string; moved?: boolean }
  | { kind: 'resize'; id: string; dir: Dir; box: Box; deg: number; plane?: Mat; lift: number; key: string }
  | { kind: 'rotate'; id: string; c: Pt; key: string; block?: { from: number; turn: number; quarter: boolean } }
  | { kind: 'pull'; id: string; dir: Dir; base: VZone; key: string }
  | { kind: 'zone'; grid: Lattice; start: GridPt; cur: GridPt }
  | { kind: 'endpoint'; id: string; end: 'from' | 'to'; key: string }
  | { kind: 'marquee'; start: Pt; cur: Pt }
  | { kind: 'create'; type: 'rect' | 'ellipse' | 'capsule' | 'text'; start: Pt; cur: Pt; plane?: Plane; lift?: number }
  | { kind: 'line'; from: Anchor; start: Pt; cur: Pt }
  | { kind: 'poly'; pts: Pt[]; cur: Pt; plane?: Plane; lift?: number }   // stays open across clicks until finished
  | { kind: 'pen'; points: [number, number][]; pressures?: number[] }
  | { kind: 'erase'; key: string; last: Pt }
  // The line eraser: drag a line (placed), then drag again to pull it across the floor (square to it on the ground; on a
  // flat sheet, square to it); the band it sweeps goes. Stays between drags, like a polygon; `from` is where the
  // pulling drag started, `off` how far the line has moved on the page
  | { kind: 'cut'; a: Pt; b: Pt; placed: boolean; off: Pt; from?: Pt };

// What the gestures need from a mouse event or a pen sample
export type Press = { clientX: number; clientY: number; timeStamp: number; shiftKey?: boolean; pressure?: number };

// Browsers report pressure 0.5 for a mouse, so only a real stylus counts as a pressure stroke.
export const fromPointer = (e: React.PointerEvent): Press => ({
  clientX: e.clientX, clientY: e.clientY, timeStamp: e.timeStamp, shiftKey: e.shiftKey,
  pressure: e.pointerType === 'pen' ? e.pressure : undefined,
});

export const boxFrom = (a: Pt, b: Pt): Box => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
export const angleAt = (c: Pt, p: Pt) => (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI;   // degrees, clockwise from +x
export const down = (p: Pt, lift = 0): Pt => ({ x: p.x, y: p.y + lift });   // from a roof's height to the floor under it
export const tileAt = (g: Lattice, p: Pt): GridPt => { const t = toGrid(g, p); return { a: Math.floor(t.a), b: Math.floor(t.b) }; };
export const toPoints = (pts: Pt[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');

// The zone a drag on the grid covers, both end tiles included
export function zoneSpan(g: Lattice, s: GridPt, c: GridPt) {
  const a = Math.min(s.a, c.a), b = Math.min(s.b, c.b);
  return { ...fromGrid(g, { a, b }), cols: Math.abs(s.a - c.a) + 1, rows: Math.abs(s.b - c.b) + 1, cell: g.cell, flat: g.flat };
}
