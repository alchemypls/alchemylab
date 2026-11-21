"use client";

import { useRef, useState } from 'react';
import { useWorkbenchStore } from '@/lib/store';
import { GROUP, containerCols, descendants, isGroup, layoutEdit, pageCol, parentOf, placedAt, reparented, roomFor, type PagePlacement, type PlacementGeom } from '@/lib/project';
import { cellBox, colIn, groupTracks, measureTracks, nearestCol, nearestRow, rowIn, type Tracks } from './PageGrid';
import { TIER_COLUMNS, type Tier } from '@/lib/devices';

// The layout editor's pointer work, apart from how blocks draw: where a pointer is on the page grid, which container
// (the page or a group) it's over, placing a block there, and a drag that moves or resizes one. A drag measures its
// container's tracks when it starts or enters one (rows don't shift under it), and on release applies the edit in one
// store update: blocks in the way move down (layoutEdit / roomFor), a move into or out of a group re-parents it.

// A new placement at (col, row) in a container of `cols` columns on this tier (`baseCols` on mobile). On a wider tier
// the mobile base is a full-width row at the same height, and what you placed is that tier's own. A group starts
// as wide as its container and a few rows tall; a component half as wide, two rows (80px, it grows with its content).
export function newPlacement(componentId: string, tier: Tier, col: number, row: number, cols = TIER_COLUMNS[tier], baseCols = TIER_COLUMNS.mobile, parent?: string): PagePlacement {
  const group = componentId === GROUP, colSpan = group ? cols : Math.max(1, Math.round(cols / 2)), rowSpan = group ? 6 : 2;
  const here = { col: Math.min(cols - colSpan, Math.max(0, col)), row: Math.max(0, row), colSpan, rowSpan };
  const id = `pl-${Date.now().toString(36)}`, what = group ? { kind: 'group' as const } : { componentId }, inside = parent ? { parent } : {};
  return tier === 'mobile' ? { id, ...what, ...inside, ...here }
    : { id, ...what, ...inside, col: 0, row: here.row, colSpan: baseCols, rowSpan, at: { [tier]: here } };
}

