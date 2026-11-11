// What each drawing tool will make next: its settings and saved favorites. Per viewer, not part of any page.
// Pure data + conversion to element fields, so the menu, the artboard and tests agree. Imports stay relative (CLI).

import { fxDef } from './fx';
import type { Fx, LinePattern, Plane, TextBackground, VBrush, VElement, VType } from './vector';

export type ShapeKind = 'rect' | 'rounded' | 'ellipse' | 'bush' | 'capsule' | 'poly' | 'line' | 'arrow' | 'double' | 'curve';
export const LINE_KINDS: ShapeKind[] = ['line', 'arrow', 'double', 'curve'];
export const isLineKind = (k: ShapeKind) => LINE_KINDS.includes(k);

export interface ShapeTool {
  kind: ShapeKind; fill?: string; stroke?: string; strokeWidth: number; dash?: LinePattern; opacity: number;
  hollow?: boolean;   // outline only. Keeps `fill` for when it's filled again
  plane?: Plane;      // new box shapes lie in this plane (none: flat on the page)
  lift?: number;      // a new roof's height above the floor
  slope?: number; slopeAlong?: 'w' | 'h';   // and its pitch
  walls?: boolean;    // and whether walls drop from it to the floor
  fx?: Fx[];          // effects new shapes start with (roughen, blur…)
}
// The element type a shape kind makes
export const shapeType = (k: ShapeKind): VType =>
  isLineKind(k) ? 'line' : k === 'rect' || k === 'rounded' ? 'rect' : k === 'ellipse' || k === 'bush' ? 'ellipse' : k === 'capsule' ? 'capsule' : 'poly';
// Filled means it has a fill color and isn't set to outline
export const isFilled = (s: Pick<ShapeTool, 'fill' | 'hollow'>) => !s.hollow && !!s.fill;
export interface TextTool {
  size: number; weight: number; font: 'serif' | 'sans' | 'mono'; color: string; align: 'left' | 'center' | 'right'; caps?: boolean;
  bg?: string; bgShape?: TextBackground;
}
// cell and flat live on the page's grid; they're only here so a favorite can carry them
export interface ZoneTool { fill?: string; stroke?: string; strokeWidth: number; dash?: LinePattern; opacity: number; noLines?: boolean; cell?: number; flat?: boolean }
export interface PenTool { size: number; brush: VBrush; color: string }
export interface EraseTool { size: number; shape: 'round' | 'square' | 'whole' | 'line' }   // line: place a line, pull it up or down, the band goes
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
    { id: 'bush',   name: 'Bush',         style: { kind: 'bush', fill: '#2f7d4f', stroke: INK, strokeWidth: 2, opacity: 1 } },
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

// The tool's effects that fit this element type (a line drops roughen), copied so the element owns them
const fxOn = (fx: Fx[] | undefined, t: VType) => { const l = fx?.filter((f) => fxDef(f.kind)?.on.includes(t)).map((f) => ({ ...f })); return l?.length ? l : undefined; };

// The fields a new element takes from its tool
export function shapeFields(s: ShapeTool) {
  const line = { stroke: s.stroke ?? INK, strokeWidth: s.strokeWidth, dash: s.dash, opacity: seen(s.opacity), fx: fxOn(s.fx, 'line') };
  if (s.kind === 'line')   return clean({ ...line, arrow: 'none' as const });
  if (s.kind === 'arrow')  return clean({ ...line, arrow: 'end' as const });
  if (s.kind === 'double') return clean({ ...line, arrow: 'both' as const });
  if (s.kind === 'curve')  return clean({ ...line, arrow: 'end' as const, bend: 60 });
  // An outline with no border color draws its border in the fill color, so it doesn't vanish
  return clean({
    fill: s.hollow ? undefined : s.fill, stroke: s.hollow ? s.stroke ?? s.fill ?? INK : s.stroke, strokeWidth: s.strokeWidth, dash: s.dash, opacity: seen(s.opacity),
    fx: fxOn(s.fx, shapeType(s.kind)), radius: s.kind === 'rounded' ? 24 : undefined, taper: s.kind === 'capsule' ? 0.6 : undefined, lobes: s.kind === 'bush' ? 9 : undefined, plane: s.plane,
    lift: s.plane === 'roof' ? s.lift : undefined, slope: s.plane === 'roof' ? s.slope : undefined, slopeAlong: s.plane === 'roof' ? s.slopeAlong : undefined, walls: s.plane === 'roof' ? s.walls : undefined,
  });
}
export const textFields = (t: TextTool) => clean({ ...t, caps: t.caps || undefined, bgShape: t.bg ? t.bgShape ?? 'block' : undefined });
export function zoneFields(z: ZoneTool) {
  return clean({ ...z, cell: undefined, flat: undefined, opacity: seen(z.opacity), noLines: z.noLines || undefined });
}
export const strokeFields = (p: PenTool) => clean({
  color: p.color, width: p.size, brush: p.brush === 'ink' ? undefined : p.brush, opacity: p.brush === 'highlighter' ? 0.4 : undefined,
});

