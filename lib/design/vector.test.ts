import { describe, expect, it } from 'vitest';
import type { DesignPage } from './types';
import {
  boundsOf, copyElements, dragDelta, duplicateElements, fromGrid, groupElements, lineEnds, pasteElements, removeElements,
  snapAngle, tenants, toGrid, translateElements, ungroupElements, visualBounds, withGroups,
  type VElement, type VLine, type VRect, type VZone,
} from './vector';

// Small pages built by hand: a floor with a piece on it, a box, an arrow between them
const rect = (id: string, x: number, y: number, w = 40, h = 40, more: Partial<VRect> = {}): VRect => ({ id, type: 'rect', x, y, w, h, ...more });
const zone = (id: string, x: number, y: number, cols = 4, rows = 4, more: Partial<VZone> = {}): VZone => ({ id, type: 'zone', x, y, cols, rows, cell: 32, ...more });
const arrow = (id: string, from: VLine['from'], to: VLine['to']): VLine => ({ id, type: 'line', from, to });
const page = (elements: VElement[], more: Partial<DesignPage> = {}): DesignPage => ({ title: 't', blocks: [], elements, ...more });
const byId = (p: DesignPage, id: string) => p.elements!.find((e) => e.id === id)!;

describe('grid', () => {
  it('turns tile coordinates into page points and back (isometric and flat)', () => {
    for (const flat of [false, true]) {
      const g = { cell: 32, flat };
      for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) {
        const back = toGrid(g, fromGrid(g, { a, b }));
        expect(back.a).toBeCloseTo(a);
        expect(back.b).toBeCloseTo(b);
      }
    }
  });

  it('puts isometric corners where the reference says: x = (a - b) * cell, y = (a + b) * cell / 2', () => {
    expect(fromGrid({ cell: 32 }, { a: 3, b: 1 })).toEqual({ x: 64, y: 64 });
  });

  it('snaps angles near a multiple of 45, and always lands in 0–359', () => {
    expect(snapAngle(44)).toBe(45);
    expect(snapAngle(-90)).toBe(270);
    expect(snapAngle(725)).toBe(5);
    expect(snapAngle(37, 15)).toBe(30);
  });
});

describe('moving', () => {
  it('moves boxes, strokes and loose line ends, and leaves attached ends to follow their shape', () => {
    const p = page([rect('a', 0, 0), { id: 's', type: 'stroke', points: [[0, 0], [10, 10]] }, arrow('l', { x: 0, y: 0 }, { el: 'a' })]);
    const next = translateElements(p, p.elements!, ['a', 's', 'l'], 5, 7);
    expect(byId(next, 'a')).toMatchObject({ x: 5, y: 7 });
    expect((byId(next, 's') as { points: number[][] }).points).toEqual([[5, 7], [15, 17]]);
    expect((byId(next, 'l') as VLine).from).toEqual({ x: 5, y: 7 });
    expect((byId(next, 'l') as VLine).to).toEqual({ el: 'a' });
  });

  it('measures from the snapshot, so a long drag never piles up rounding', () => {
    const p = page([rect('a', 10, 10)]);
    let cur = p;
    for (let i = 1; i <= 50; i++) cur = translateElements(cur, p.elements!, ['a'], i * 0.3, 0);
    expect(byId(cur, 'a')).toMatchObject({ x: 25 });
  });

  it('snaps a dragged floor to whole tiles of the page grid', () => {
    const p = page([zone('z', 0, 0)], { grid: { cell: 32 } });
    const d = dragDelta(p, p.elements!, ['z'], 70, 20);
    const t = toGrid({ cell: 32 }, d);
    expect(Number.isInteger(Math.round(t.a * 1e6) / 1e6)).toBe(true);
    expect(Number.isInteger(Math.round(t.b * 1e6) / 1e6)).toBe(true);
  });

  it('finds the pieces standing on a floor, so they travel with it', () => {
    const z = zone('z', 0, 0, 4, 4, { flat: true });   // tiles 0..128 each way
    const on = rect('on', 40, 40), off = rect('off', 400, 400);
    expect(tenants([z, on, off], ['z'])).toEqual(['on']);
  });
});

describe('bounds and lines', () => {
  it('measures a turned box by its turned outline', () => {
    const r = rect('r', 0, 0, 100, 20, { rotate: 90 });
    const b = visualBounds(r, [r]);
    expect(b.w).toBeCloseTo(20);
    expect(b.h).toBeCloseTo(100);
  });

  it('stops an attached arrow at the edge of its shape, not its center', () => {
    const a = rect('a', 0, 0, 100, 100), b = rect('b', 300, 0, 100, 100);
    const [from, to] = lineEnds(arrow('l', { el: 'a' }, { el: 'b' }), [a, b]);
    expect(from.x).toBeGreaterThan(100);
    expect(to.x).toBeLessThan(300);
    expect(from.y).toBeCloseTo(50);
  });

  it('pins an arrow where it was when the shape it pointed at is deleted', () => {
    const p = page([rect('a', 0, 0, 100, 100), rect('b', 300, 0, 100, 100), arrow('l', { el: 'a' }, { el: 'b' })]);
    const before = lineEnds(byId(p, 'l') as VLine, p.elements!);
    const next = removeElements(p, ['b']);
    const l = byId(next, 'l') as VLine;
    expect(l.from).toEqual({ el: 'a' });
    expect(l.to).toEqual(before[1]);
  });

  it('measures a floor by its diamond corners', () => {
    expect(boundsOf(zone('z', 0, 0, 2, 2), [])).toEqual({ x: -64, y: 0, w: 128, h: 64 });
  });
});

