import { describe, expect, it } from 'vitest';
import { newAsset, partGuides, PARTS } from './vault';
import { validateAsset } from './validate';

describe('parts', () => {
  it('a new file of every part validates', () => {
    for (const p of PARTS) expect([p, validateAsset(newAsset('block', p, 'x', p)).errors]).toEqual([p, []]);
  });
  it('a new wall starts with its faces on its guides', () => {
    const w = newAsset('block', 'w', 'x', 'wall'), [left, right] = partGuides(w);
    const tl = (e: unknown) => { const r = e as { x: number; y: number }; return { x: r.x, y: r.y }; };
    expect(tl(w.elements!.find((e) => e.layer === 'faces' && (e as { plane?: string }).plane === 'left'))).toEqual(left.pts[3]);
    expect(tl(w.elements!.find((e) => e.layer === 'faces' && (e as { plane?: string }).plane === 'right'))).toEqual(right.pts[3]);
  });
  it('guards: a part only on a block, atoms on one tile, a wall height only on a wall', () => {
    const wall = newAsset('block', 'w', 'x', 'wall');
    expect(validateAsset({ ...newAsset('shape', 's', 'x'), part: 'wall' }).errors.length).toBe(1);
    expect(validateAsset({ ...wall, footprint: { cols: 2, rows: 1 } }).errors.length).toBe(1);
    expect(validateAsset({ ...wall, wall: { h: 0 } }).errors.length).toBe(1);
    expect(validateAsset({ ...newAsset('block', 'f', 'x', 'floor'), wall: { h: 2 } }).errors.length).toBe(1);
  });
});

describe('structures', () => {
  it('build from atoms: a wall drag, a room, floors; edits stay inside the footprint', async () => {
    const { paintFloors, paintWalls, wallEdges, fitFootprint, composeStructure, addLevel, removeLevel } = await import('./structure');
    expect(wallEdges({ a: 0, b: 2 }, { a: 3, b: 2 })).toEqual(['0,2,a', '1,2,a', '2,2,a']);
    expect(wallEdges({ a: 1, b: 1 }, { a: 2, b: 3 }, true).sort()).toEqual(['1,1,a', '1,1,b', '1,2,b', '1,3,a', '2,1,b', '2,2,b'].sort());
    let st = newAsset('block', 's', 'x', 'structure'), s = st.structure!;
    s = paintWalls(paintFloors(s, 0, { a0: 0, b0: 0, a1: 5, b1: 5 }, 'f'), 0, wallEdges({ a: 0, b: 0 }, { a: 6, b: 6 }, true), 'w');
    expect(validateAsset({ ...st, structure: s }).errors).toEqual([]);
    const small = fitFootprint(s, 2, 2).levels[0];
    expect(Object.keys(small.floors!).length).toBe(4);
    expect(Object.keys(small.walls!).sort()).toEqual(['0,0,a', '0,0,b', '1,0,a', '0,1,b'].sort());
    const atoms: Record<string, ReturnType<typeof newAsset>> = { f: newAsset('block', 'f', 'x', 'floor'), w: newAsset('block', 'w', 'x', 'wall') };
    st = { ...st, structure: s };
    const els = composeStructure(st, (id) => atoms[id]);
    expect(els.filter((e) => e.id.startsWith('L0f')).length).toBe(36);   // a tile per floor
    expect(els.some((e) => e.id.startsWith('L0w'))).toBe(true);           // the walls, as one solid
    expect(new Set(els.map((e) => e.id)).size).toBe(els.length);
    expect(removeLevel(addLevel(s), 1)).toEqual(s);
    expect(validateAsset({ ...st, structure: { levels: [] } }).errors.length).toBe(1);
    expect(validateAsset({ ...st, structure: { levels: [{ h: 3, walls: { '0,0': 'w' } }] } }).errors.length).toBe(1);
  });
});