// Same settings, ignoring fields that are simply unset
export function sameStyle(a: object, b: object): boolean {
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  return Array.from(new Set([...Object.keys(x), ...Object.keys(y)])).every((k) => JSON.stringify(x[k] || undefined) === JSON.stringify(y[k] || undefined));
}

// A favorite clicked with something selected restyles it: only its look (colors, border, transparency, the text's
// style, a bush's bumps), never its kind, size or plane. Undefined when the favorite's tool doesn't make this element.
export function favoritePatch(el: VElement, t: keyof Favorites, style: object): Record<string, unknown> | undefined {
  if (t === 'shape' && (el.type === 'rect' || el.type === 'ellipse' || el.type === 'capsule' || el.type === 'poly')) {
    const s = style as ShapeTool, hollow = s.hollow || !s.fill;
    return {
      fill: hollow ? undefined : s.fill, stroke: hollow ? s.stroke ?? s.fill ?? INK : s.stroke, strokeWidth: s.strokeWidth, dash: s.dash, opacity: seen(s.opacity),
      fx: fxOn(s.fx, el.type),
      ...(el.type === 'ellipse' && s.kind === 'bush' && !el.lobes ? { lobes: 9 } : {}),
    };
  }
  if (t === 'shape' && el.type === 'line') { const s = style as ShapeTool; return { stroke: s.stroke ?? INK, strokeWidth: s.strokeWidth, dash: s.dash, opacity: seen(s.opacity), fx: fxOn(s.fx, 'line') }; }
  if (t === 'text' && el.type === 'text') {
    const s = style as TextTool;
    return { size: s.size, weight: s.weight, font: s.font, color: s.color, align: s.align, caps: s.caps || undefined, bg: s.bg, bgShape: s.bg ? s.bgShape ?? 'block' : undefined };
  }
  if (t === 'zone' && el.type === 'zone') {
    const s = style as ZoneTool;
    return { fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, dash: s.dash, opacity: seen(s.opacity), noLines: s.noLines || undefined };
  }
  return undefined;
}

// Stored settings merged over the defaults, so a setting added later still has a value. A built-in favorite added
// later (listed nowhere in `known`) joins your saved ones once; one you've deleted stays deleted.
export function mergeSaved(raw: unknown): { styles: ToolStyles; favorites: Favorites; known: string[] } {
  const r = (typeof raw === 'object' && raw ? raw : {}) as { styles?: Partial<ToolStyles>; favorites?: Partial<Favorites>; known?: string[] };
  const s = r.styles ?? {}, f = r.favorites ?? {};
  const known = new Set(Array.isArray(r.known) ? r.known : ['box', 'card', 'arrow', 'route', 'title', 'head', 'body', 'label', 'teal', 'magenta', 'yellow', 'orange']);
  const mine = <K extends keyof Favorites>(k: K): Favorites[K] => {
    const saved = f[k];
    if (!Array.isArray(saved)) return DEFAULT_FAVORITES[k];
    return [...saved, ...DEFAULT_FAVORITES[k].filter((d) => !known.has(d.id) && !saved.some((x) => x.id === d.id))] as Favorites[K];
  };
  return {
    known: Object.values(DEFAULT_FAVORITES).flatMap((list: { id: string }[]) => list.map((d) => d.id)),
    styles: {
      select: { ...DEFAULT_STYLES.select, ...s.select }, shape: { ...DEFAULT_STYLES.shape, ...s.shape }, text: { ...DEFAULT_STYLES.text, ...s.text },
      zone: { ...DEFAULT_STYLES.zone, ...s.zone }, pen: { ...DEFAULT_STYLES.pen, ...s.pen }, erase: { ...DEFAULT_STYLES.erase, ...s.erase },
    },
    favorites: {
      shape: mine('shape'), text: mine('text'), zone: mine('zone'),
    },
  };
}
