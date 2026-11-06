// What each drawing tool will make next: its settings and saved favorites. Per viewer, not part of any page.
// Pure data + conversion to element fields, so the menu, the artboard and tests agree. Imports stay relative (CLI).

import type { LinePattern, Plane, TextBackground, VBrush, VElement, VType } from './vector';

export type ShapeKind = 'rect' | 'rounded' | 'ellipse' | 'capsule' | 'poly' | 'line' | 'arrow' | 'double' | 'curve';
export const LINE_KINDS: ShapeKind[] = ['line', 'arrow', 'double', 'curve'];
export const isLineKind = (k: ShapeKind) => LINE_KINDS.includes(k);

export interface ShapeTool {
  kind: ShapeKind; fill?: string; stroke?: string; strokeWidth: number; dash?: LinePattern; opacity: number;
  hollow?: boolean;   // outline only. Keeps `fill` for when it's filled again
  plane?: Plane;      // new box shapes lie in this plane (none: flat on the page)
  lift?: number;      // a new roof's height above the floor
  slope?: number; slopeAlong?: 'w' | 'h';   // and its pitch
}
// Filled means it has a fill color and isn't set to outline
export const isFilled = (s: Pick<ShapeTool, 'fill' | 'hollow'>) => !s.hollow && !!s.fill;
export interface TextTool {
  size: number; weight: number; font: 'serif' | 'sans' | 'mono'; color: string; align: 'left' | 'center' | 'right'; caps?: boolean;
  bg?: string; bgShape?: TextBackground;
}
// cell and flat live on the page's grid; they're only here so a favorite can carry them
export interface ZoneTool { fill?: string; stroke?: string; strokeWidth: number; dash?: LinePattern; opacity: number; noLines?: boolean; cell?: number; flat?: boolean }
export interface PenTool { size: number; brush: VBrush; color: string }
export interface EraseTool { size: number; shape: 'round' | 'square' | 'whole' }
export interface SelectTool {
  off: VType[];     // element types that can't be clicked
  free?: boolean;   // snapping off: moves, new shapes, resizes and line ends go exactly where the pointer is (floors still snap)
  turnBlocks?: boolean;   // placed blocks show a turn knob (isometric floors: quarter turns; flat: any angle)
}

export interface ToolStyles { select: SelectTool; shape: ShapeTool; text: TextTool; zone: ZoneTool; pen: PenTool; erase: EraseTool }
export interface Favorite<T> { id: string; name: string; style: T }
export interface Favorites { shape: Favorite<ShapeTool>[]; text: Favorite<TextTool>[]; zone: Favorite<ZoneTool>[] }

const INK = '#1f1c17';   // same as DesignArtboard's; this file can't import a component

export const SELECT_FILTERS: { label: string; types: VType[] }[] = [
  { label: 'Shapes', types: ['rect', 'ellipse', 'capsule', 'poly'] },
  { label: 'Lines and arrows', types: ['line'] },
  { label: 'Text', types: ['text'] },
  { label: 'Pen strokes', types: ['stroke'] },
  { label: 'Images', types: ['image'] },
  { label: 'Vault assets', types: ['asset'] },
  { label: 'Floors', types: ['zone'] },
  { label: 'Status dots', types: ['status'] },
];

export const DEFAULT_STYLES: ToolStyles = {
  select: { off: [] },
  shape:  { kind: 'rect', stroke: INK, strokeWidth: 3, opacity: 1 },
  text:   { size: 28, weight: 400, font: 'sans', color: INK, align: 'left' },
  zone:   { fill: '#13a89a', stroke: INK, strokeWidth: 3, opacity: 1 },
  pen:    { size: 4, brush: 'ink', color: INK },
  erase:  { size: 32, shape: 'round' },
};

export const DEFAULT_FAVORITES: Favorites = {
  shape: [
    { id: 'box',    name: 'Outline box',  style: DEFAULT_STYLES.shape },
    { id: 'card',   name: 'Filled card',  style: { kind: 'rounded', fill: '#ffffff', stroke: INK, strokeWidth: 2, opacity: 1 } },
    { id: 'arrow',  name: 'Arrow',        style: { kind: 'arrow', stroke: INK, strokeWidth: 3, opacity: 1 } },
    { id: 'route',  name: 'Dashed route', style: { kind: 'arrow', stroke: '#d6006c', strokeWidth: 3, dash: true, opacity: 1 } },
  ],
  text: [
    { id: 'title', name: 'Title',   style: { size: 64, weight: 700, font: 'serif', color: INK, align: 'left' } },
    { id: 'head',  name: 'Heading', style: { size: 36, weight: 600, font: 'sans', color: INK, align: 'left' } },
    { id: 'body',  name: 'Body',    style: DEFAULT_STYLES.text },
    { id: 'label', name: 'Label',   style: { size: 16, weight: 600, font: 'sans', color: INK, align: 'center', caps: true, bg: '#f2c98a', bgShape: 'block' } },
  ],
  zone: [
    { id: 'teal',    name: 'Teal',    style: { ...DEFAULT_STYLES.zone } },
    { id: 'magenta', name: 'Magenta', style: { ...DEFAULT_STYLES.zone, fill: '#d6006c' } },
    { id: 'yellow',  name: 'Yellow',  style: { ...DEFAULT_STYLES.zone, fill: '#dde06a' } },
    { id: 'orange',  name: 'Orange',  style: { ...DEFAULT_STYLES.zone, fill: '#f28a3c' } },
  ],
};