describe('duplicate', () => {
  it('gives copies new ids and keeps arrows between copies attached to the copies', () => {
    const p = page([rect('a', 0, 0), rect('b', 200, 0), arrow('l', { el: 'a' }, { el: 'b' })]);
    const r = duplicateElements(p, ['a', 'b', 'l']);
    expect(r.ids).toHaveLength(3);
    expect(r.ids.some((id) => ['a', 'b', 'l'].includes(id))).toBe(false);
    const l = r.page.elements!.find((e) => e.id === r.ids[2]) as VLine;
    expect(l.from).toEqual({ el: r.ids[0] });
    expect(l.to).toEqual({ el: r.ids[1] });
  });

  it('makes a duplicated group its own group, not welded to the original', () => {
    const p = groupElements(page([rect('a', 0, 0), rect('b', 50, 0)]), ['a', 'b']);
    const r = duplicateElements(p, ['a', 'b']);
    expect(withGroups(r.page.elements!, ['a']).sort()).toEqual(['a', 'b']);
    expect(withGroups(r.page.elements!, [r.ids[0]]).sort()).toEqual([...r.ids].sort());
  });

  it('keeps a lane painted on a duplicated floor painted on the copy', () => {
    const p = page([zone('z', 0, 0), { ...rect('lane', 10, 10), on: 'z' }]);
    const r = duplicateElements(p, ['z', 'lane']);
    const lane = r.page.elements!.find((e) => e.id === r.ids[1])!;
    expect(lane.on).toBe(r.ids[0]);
  });
});

describe('groups', () => {
  it('picks the whole group from any member, and nothing more', () => {
    const p = groupElements(page([rect('a', 0, 0), rect('b', 50, 0), rect('c', 100, 0)]), ['a', 'b']);
    expect(withGroups(p.elements!, ['b']).sort()).toEqual(['a', 'b']);
    expect(withGroups(p.elements!, ['c'])).toEqual(['c']);
  });

  it('ungroups back to single elements', () => {
    const p = ungroupElements(groupElements(page([rect('a', 0, 0), rect('b', 50, 0)]), ['a', 'b']), ['a', 'b']);
    expect(p.elements!.some((e) => e.group)).toBe(false);
  });
});

describe('copy and paste', () => {
  const source = page([zone('floor', 0, 0), { ...rect('piece', 10, 10), on: 'floor', layer: 'table' }, rect('box', 600, 0), arrow('l', { el: 'piece' }, { el: 'box' })], {
    layers: [{ id: 'layer-1', name: 'Layer 1' }, { id: 'table', name: 'Table' }],
  });

  it('pins line ends that pointed at something not copied', () => {
    const clip = copyElements(source, ['piece', 'l']);
    const l = clip.elements.find((e) => e.id === 'l') as VLine;
    expect(l.from).toEqual({ el: 'piece' });
    expect('x' in l.to).toBe(true);
  });

  it('pastes on another page with new ids, its layers brought along, references kept among the copies', () => {
    const target = page([rect('mine', 0, 0)]);
    const r = pasteElements(target, copyElements(source, ['floor', 'piece']));
    expect(r.page.layers?.map((l) => l.id)).toEqual(['layer-1', 'table']);
    const [floor, piece] = r.ids.map((id) => r.page.elements!.find((e) => e.id === id)!);
    expect(piece.on).toBe(floor.id);
    expect(piece.layer).toBe('table');
    expect(byId(r.page, 'mine')).toBeTruthy();
  });

  it('steps aside on the page it came from, and keeps its place on another page when it fits', () => {
    const clip = copyElements(source, ['box']);
    const same = pasteElements(source, clip), other = pasteElements(page([]), clip);
    expect(same.page.elements!.find((e) => e.id === same.ids[0])).toMatchObject({ x: 624, y: 24 });
    expect(other.page.elements!.find((e) => e.id === other.ids[0])).toMatchObject({ x: 600, y: 0 });
  });

  it('moves a copy that would hang off the page back inside it, in whole grid steps', () => {
    const big = page([rect('r', 1900, 1060, 100, 100)]);
    const r = pasteElements(page([], { size: { width: 1920, height: 1080 }, grid: { cell: 32, flat: true } }), copyElements(big, ['r']));
    const el = r.page.elements![0] as VRect;
    expect(el.x + el.w).toBeLessThanOrEqual(1920);
    expect(el.y + el.h).toBeLessThanOrEqual(1080);
    expect((1900 - el.x) % 32).toBe(0);
  });
});