describe('joints and rooms', () => {
  it('walls meeting at a corner pick its state; two in a line need none', async () => {
    const { jointsOf, paintWalls, wallEdges, newStructure } = await import('./structure');
    let s = paintWalls(newStructure(), 0, wallEdges({ a: 0, b: 0 }, { a: 4, b: 0 }), 'w');   // a line: ends at both tips
    s = paintWalls(s, 0, wallEdges({ a: 2, b: 0 }, { a: 2, b: 3 }), 'w');                  // a tee in the middle, an end below
    const at = (a: number, b: number) => jointsOf(s.levels[0]).find((j) => j.a === a && j.b === b)?.state;
    expect([at(0, 0), at(4, 0), at(2, 0), at(2, 3), at(1, 0)]).toEqual(['end', 'end', 'tee', 'end', undefined]);
    s = paintWalls(s, 0, wallEdges({ a: 2, b: 3 }, { a: 5, b: 3 }), 'w');
    expect(at(2, 3)).toBe('corner');
  });
  it('a closed loop is a room, a gap opens it; a new room comes floored', async () => {
    const { roomsOf, paintWalls, wallEdges, newStructure, floorNewRooms } = await import('./structure');
    const s0 = newStructure(), room = paintWalls(s0, 0, wallEdges({ a: 1, b: 1 }, { a: 3, b: 3 }, true), 'w');
    expect(roomsOf(room.levels[0], 6, 6)).toEqual([['1,1', '1,2', '2,1', '2,2']]);
    expect(roomsOf(paintWalls(room, 0, ['1,1,a'], null).levels[0], 6, 6)).toEqual([]);
    expect(Object.keys(floorNewRooms(s0, room, 0, 6, 6, 'f').levels[0].floors ?? {}).length).toBe(4);
    expect(floorNewRooms(room, room, 0, 6, 6, 'f')).toBe(room);
  });
});

describe('select', () => {
  it('picks what is under the pointer, moves it by whole tiles inside the footprint, swaps and removes', async () => {
    const S = await import('./structure');
    let s = S.paintFloors(S.newStructure(), 0, { a0: 0, b0: 0, a1: 1, b1: 1 }, 'f');
    s = S.paintWalls(s, 0, S.wallEdges({ a: 0, b: 0 }, { a: 2, b: 0 }), 'w');
    s = S.placeObject(s, 0, 'o', 1, 1);
    const atomOf = () => undefined, l = s.levels[0];
    expect(S.pieceAt(l, { a: 0.5, b: 0.05 }, atomOf)).toEqual({ kind: 'wall', key: '0,0,a' });
    expect(S.pieceAt(l, { a: 1.5, b: 1.5 }, atomOf)).toEqual({ kind: 'object', key: '0' });
    expect(S.pieceAt(l, { a: 0.5, b: 1.5 }, atomOf)).toEqual({ kind: 'floor', key: '0,1' });
    expect(S.piecesIn(l, { a0: 0, b0: 0, a1: 0, b1: 0 }).map(S.pieceId).sort()).toEqual(['floor:0,0', 'wall:0,0,a']);
    const sel = [{ kind: 'wall' as const, key: '0,0,a' }, { kind: 'object' as const, key: '0' }];
    const m = S.movePieces(s, 0, sel, 9, 2, 6, 6, atomOf);   // as far as the footprint lets it go: the object to a = 5
    expect([m.da, m.db]).toEqual([4, 2]);
    expect(m.s.levels[0].walls).toEqual({ '4,2,a': 'w', '1,0,a': 'w' });
    expect(m.s.levels[0].objects).toEqual([{ asset: 'o', a: 5, b: 3 }]);
    expect(S.swapPieces(s, 0, sel, 'wall', 'w2').levels[0].walls).toEqual({ '0,0,a': 'w2', '1,0,a': 'w' });
    const gone = S.removePieces(s, 0, sel).levels[0];
    expect([gone.walls, gone.objects]).toEqual([{ '1,0,a': 'w' }, undefined]);
  });
});

