// Every registered action and effect, run on a page with one of everything: the page must still validate. New
// entries are covered by being listed; nothing to add here for them.
import { describe, expect, it } from 'vitest';
import { ACTIONS, matchKeys } from './actions';
import { FX, newFx, filterSteps } from './fx';
import { flipElements, quarterTurn } from './transform';
import type { DesignPage } from './types';
import { validatePage } from './validate';
import { shapeOutline, visualBounds, type VElement } from './vector';

const ALL: VElement[] = [
  { id: 'r', type: 'rect', x: 100, y: 100, w: 80, h: 40, rotate: 30, fill: '#fff', erased: [{ pts: [10, 5, 20, 5], size: 6 }] },
  { id: 'e', type: 'ellipse', x: 300, y: 100, w: 60, h: 60, lobes: 9 },
  { id: 'c', type: 'capsule', x: 400, y: 300, w: 120, h: 40, taper: 0.5 },
  { id: 'p', type: 'poly', x: 50, y: 300, w: 100, h: 80, pts: [[0, 0], [1, 0.2], [0.4, 1]] },
  { id: 'f', type: 'rect', x: 0, y: 0, w: 64, h: 64, plane: 'floor', height: 32, fill: '#888' },
  { id: 'rw', type: 'poly', x: 300, y: 520, w: 90, h: 60, pts: [[0, 0], [1, 0.3], [0.2, 1]], plane: 'roof', lift: 48, slope: 0.2, walls: true, fill: '#ccc' },
  { id: 'l', type: 'line', from: { x: 10, y: 10 }, to: { el: 'r' }, bend: 20 },
  { id: 't', type: 'text', x: 600, y: 50, w: 200, h: 40, text: 'hi' },
  { id: 's', type: 'stroke', points: [[5, 5], [50, 60]] },
  { id: 'd', type: 'status', x: 700, y: 400, topic: 'x' },
  { id: 'fp', type: 'poly', x: 200, y: 500, w: 90, h: 60, pts: [[0, 0], [1, 0.3], [0.2, 1]], plane: 'floor', erased: [{ pts: [10, 5, 20, 8], size: 6 }] },
  { id: 'rf', type: 'rect', x: 300, y: 500, w: 96, h: 64, plane: 'roof', slope: 0.3, lift: 40 },
  { id: 'z', type: 'zone', x: 800, y: 600, cols: 2, rows: 2, cell: 32 },
];
const page: DesignPage = { title: 't', blocks: [], elements: ALL };
const ids = ALL.map((e) => e.id);
const ok = (p: DesignPage) => expect(validatePage(p).errors).toEqual([]);

describe('every action', () => {
  for (const a of ACTIONS) it(a.id, () => {
    const c = { page, ids, clip: { elements: [ALL[0]], layers: [] }, selectable: ids };
    if (a.when && !a.when(c)) return;
    const r = a.run(c);
    if (r.page) ok(r.page);
  });
  it('keys match', () => {
    const e = { key: 'H', ctrlKey: false, metaKey: false, shiftKey: true, altKey: false };
    expect(matchKeys('Shift+H', e)).toBe(true);
    expect(matchKeys('Ctrl+Shift+G', { ...e, key: 'g', ctrlKey: true })).toBe(true);
    expect(matchKeys('Shift+H', { ...e, shiftKey: false })).toBe(false);
  });
});

describe('flip and turn', () => {
  it('flipping twice gives the page back', () => {
    for (const ax of ['x', 'y'] as const) {
      const back = flipElements(flipElements(page, ids, ax), ids, ax).elements!;
      back.forEach((e, i) => expect([ax, JSON.parse(JSON.stringify(e))]).toEqual([ax, JSON.parse(JSON.stringify(ALL[i]))]));
    }
  });
  it('a shape lying on the floor turns and flips in place (it used to stay as it was)', () => {
    const at = (p: DesignPage, id: string) => p.elements!.find((e) => e.id === id)!;
    const mid = (e: VElement) => { const b = visualBounds(e, []); return [Math.round(b.x + b.w / 2), Math.round(b.y + b.h / 2)]; };
    const turned = at(quarterTurn(page, ['fp'], 1), 'fp');
    expect(turned).not.toEqual(at(page, 'fp'));
    expect(mid(turned)).toEqual(mid(at(page, 'fp')));
    const cap: VElement = { id: 'fc', type: 'capsule', x: 0, y: 0, w: 120, h: 40, taper: 0.5, plane: 'floor' };
    const p2: DesignPage = { ...page, elements: [cap] };
    expect(at(flipElements(p2, ['fc'], 'x'), 'fc').type).toBe('poly');
    expect(at(quarterTurn(p2, ['fc'], -1), 'fc').type).toBe('poly');
  });
  it('four quarter turns give the page back', () => {
    let p = page; for (let i = 0; i < 4; i++) p = quarterTurn(p, ids, 1);
    const near = (v: unknown): unknown => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : Array.isArray(v) ? v.map(near) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, near(x)])) : v);
    expect(near(p.elements)).toEqual(near(page.elements));
  });
});

describe('every effect', () => {
  for (const d of FX) it(d.kind, () => {
    const els = ALL.map((e) => (d.on.includes(e.type) ? { ...e, fx: [newFx(d)] } : e));
    ok({ ...page, elements: els });
    for (const e of els) if (e.fx) {
      if (d.shape && e.type !== 'line' && e.type !== 'text' && e.type !== 'stroke' && e.type !== 'image' && e.type !== 'asset')
        expect(shapeOutline(e).every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))).toBe(true);
      if (d.filter) expect(filterSteps(e).length).toBe(1);
    }
  });
  it('a retired or unknown effect is caught', () => {
    expect(validatePage({ ...page, elements: [{ ...ALL[0], fx: [{ kind: 'nope' }] }] }).errors.length).toBe(1);
  });
});
