import { describe, expect, it } from 'vitest';
import type { DesignPage } from './types';
import type { VElement } from './vector';
import { addLayer, drawOrder, layersOf, moveLayer, removeLayer, stampLayer, untouchable } from './layers';

const el = (id: string, type: 'rect' | 'zone' = 'rect', layer?: string): VElement =>
  (type === 'zone' ? { id, type, x: 0, y: 0, cols: 1, rows: 1, cell: 32, layer } : { id, type, x: 0, y: 0, w: 10, h: 10, layer });
const page = (elements: VElement[], layers?: DesignPage['layers']): DesignPage => ({ title: 't', blocks: [], elements, layers });
const L = (id: string, more = {}) => ({ id, name: id, ...more });

describe('layers', () => {
  it('treats a page without layers as one layer holding everything', () => {
    expect(layersOf(page([]))).toHaveLength(1);
    expect(drawOrder([el('a'), el('b')], layersOf(page([]))).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('draws layer by layer, bottom first, and floors first within a layer', () => {
    const layers = [L('low'), L('high')];
    const els = [el('top-box', 'rect', 'high'), el('box', 'rect', 'low'), el('floor', 'zone', 'low')];
    expect(drawOrder(els, layers).map((e) => e.id)).toEqual(['floor', 'box', 'top-box']);
  });

  it('puts an element naming a missing layer on the bottom one', () => {
    expect(drawOrder([el('a', 'rect', 'gone')], [L('bottom'), L('top')]).map((e) => e.id)).toEqual(['a']);
  });

  it("keeps the tools off hidden and locked layers, and doesn't draw hidden ones", () => {
    const p = page([el('a', 'rect', 'shown'), el('b', 'rect', 'locked'), el('c', 'rect', 'hidden')], [L('shown'), L('locked', { locked: true }), L('hidden', { hidden: true })]);
    expect(Array.from(untouchable(p)).sort()).toEqual(['b', 'c']);
    expect(drawOrder(p.elements!, p.layers!).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('stamps only new, unlayered elements with the active layer', () => {
    const before = page([el('old')], [L('one'), L('two')]);
    const next = stampLayer(before, page([el('old'), el('new'), el('picked', 'rect', 'one')], before.layers), 'two');
    expect(next.elements!.map((e) => e.layer)).toEqual([undefined, 'two', 'one']);
  });

  it('keeps elements in place when layers are added, reordered or removed', () => {
    const p0 = page([el('a')]);                       // on the implicit bottom layer
    const { page: p1, id } = addLayer(p0);
    expect(p1.elements![0].layer).toBe('layer-1');    // named now, so it stays at the bottom
    const p2 = moveLayer(p1, id, -1);                 // the new layer goes under
    expect(drawOrder(p2.elements!, p2.layers!)[0].id).toBe('a');
    expect(removeLayer(p2, 'layer-1').elements).toEqual([]);   // removing a layer takes what's on it
    expect(removeLayer(page([el('a')]), 'layer-1').elements).toHaveLength(1);   // never the last layer
  });
});