describe('roofs', () => {
  it('heights: eaves at the walls\' top, a ridge or peak in the middle; every shape builds and validates', async () => {
    const S = await import('./structure'), R = await import('./roof');
    const r = { a0: 0, b0: 0, a1: 3, b1: 1, atom: 'r', shape: 'gable' as const, pitch: 0.5, over: 0 };   // 4 × 2 tiles, ridge along a
    const g = R.roofPlanes(r, 3);
    expect([g.z(2, 0), g.z(2, 1), g.z(2, 2)]).toEqual([3, 3.5, 3]);
    expect(R.roofPlanes({ ...r, shape: 'hip' }, 3).z(0, 1)).toBe(3);
    expect(R.roofPlanes({ ...r, shape: 'shed', flip: true }, 3).z(0, 1)).toBe(5);
    const atoms: Record<string, ReturnType<typeof newAsset>> = { r: newAsset('block', 'r', 'x', 'roof'), w: newAsset('block', 'w', 'x', 'wall') };
    for (const shape of R.ROOF_SHAPES) {
      let st = newAsset('block', 's', 'x', 'structure');
      const s = S.addRoof(S.paintWalls(st.structure!, 0, S.wallEdges({ a: 0, b: 0 }, { a: 4, b: 2 }, true), 'w'), 0, { ...r, shape });
      st = { ...st, structure: s };
      expect([shape, validateAsset(st).errors]).toEqual([shape, []]);
      const els = S.composeStructure(st, (id) => atoms[id]);
      expect(els.some((e) => e.id.startsWith('L0r0'))).toBe(true);
      expect(S.composeStructure(st, (id) => atoms[id], undefined, { roofs: false }).some((e) => e.id.startsWith('L0r0'))).toBe(false);
    }
    expect(validateAsset({ ...newAsset('block', 's', 'x', 'structure'), structure: { levels: [{ h: 3, roofs: [{ ...r, shape: 'dome' }] }] } }).errors.length).toBe(1);
  });
  it('picked and moved like any piece', async () => {
    const S = await import('./structure');
    const s = S.addRoof(S.newStructure(), 0, { a0: 1, b0: 1, a1: 2, b1: 2, atom: 'r', shape: 'hip' });
    expect(S.pieceAt(s.levels[0], { a: 0, b: 0 }, () => undefined, { a: 1.5, b: 2.5 })).toEqual({ kind: 'roof', key: '0' });
    const m = S.movePieces(s, 0, [{ kind: 'roof', key: '0' }], 1, 0, 6, 6, () => undefined);
    expect(m.s.levels[0].roofs![0]).toMatchObject({ a0: 2, a1: 3 });
    expect(S.setRoofs(s, 0, [{ kind: 'roof', key: '0' }], { shape: 'flat' }).levels[0].roofs![0].shape).toBe('flat');
  });
});

describe('wall views', () => {
  it('cut lowers the walls with a room behind them (front and inner), keeps the back ones; down lowers all', async () => {
    const S = await import('./structure');
    const l = S.paintWalls(S.newStructure(), 0, S.wallEdges({ a: 1, b: 1 }, { a: 3, b: 3 }, true), 'w').levels[0];
    expect(Array.from(S.loweredWalls(l, 'up', 6, 6))).toEqual([]);
    expect(Array.from(S.loweredWalls(l, 'cut', 6, 6)).sort()).toEqual(['1,3,a', '2,3,a', '3,1,b', '3,2,b']);   // the front two sides of the room
    expect(S.loweredWalls(l, 'down', 6, 6).size).toBe(8);
  });
});

describe('solid walls', () => {
  it('a straight run is one face (no seams between its tiles), corners join, lowered walls get their own top', async () => {
    const W = await import('./walls');
    const atom = newAsset('block', 'w', 'x', 'wall');
    const at = (a: number, b: number, z: number) => ({ x: (a - b) * 64, y: ((a + b) * 64) / 2 - z * 64 });
    const spec = (key: string, h = 3) => { const [a, b, d] = key.split(','); return { key, a: +a, b: +b, d: d as 'a' | 'b', atom, h }; };
    const faces = (ws: ReturnType<typeof spec>[]) => W.wallSolid(ws, 0, 64, at, 'w').flatMap((x) => x.els).filter((e) => e.type === 'poly' && e.id.startsWith('wf'));
    const run = faces(['0,0,a', '1,0,a', '2,0,a'].map((k) => spec(k)));
    // the front face cut at tile lines (3 tiles + the half-thickness slivers past each end), the free end's face (cut at
    // its tile line too), a cap per wall: one face along the run, nothing between its tiles but the cut
    expect(run.length).toBe(5 + 2 + 3);
    const corner = faces(['0,0,a', '0,0,b'].map((k) => spec(k)));
    expect(corner.length).toBeGreaterThan(0);
    const mixed = W.wallSolid([spec('0,0,a'), spec('1,0,a', 0.4)], 0, 64, at, 'w');
    const ys = new Set(mixed.flatMap((x) => x.els).filter((e) => e.type === 'line').flatMap((e) => { const l = e as { from: { y: number }; to: { y: number } }; return [l.from.y, l.to.y]; }));
    const r = (v: number) => Math.round(v * 10) / 10;
    expect([ys.has(r(at(1, 0, 3).y)), ys.has(r(at(2, 0.075, 0.4).y))]).toEqual([true, true]);   // the tall one's top, the low one's own
  });
});

