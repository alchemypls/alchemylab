// Edit ops every tool goes through. They break quietly: a wrong reference still draws, until something moves.
import { describe, expect, it } from 'vitest';
import type { DesignPage } from './types';
import { untouchable } from './layers';
import {
  copyElements, duplicateElements, groupElements, lineEnds, pasteElements, removeElements, tenants, withGroups,
  type VElement, type VLine, type VRect, type VZone,
} from './vector';

const rect = (id: string, x: number, y: number, more: Partial<VRect> = {}): VRect => ({ id, type: 'rect', x, y, w: 40, h: 40, ...more });
const zone = (id: string, more: Partial<VZone> = {}): VZone => ({ id, type: 'zone', x: 0, y: 0, cols: 4, rows: 4, cell: 32, ...more });
const arrow = (id: string, from: VLine['from'], to: VLine['to']): VLine => ({ id, type: 'line', from, to });
const page = (elements: VElement[], more: Partial<DesignPage> = {}): DesignPage => ({ title: 't', blocks: [], elements, ...more });
const el = (p: DesignPage, id: string) => p.elements!.find((e) => e.id === id)!;

describe('duplicate', () => {
  it('keeps arrows between the copies attached to the copies', () => {
    const r = duplicateElements(page([rect('a', 0, 0), rect('b', 200, 0), arrow('l', { el: 'a' }, { el: 'b' })]), ['a', 'b', 'l']);
    const l = el(r.page, r.ids[2]) as VLine;
    expect([l.from, l.to]).toEqual([{ el: r.ids[0] }, { el: r.ids[1] }]);
  });

  it('makes a copied group its own group, and keeps a lane painted on a copied floor on the copy', () => {
    const grouped = duplicateElements(groupElements(page([rect('a', 0, 0), rect('b', 50, 0)]), ['a', 'b']), ['a', 'b']);
    expect(withGroups(grouped.page.elements!, ['a']).sort()).toEqual(['a', 'b']);
    const floor = duplicateElements(page([zone('z'), rect('lane', 10, 10, { on: 'z' })]), ['z', 'lane']);
    expect(el(floor.page, floor.ids[1]).on).toBe(floor.ids[0]);
  });
});

describe('copy and paste between pages', () => {
  const source = page([zone('floor'), rect('piece', 10, 10, { on: 'floor', layer: 'table' }), rect('box', 600, 0), arrow('l', { el: 'piece' }, { el: 'box' })], {
    layers: [{ id: 'layer-1', name: 'Layer 1' }, { id: 'table', name: 'Table' }],
  });

  it('brings its layers along and keeps references among the copies', () => {
    const r = pasteElements(page([rect('mine', 0, 0)]), copyElements(source, ['floor', 'piece']));
    const [floor, piece] = r.ids.map((id) => el(r.page, id));
    expect(r.page.layers?.map((l) => l.id)).toEqual(['layer-1', 'table']);
    expect([piece.on, piece.layer]).toEqual([floor.id, 'table']);
    expect(el(r.page, 'mine')).toBeTruthy();
  });

  it('pins line ends that pointed at something left behind', () => {
    const l = copyElements(source, ['piece', 'l']).elements.find((e) => e.id === 'l') as VLine;
    expect(l.from).toEqual({ el: 'piece' });
    expect('x' in l.to).toBe(true);
  });
});

describe('what moves and what can be touched', () => {
  it('picks a whole group from any member', () => {
    const p = groupElements(page([rect('a', 0, 0), rect('b', 50, 0), rect('c', 100, 0)]), ['a', 'b']);
    expect(withGroups(p.elements!, ['b']).sort()).toEqual(['a', 'b']);
    expect(withGroups(p.elements!, ['c'])).toEqual(['c']);
  });

  it('carries the pieces standing on a floor with it', () => {
    expect(tenants([zone('z', { flat: true }), rect('on', 40, 40), rect('off', 400, 400)], ['z'])).toEqual(['on']);
  });

  it('pins an arrow where it was when its target is deleted', () => {
    const p = page([rect('a', 0, 0), rect('b', 300, 0), arrow('l', { el: 'a' }, { el: 'b' })]);
    const before = lineEnds(el(p, 'l') as VLine, p.elements!);
    expect((el(removeElements(p, ['b']), 'l') as VLine).to).toEqual(before[1]);
  });

  it('keeps the tools off hidden and locked layers', () => {
    const p = page([rect('a', 0, 0, { layer: 'open' }), rect('b', 0, 0, { layer: 'locked' }), rect('c', 0, 0, { layer: 'hidden' })], {
      layers: [{ id: 'open', name: 'Open' }, { id: 'locked', name: 'Locked', locked: true }, { id: 'hidden', name: 'Hidden', hidden: true }],
    });
    expect(Array.from(untouchable(p)).sort()).toEqual(['b', 'c']);
  });
});