// A drag in progress, in grid px against the tracks measured when it started or when it entered a container (so rows
// don't shift under it): the block follows the pointer freely (`size`); `to` is where it lands (the ghost) in `into`
type Drag = {
  id: string; kind: 'move' | Dir; grab: { x: number; y: number }; at: { x: number; y: number }; size: { w: number; h: number };
  from: PlacementGeom; to: PlacementGeom; tracks: Tracks; home: string | null; into: string | null; groups: GroupBox[];
};
type GroupBox = { id: string; r: DOMRect; depth: number };
type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const DIRS: Dir[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

export function useLayoutDrag({ pid, path, placements, tier, select, editing, placing }: {
  pid: string; path: string; placements: PagePlacement[]; tier: Tier;
  select: (id: string | null) => void; editing: boolean; placing: string | null;
}) {
  const addPlacement    = useWorkbenchStore((s) => s.addPlacement);
  const putPlacement    = useWorkbenchStore((s) => s.putPlacement);
  const setGeoms        = useWorkbenchStore((s) => s.setPlacementGeoms);
  const grid = useRef<HTMLDivElement>(null), groupEls = useRef(new Map<string, HTMLDivElement>());
  const [drag, setDrag] = useState<Drag | null>(null);

  // A pointer in grid px (the sheet is scaled on screen)
  const zoom = () => { const el = grid.current!; return el.getBoundingClientRect().width / (el.offsetWidth || 1); };
  const at = (e: { clientX: number; clientY: number }) => {
    const r = grid.current!.getBoundingClientRect(), k = zoom();
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };
  // A container's tracks: the page's, or a group's (the page's columns it spans, its own rows)
  const tracksFor = (parent: string | null): Tracks => {
    const page = measureTracks(grid.current!), el = parent ? groupEls.current.get(parent) : undefined;
    return parent && el ? groupTracks(page, grid.current!, el, pageCol(placements, parent, tier), containerCols(placements, parent, tier), zoom()) : page;
  };
  // The groups a pointer can land in (not `skip` or anything in it), with their boxes on screen and how deep they sit,
  // innermost first: read once when a drag or a placing starts, since nothing moves under the pointer meanwhile
  const groupBoxes = (skip?: string): GroupBox[] => {
    const out = skip ? descendants(placements, skip).add(skip) : new Set<string>();
    const depth = (p: PagePlacement) => { let d = 0; for (let up = parentOf(placements, p); up && d < 16; up = parentOf(placements, placements.find((x) => x.id === up)!)) d++; return d; };
    return placements.flatMap((p) => {
      const el = groupEls.current.get(p.id);
      return isGroup(p) && !out.has(p.id) && el ? [{ id: p.id, r: el.getBoundingClientRect(), depth: depth(p) }] : [];
    }).sort((a, b) => b.depth - a.depth);
  };
  // The innermost of them under the pointer, or null for the page
  const groupAt = (e: { clientX: number; clientY: number }, boxes: GroupBox[]): string | null =>
    boxes.find(({ r }) => e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)?.id ?? null;
  const place = (componentId: string, e: { clientX: number; clientY: number }) => {
    const into = groupAt(e, groupBoxes()), t = tracksFor(into), p = at(e);
    const pl = newPlacement(componentId, tier, colIn(t, p.x), rowIn(t, p.y), containerCols(placements, into, tier), containerCols(placements, into, 'mobile'), into ?? undefined);
    addPlacement(pid, path, pl, { tier, edits: roomFor(placements, tier, pl) });   // what it lands on moves down, in the same update
    select(pl.id);
  };

  const start = (e: React.PointerEvent, p: PagePlacement, kind: Drag['kind']) => {
    if (!editing || placing || e.button !== 0) return;   // placing: the click goes to the page (it may land inside a group)
    e.stopPropagation();
    e.preventDefault();   // no text selection: a selected label gets dragged as text by the next press, which cancels the pointer
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const home = parentOf(placements, p), g = placedAt(placements, p, tier), tracks = tracksFor(home), q = at(e), box = cellBox(tracks, g);
    select(p.id);
    setDrag({ id: p.id, kind, grab: { x: q.x - box.x, y: q.y - box.y }, at: q, size: { w: box.w, h: box.h }, from: g, to: g, tracks, home, into: home, groups: kind === 'move' ? groupBoxes(p.id) : [] });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const q = at(e), g = drag.from;
    let d = drag, to: PlacementGeom;
    if (d.kind === 'move') {
      const into = groupAt(e, d.groups);   // the container under the pointer: its tracks, measured once on the way in
      if (into !== d.into) d = { ...d, into, tracks: tracksFor(into) };
      const n = containerCols(placements, d.into, tier), colSpan = Math.min(g.colSpan, n);
      to = { ...g, colSpan, col: Math.min(n - colSpan, nearestCol(d.tracks, q.x - d.grab.x)), row: nearestRow(d.tracks, q.y - d.grab.y) };
    } else {
      const t = d.tracks, k = d.kind;
      let c0 = g.col, c1 = g.col + g.colSpan - 1, r0 = g.row, r1 = g.row + g.rowSpan - 1;
      if (k.includes('e')) c1 = Math.max(c0, nearestCol(t, q.x, true));
      if (k.includes('w')) c0 = Math.min(c1, nearestCol(t, q.x));
      if (k.includes('s')) r1 = Math.max(r0, nearestRow(t, q.y, true));
      if (k.includes('n')) r0 = Math.min(r1, nearestRow(t, q.y));
      to = { ...g, col: c0, colSpan: c1 - c0 + 1, row: r0, rowSpan: r1 - r0 + 1 };
    }
    setDrag({ ...d, at: q, to });
  };
  const end = () => {
    if (!drag) return;
    const { col, row, colSpan, rowSpan } = drag.to, p = placements.find((x) => x.id === drag.id);
    if (p && drag.into !== drag.home) {   // into a group, or out of one: it moves there, and what it lands on there moves down
      const moved = reparented(placements, p, drag.into, tier, { col, row, colSpan, rowSpan });
      putPlacement(pid, path, moved, { tier, edits: roomFor(placements.map((x) => (x.id === p.id ? moved : x)), tier, moved) });
    } else {
      const edits = layoutEdit(placements, tier, drag.id, { col, row, colSpan, rowSpan });
      if (edits.length) setGeoms(pid, path, tier, edits);
    }
    setDrag(null);
  };

  return { grid, groupEls, drag, cancel: () => setDrag(null), place, start, move, end };
}