describe('placing structures', () => {
  it('a quarter turn turns the data: tiles, walls (columns ↔ rows), objects, roofs; four give it back', async () => {
    const S = await import('./structure');
    let st = newAsset('block', 's', 'x', 'structure');
    let s = S.paintWalls(S.paintFloors(st.structure!, 0, { a0: 0, b0: 0, a1: 0, b1: 0 }, 'f'), 0, ['0,0,a', '0,0,b'], 'w');
    s = S.addRoof(S.placeObject(s, 0, 'o', 4, 0), 0, { a0: 0, b0: 0, a1: 2, b1: 1, atom: 'r', shape: 'shed', along: 'b' });
    st = { ...st, footprint: { cols: 6, rows: 4 }, structure: s };
    const q = S.turnStructure(st, 1), l = q.structure!.levels[0];
    expect(q.footprint).toEqual({ cols: 4, rows: 6 });
    expect(l.floors).toEqual({ '3,0': 'f' });                     // the top tile's corner goes to the right
    expect(Object.keys(l.walls!).sort()).toEqual(['3,0,a', '4,0,b']);
    expect(l.objects).toEqual([{ asset: 'o', a: 3, b: 4, turn: 90 }]);
    expect(l.roofs![0]).toMatchObject({ a0: 2, a1: 3, b0: 0, b1: 2, along: 'a', flip: true });   // rose along +rows: now falls along +columns
    expect(validateAsset(q).errors).toEqual([]);
    expect(S.turnStructure(st, 4)).toEqual(st);
    const back = S.turnStructure(S.turnStructure(st, 3), 1);
    expect([back.footprint, back.structure]).toEqual([st.footprint, st.structure]);
  });
  it('objects turn in place, kept inside', async () => {
    const S = await import('./structure');
    const big = newAsset('block', 'o', 'x', 'object'); big.footprint = { cols: 3, rows: 1 };
    const s = S.placeObject(S.newStructure(), 0, 'o', 3, 5);
    const t = S.turnObjects(s, 0, [{ kind: 'object', key: '0' }], 1, 6, 6, () => big).levels[0].objects![0];
    expect(t).toEqual({ asset: 'o', a: 3, b: 3, turn: 90 });   // 1 × 3 now: moved up to fit
  });
});

describe('wall strip', () => {
  it('a mark on the single shows on the first tile of each six, one across the strip on every tile', async () => {
    const { composeStructure, paintWalls, wallEdges } = await import('./structure');
    const w = newAsset('block', 'w', 'x', 'wall'), lf = w.elements![0] as unknown as { x: number; y: number };
    w.elements!.push({ id: 'dot', type: 'rect', layer: 'faces', plane: 'left', x: lf.x + 20, y: lf.y + 20, w: 10, h: 10, fill: '#000' } as never);
    w.elements!.push({ id: 'band', type: 'rect', layer: 'faces', plane: 'left', x: lf.x - 5 * 64, y: lf.y - 160 + 100, w: 384, h: 10, fill: '#000' } as never);
    let st = newAsset('block', 's', 'x', 'structure');
    st = { ...st, footprint: { cols: 8, rows: 2 }, structure: paintWalls(st.structure!, 0, wallEdges({ a: 0, b: 1 }, { a: 7, b: 1 }), 'w') };
    const els = composeStructure(st, () => w), on = (id: string) => els.filter((e) => e.id.endsWith(`:${id}`)).map((e) => e.id.match(/L0w(\d+),/)![1]).sort();
    expect(on('dot')).toEqual(['0', '6']);   // a run of 7 (a 0–6), counted from its near (+columns) end: 6, then 0
    expect(on('band')).toHaveLength(7);
  });
});

describe('floor patch', () => {
  it('the base tile on every tile, a mark on the single only on the near corner of each 6 × 6', async () => {
    const { composeStructure, paintFloors } = await import('./structure');
    const { blockFloor } = await import('./vault');
    const f = newAsset('block', 'f', 'x', 'floor'), { corners: [c0] } = blockFloor(f);
    f.elements!.push({ id: 'dot', type: 'rect', layer: 'base', plane: 'floor', x: c0.x, y: c0.y + 32, w: 16, h: 16, fill: '#000' } as never);
    let st = newAsset('block', 's', 'x', 'structure');
    st = { ...st, footprint: { cols: 7, rows: 1 }, structure: paintFloors(st.structure!, 0, { a0: 0, b0: 0, a1: 6, b1: 0 }, 'f') };
    const els = composeStructure(st, () => f), on = (id: string) => els.filter((e) => e.id.endsWith(`:${id}`)).map((e) => e.id.match(/L0f(\d+),/)![1]).sort();
    expect(on(f.elements![0].id)).toHaveLength(7);
    expect(on('dot')).toEqual(['0', '6']);
  });
});
