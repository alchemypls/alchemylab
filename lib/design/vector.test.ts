// Edit ops every tool goes through. They break quietly: a wrong reference still draws, until something moves.
import { describe, expect, it } from 'vitest';
import type { DesignPage } from './types';
import { untouchable } from './layers';
import { carve } from './carve';
import {
  copyElements, duplicateElements, groupElements, lineEnds, pasteElements, removeElements, rubArea, tenants, withGroups,
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

describe('the line eraser', () => {
  const band = [{ x: 0, y: 20 }, { x: 200, y: 20 }, { x: 200, y: 30 }, { x: 0, y: 30 }];
  it('cuts pen strokes across the band and marks the shapes it crosses, in their own box', () => {
    const p = page([rect('a', 10, 0), rect('far', 10, 300), { id: 's', type: 'stroke', points: [[50, 0], [50, 60]] }]);
    const next = rubArea(p, band, undefined, true);
    expect(el(next, 'a').erased).toEqual([{ pts: [-10, 20, 190, 20, 190, 30, -10, 30], size: 0, area: true }]);
    expect(el(next, 'far').erased).toBeUndefined();
    expect(next.elements!.filter((e) => e.type === 'stroke')).toHaveLength(2);   // one above the band, one below
  });
  it('leaves shapes alone where only ink may be cut (Ideation) and on locked layers', () => {
    const p = page([rect('a', 10, 0), rect('b', 10, 0)]);
    expect(rubArea(p, band, undefined, false)).toBe(p);
    expect(el(rubArea(p, band, new Set(['b']), true), 'b').erased).toBeUndefined();
  });
});

describe('erasing cuts the shape (Fab)', () => {
  const band = (y0: number, y1: number) => ({ pts: [-10, y0, 110, y0, 110, y1, -10, y1], size: 0, area: true });
  const sq = (more: Partial<VRect> = {}): VRect => rect('s', 0, 0, { w: 100, h: 100, ...more });
  it('a band across splits it in two polygons, the first keeping its id', () => {
    const out = carve(sq({ erased: [band(40, 60)] }), []);
    expect(out.map((e) => [e.type, (e as VRect).y, (e as VRect).h])).toEqual([['poly', 0, 40], ['poly', 60, 40]]);
    expect(out[0].id).toBe('s');
    expect(out.every((e) => !e.erased)).toBe(true);
  });
  it('a hole inside stays a mark, a full rub removes it', () => {
    const hole = carve(sq({ erased: [{ pts: [40, 40, 60, 40, 60, 60, 40, 60], size: 0, area: true }] }), []);
    expect(hole).toHaveLength(1);
    expect(hole[0].erased?.[0].area).toBe(true);
    expect(carve(sq({ erased: [band(-10, 110)] }), [])).toEqual([]);
  });
  it('on the floor, what is left draws where it was', () => {
    const [left] = carve(sq({ plane: 'floor', erased: [band(-10, 50)] }), []);
    expect([(left as VRect).x, (left as VRect).y, (left as VRect).h]).toEqual([-50, 25, 50]);   // its new corner: 50 down the rows
  });
});
