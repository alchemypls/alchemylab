"use client";

import { forwardRef, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { GRID_GAP, ROW_HEIGHT, boundedMax, isGroup, type Insets, type PagePlacement, type PlacementGeom } from '@/lib/project';

// The page's grid as the export builds it (generator/page.ts): main with the kept-clear edges and side margins, a CSS
// grid of the tier's columns, rows at least ROW_HEIGHT that grow to their content, GRID_GAP gutters. The Layout and
// Preview layers both draw into it, so a block's size on the canvas is its size in Live.

export const mainStyle = (ins: Insets): CSSProperties => ({
  maxWidth: 1440, margin: '0 auto', boxSizing: 'border-box', containerType: 'inline-size',
  padding: `${ins.top}px ${GRID_GAP + ins.right}px ${ins.bottom}px ${GRID_GAP + ins.left}px`,
});

// A cell as the export places it; a bounded one scrolls inside, screen-high
// A group is a grid itself: its container's columns (subgrid), its own rows
// (`top`: its row on the page's grid, for that cap; inside a group, pageRow)
export const cellStyle = (p: PagePlacement, g: PlacementGeom, ins: Insets, top = g.row): CSSProperties => ({
  gridColumn: `${g.col + 1} / span ${g.colSpan}`, gridRow: `${g.row + 1} / span ${g.rowSpan}`, position: 'relative',
  ...(isGroup(p) && { display: 'grid', gridTemplateColumns: 'subgrid', gridAutoRows: `minmax(${ROW_HEIGHT}px, auto)`, rowGap: GRID_GAP, alignContent: 'start' }),
  ...(p.bounded && { maxHeight: boundedMax(top, ins, GRID_GAP), overflowY: 'auto', overscrollBehavior: 'contain', alignSelf: 'start' }),
});

// The same cell on the Layout layer: as big, but never a scroll container. It only holds the invisible sizer, and a
// scrolling cell would gain scrollbars from the handles hanging past its edges, which reflow it, which drop them… (a loop)
export const planCellStyle = (p: PagePlacement, g: PlacementGeom, ins: Insets, top = g.row): CSSProperties => ({ ...cellStyle(p, g, ins, top), overflowY: 'visible', overflow: 'visible' });

// Faint column bands behind the grid, gutters left clear
const columnBands = (cols: number): CSSProperties => {
  const w = `calc((100% - ${(cols - 1) * GRID_GAP}px) / ${cols})`, band = 'rgb(99 102 241 / 0.07)';
  return { backgroundImage: `repeating-linear-gradient(to right, ${band} 0 ${w}, transparent ${w} calc(${w} + ${GRID_GAP}px))` };
};

export const PageGrid = forwardRef<HTMLDivElement, {
  cols: number; ins: Insets; width: number; scope?: string; bands?: boolean; minHeight?: number;
  onHeight?: (h: number) => void; children: ReactNode;
}>(function PageGrid({ cols, ins, width, scope, bands, minHeight, onHeight, children }, ref) {
  const main = useRef<HTMLDivElement>(null);
  useEffect(() => {   // how tall the page really is, so the sheet can grow with it
    const el = main.current;
    if (!el || !onHeight || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight]);
  return (
    <div className={`absolute left-0 top-0 ${scope ?? ''}`} style={{ width, fontFamily: 'var(--font-sans)', color: 'var(--color-text)' }}>
      <div ref={main} style={mainStyle(ins)}>
        <div
          ref={ref}
          style={{
            display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: `minmax(${ROW_HEIGHT}px, auto)`, gap: GRID_GAP,
            position: 'relative', minHeight, ...(bands && columnBands(cols)),
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
});

// ── The grid's tracks, measured: where each column and row really is (rows grow with their content) ──

export interface Tracks { cols: { x: number; w: number }[]; rows: { y: number; h: number }[]; gap: number; y0: number }   // y0: where row 0 starts

const sizes = (list: string) => list.split(/\s+/).map(parseFloat).filter((n) => !Number.isNaN(n));
export function measureTracks(grid: HTMLElement): Tracks {
  const cs = getComputedStyle(grid), gap = parseFloat(cs.columnGap) || GRID_GAP;
  const lay = (ns: number[]) => { let at = 0; return ns.map((n) => { const t = { at, n }; at += n + gap; return t; }); };
  return {
    cols: lay(sizes(cs.gridTemplateColumns)).map(({ at, n }) => ({ x: at, w: n })),
    rows: lay(sizes(cs.gridTemplateRows)).map(({ at, n }) => ({ y: at, h: n })),
    gap, y0: 0,
  };
}
// Row i, measured or (past the last) at the least height
export const rowOf = (t: Tracks, i: number): { y: number; h: number } => {
  if (i < t.rows.length) return t.rows[Math.max(0, i)];
  const last = t.rows[t.rows.length - 1], end = last ? last.y + last.h + t.gap : t.y0;
  return { y: end + (i - t.rows.length) * (ROW_HEIGHT + t.gap), h: ROW_HEIGHT };
};
// A cell's box in grid px
export const cellBox = (t: Tracks, g: { col: number; row: number; colSpan: number; rowSpan: number }) => {
  const c0 = t.cols[g.col], c1 = t.cols[Math.min(t.cols.length - 1, g.col + g.colSpan - 1)], r0 = rowOf(t, g.row), r1 = rowOf(t, g.row + g.rowSpan - 1);
  return { x: c0?.x ?? 0, y: r0.y, w: c1 ? c1.x + c1.w - (c0?.x ?? 0) : 0, h: r1.y + r1.h - r0.y };
};
// The column / row whose start (or end) is nearest a point; rows run on past the last measured one
export function nearestCol(t: Tracks, x: number, end = false): number {
  let best = 0;
  t.cols.forEach((c, i) => { if (Math.abs((end ? c.x + c.w : c.x) - x) < Math.abs((end ? t.cols[best].x + t.cols[best].w : t.cols[best].x) - x)) best = i; });
  return best;
}
export function nearestRow(t: Tracks, y: number, end = false): number {
  let best = 0;
  for (let i = 0; i < t.rows.length + 64; i++) {
    const r = rowOf(t, i), v = end ? r.y + r.h : r.y, b = rowOf(t, best), bv = end ? b.y + b.h : b.y;
    if (Math.abs(v - y) < Math.abs(bv - y)) best = i;
    if (v > y + 400) break;
  }
  return best;
}
// The column / row a point is in (gutters count with the track before them)
export const colIn = (t: Tracks, x: number) => Math.max(0, t.cols.reduce((i, c, j) => (x >= c.x ? j : i), 0));
export function rowIn(t: Tracks, y: number): number {
  let i = 0;
  while (rowOf(t, i + 1).y <= y && i < 500) i++;
  return i;
}
// A group's tracks in the page grid's px: its columns are the page's (subgrid) from `col`, `span` of them; its rows
// its own, measured on its element and moved to where it sits (`k`: screen px per page px)
export function groupTracks(page: Tracks, grid: HTMLElement, el: HTMLElement, col: number, span: number, k: number): Tracks {
  const top = (el.getBoundingClientRect().top - grid.getBoundingClientRect().top) / k;
  const own = measureTracks(el);
  return { cols: page.cols.slice(col, col + span), rows: own.rows.map((r) => ({ y: r.y + top, h: r.h })), gap: page.gap, y0: top };
}
