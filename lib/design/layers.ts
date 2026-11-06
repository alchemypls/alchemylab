// Named layers on a vector page (bible pages and vault assets alike). `page.layers` stacks bottom to top;
// each element names its layer with `layer`. An element with no layer, or one naming a missing layer,
// belongs to the bottom layer, so a page without `layers` is one layer holding everything.
// Hidden layers aren't drawn and can't be clicked; locked ones are drawn but can't be clicked or erased.
// A placed vault asset shows the asset's visible layers, unless the placement picks its own (`VAsset.layers`).
// Pure data + ops. Imports stay relative (CLI).

import type { DesignPage } from './types';
import type { VElement } from './vector';

export interface VLayer { id: string; name: string; hidden?: boolean; locked?: boolean }

export const DEFAULT_LAYER: VLayer = { id: 'layer-1', name: 'Layer 1' };
export const layersOf = (p: Pick<DesignPage, 'layers'> | null | undefined): VLayer[] => (p?.layers?.length ? p.layers : [DEFAULT_LAYER]);

const indexOf = (layers: VLayer[], el: VElement) => Math.max(layers.findIndex((l) => l.id === el.layer), 0);
export const layerOf = (layers: VLayer[], el: VElement) => layers[indexOf(layers, el)];

// What draws, bottom to top: layer by layer, floors first within a layer, otherwise in array order.
// `show` names the layers to draw (a placement's pick); without it, every layer that isn't hidden.
export function drawOrder(els: VElement[], layers: VLayer[], show?: string[]): VElement[] {
  const on = (l: VLayer) => (show ? show.includes(l.id) : !l.hidden);
  return layers.flatMap((l, i) => {
    if (!on(l)) return [];
    const mine = els.filter((e) => indexOf(layers, e) === i);
    return [...mine.filter((e) => e.type === 'zone'), ...mine.filter((e) => e.type !== 'zone')];
  });
}

// Elements the tools can't touch: on a hidden or locked layer
export function untouchable(p: DesignPage): Set<string> {
  const layers = layersOf(p);
  return new Set((p.elements ?? []).filter((e) => { const l = layerOf(layers, e); return l.hidden || l.locked; }).map((e) => e.id));
}

// New elements (ids not in `before`) without a layer go on `layer`
export function stampLayer(before: DesignPage | null, next: DesignPage, layer: string | undefined): DesignPage {
  if (!layer || !next.layers?.length || !next.elements) return next;
  const had = new Set((before?.elements ?? []).map((e) => e.id));
  let changed = false;
  const elements = next.elements.map((e) => {
    if (had.has(e.id) || e.layer) return e;
    changed = true;
    return { ...e, layer };
  });
  return changed ? { ...next, elements } : next;
}

const nextId = (layers: VLayer[]) => {
  for (let n = layers.length + 1; ; n++) if (!layers.some((l) => l.id === `layer-${n}`)) return `layer-${n}`;
};

// The page's layers made explicit, so they can be edited
const withLayers = (p: DesignPage, layers: VLayer[]): DesignPage => ({ ...p, layers });

export function addLayer(p: DesignPage, above?: string): { page: DesignPage; id: string } {
  const layers = layersOf(p), id = nextId(layers), i = above ? layers.findIndex((l) => l.id === above) : -1;
  const at = i < 0 ? layers.length : i + 1;
  const next = [...layers.slice(0, at), { id, name: `Layer ${layers.length + 1}` }, ...layers.slice(at)];
  // Elements that only belonged to the bottom layer by default get named, so they stay there
  const bottom = layers[0].id;
  const elements = p.elements?.map((e) => (e.layer && layers.some((l) => l.id === e.layer) ? e : { ...e, layer: bottom }));
  return { page: { ...withLayers(p, next), ...(elements && { elements }) }, id };
}

export const updateLayer = (p: DesignPage, id: string, patch: Partial<Omit<VLayer, 'id'>>): DesignPage =>
  withLayers(p, layersOf(p).map((l) => (l.id === id ? { ...l, ...patch } : l)));

// Removes a layer and everything on it. The last layer can't be removed.
export function removeLayer(p: DesignPage, id: string): DesignPage {
  const layers = layersOf(p);
  if (layers.length < 2) return p;
  const gone = new Set((p.elements ?? []).filter((e) => layerOf(layers, e).id === id).map((e) => e.id));
  const rest = layers.filter((l) => l.id !== id);
  // Elements that fell to the bottom by default must keep their layer when the bottom changes
  const elements = (p.elements ?? []).filter((e) => !gone.has(e.id)).map((e) => (e.layer && rest.some((l) => l.id === e.layer) ? e : { ...e, layer: layerOf(layers, e).id }));
  return { ...p, layers: rest, elements };
}

// d = +1 moves it up (drawn later), -1 down
export function moveLayer(p: DesignPage, id: string, d: number): DesignPage {
  const layers = [...layersOf(p)], i = layers.findIndex((l) => l.id === id), j = i + d;
  if (i < 0 || j < 0 || j >= layers.length) return p;
  const bottom = layers[0].id;
  [layers[i], layers[j]] = [layers[j], layers[i]];
  const elements = p.elements?.map((e) => (e.layer && layers.some((l) => l.id === e.layer) ? e : { ...e, layer: bottom }));
  return { ...p, layers, ...(elements && { elements }) };
}

export const moveToLayer = (p: DesignPage, ids: string[], layer: string): DesignPage =>
  ({ ...withLayers(p, layersOf(p)), elements: (p.elements ?? []).map((e) => (ids.includes(e.id) ? { ...e, layer } : e)) });

export function validateLayers(raw: Record<string, unknown>, errors: string[], warnings: string[]) {
  if (raw.layers === undefined) return;
  if (!Array.isArray(raw.layers)) return void errors.push('layers: must be an array');
  const ids = new Set<string>();
  raw.layers.forEach((l, i) => {
    const o = l as Record<string, unknown>;
    if (typeof l !== 'object' || l === null || typeof o.id !== 'string' || typeof o.name !== 'string') return void errors.push(`layers[${i}]: {id, name} strings`);
    if (ids.has(o.id)) errors.push(`layers[${i}].id: duplicate "${o.id}"`);
    ids.add(o.id);
  });
  if (!Array.isArray(raw.elements)) return;
  raw.elements.forEach((e, i) => {
    const layer = (e as Record<string, unknown>)?.layer;
    if (layer !== undefined && !ids.has(layer as string)) warnings.push(`elements[${i}].layer: no layer "${String(layer)}" (drawn on the bottom layer)`);
  });
}

// For the agent: which layers the user has hidden, and how much is on them
export function hiddenLayers(p: DesignPage): { name: string; count: number }[] {
  const layers = layersOf(p), els = p.elements ?? [];
  return layers.filter((l) => l.hidden).map((l) => ({ name: l.name, count: els.filter((e) => layerOf(layers, e).id === l.id).length }));
}