const clean = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

const seen = (opacity?: number) => (opacity === undefined || opacity >= 1 ? undefined : opacity);

// The fields a new element takes from its tool
export function shapeFields(s: ShapeTool) {
  const line = { stroke: s.stroke ?? INK, strokeWidth: s.strokeWidth, dash: s.dash, opacity: seen(s.opacity) };
  if (s.kind === 'line')   return clean({ ...line, arrow: 'none' as const });
  if (s.kind === 'arrow')  return clean({ ...line, arrow: 'end' as const });
  if (s.kind === 'double') return clean({ ...line, arrow: 'both' as const });
  if (s.kind === 'curve')  return clean({ ...line, arrow: 'end' as const, bend: 60 });
  // An outline with no border color draws its border in the fill color, so it doesn't vanish
  return clean({
    fill: s.hollow ? undefined : s.fill, stroke: s.hollow ? s.stroke ?? s.fill ?? INK : s.stroke, strokeWidth: s.strokeWidth, dash: s.dash, opacity: seen(s.opacity),
    radius: s.kind === 'rounded' ? 24 : undefined, taper: s.kind === 'capsule' ? 0.6 : undefined, plane: s.plane,
    lift: s.plane === 'roof' ? s.lift : undefined, slope: s.plane === 'roof' ? s.slope : undefined, slopeAlong: s.plane === 'roof' ? s.slopeAlong : undefined,
  });
}
export const textFields = (t: TextTool) => clean({ ...t, caps: t.caps || undefined, bgShape: t.bg ? t.bgShape ?? 'block' : undefined });
export function zoneFields(z: ZoneTool) {
  return clean({ ...z, cell: undefined, flat: undefined, opacity: seen(z.opacity), noLines: z.noLines || undefined });
}
export const strokeFields = (p: PenTool) => clean({
  color: p.color, width: p.size, brush: p.brush === 'ink' ? undefined : p.brush, opacity: p.brush === 'highlighter' ? 0.4 : undefined,
});

// A change in a tool's menu also restyles what's selected, if it's the kind of thing that tool makes.
// Returns undefined when this change doesn't apply to this element. undefined values clear a field.
export function restylePatch(el: VElement, tool: keyof ToolStyles, patch: Record<string, unknown>): Record<string, unknown> | undefined {
  const picked = (keys: string[]) => {
    const out: Record<string, unknown> = {};
    for (const k of keys) if (k in patch) out[k] = k === 'opacity' ? seen(patch[k] as number) : patch[k];
    return Object.keys(out).length ? out : undefined;
  };
  if (tool === 'shape' && (el.type === 'rect' || el.type === 'ellipse' || el.type === 'capsule' || el.type === 'poly')) {
    const out = picked(['fill', 'stroke', 'strokeWidth', 'dash', 'opacity', 'plane', 'lift', 'slope', 'slopeAlong']) ?? {};
    if (patch.hollow) { out.fill = undefined; out.stroke = el.stroke ?? el.fill ?? INK; }
    return Object.keys(out).length ? out : undefined;
  }
  if (tool === 'shape' && el.type === 'line') return picked(['stroke', 'strokeWidth', 'dash', 'opacity']);
  if (tool === 'text' && el.type === 'text') return picked(['size', 'weight', 'font', 'color', 'align', 'caps', 'bg', 'bgShape']);
  if (tool === 'zone' && el.type === 'zone') return picked(['fill', 'stroke', 'strokeWidth', 'dash', 'opacity', 'noLines', 'cell', 'flat']);
  if (tool === 'pen' && el.type === 'stroke') {
    const out: Record<string, unknown> = {};
    if ('color' in patch) out.color = patch.color;
    if ('size' in patch) out.width = patch.size;
    if ('brush' in patch) { out.brush = patch.brush === 'ink' ? undefined : patch.brush; out.opacity = patch.brush === 'highlighter' ? 0.4 : undefined; }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

// Same settings, ignoring fields that are simply unset
export function sameStyle(a: object, b: object): boolean {
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  return Array.from(new Set([...Object.keys(x), ...Object.keys(y)])).every((k) => (x[k] || undefined) === (y[k] || undefined));
}

// Stored settings merged over the defaults, so a setting added later still has a value
export function mergeSaved(raw: unknown): { styles: ToolStyles; favorites: Favorites } {
  const r = (typeof raw === 'object' && raw ? raw : {}) as { styles?: Partial<ToolStyles>; favorites?: Partial<Favorites> };
  const s = r.styles ?? {}, f = r.favorites ?? {};
  return {
    styles: {
      select: { ...DEFAULT_STYLES.select, ...s.select }, shape: { ...DEFAULT_STYLES.shape, ...s.shape }, text: { ...DEFAULT_STYLES.text, ...s.text },
      zone: { ...DEFAULT_STYLES.zone, ...s.zone }, pen: { ...DEFAULT_STYLES.pen, ...s.pen }, erase: { ...DEFAULT_STYLES.erase, ...s.erase },
    },
    favorites: {
      shape: Array.isArray(f.shape) ? f.shape : DEFAULT_FAVORITES.shape,
      text:  Array.isArray(f.text)  ? f.text  : DEFAULT_FAVORITES.text,
      zone:  Array.isArray(f.zone)  ? f.zone  : DEFAULT_FAVORITES.zone,
    },
  };
}
