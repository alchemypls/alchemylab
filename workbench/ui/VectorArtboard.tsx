"use client";

import { memo, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { drawOrder, layersOf, untouchable } from '@/lib/design/layers';
import { pageSize, type Bible, type DesignPage, type FitReport } from '@/lib/design/types';
import { outOfBounds, updateElement, visualBounds, type Pt, type VElement, type VText } from '@/lib/design/vector';
import type { TraceBox } from '@/workbench/hooks/useTrace';
import { ACCENT, PAPER } from './DesignArtboard';
import { SheetMenu } from './SheetMenu';
import { toPoints, type PagePen, type VectorEdit } from './vector/gesture';
import { Crowded, Footprints, Preview, Selection } from './vector/overlays';
import { Element, GridLines, TraceImage } from './vector/shapes';
import { useGestures } from './vector/useGestures';

export type { PagePen, VectorEdit, VTool } from './vector/gesture';

// Renders a vector DesignPage (page.elements) as one SVG at true artboard size — the parent scales it.
// Without `edit` it's read-only and `link`s navigate. With `edit` the pointer drives the active tool (vector/useGestures).
// Overflowing text and out-of-bounds elements are reported through onFit — the agent's stand-in for eyes.
// The parts: vector/shapes (how elements draw), vector/overlays (selection, handles, previews), vector/gesture (types, geometry).

type ArtboardProps = {
  page: DesignPage; bible: Bible | null; bibleId: string;
  onOpen: (pageId: string) => void;
  onFit?: (r: Omit<FitReport, 'at' | 'hash'>) => void;
  edit?: VectorEdit;
  penInput?: MutableRefObject<((s: PagePen) => void) | null>;
  trace?: TraceBox | null;   // a tracing image under the drawing (useTrace), not part of the page
  floor?: Pt[];   // a block's footprint on its own sheet (Fab), drawn under the drawing as a guide, not part of the page
  lookOnly?: { elements: VElement[]; transform: string };   // look only (no edit): draw these instead, through this transform
};

// Canvases re-render on every pan step and rebuild these props each time (new `edit` object, new callbacks), which redrew
// the whole page per frame. The callbacks go through stable stand-ins that call the latest ones, and the drawing only
// re-renders when a prop's value changes (compared a few levels deep: a respread page or a fresh `edit` still matches).
export function VectorArtboard(props: ArtboardProps) {
  const latest = useRef(props); latest.current = props;
  const fns = useMemo(() => ({
    onOpen: (id: string) => latest.current.onOpen(id),
    onFit: (r: Omit<FitReport, 'at' | 'hash'>) => latest.current.onFit?.(r),
    select: (ids: string[]) => latest.current.edit?.select(ids),
    apply: (next: DesignPage, key?: string) => latest.current.edit?.apply(next, key),
    placed: () => latest.current.edit?.placed?.(),
  }), []);
  const { edit } = props;
  return (
    <Artboard
      {...props} onOpen={fns.onOpen} onFit={props.onFit && fns.onFit}
      edit={edit && { ...edit, select: fns.select, apply: fns.apply, placed: edit.placed && fns.placed }}
    />
  );
}

const NO_ELEMENTS: VElement[] = [];
const sameish = (a: unknown, b: unknown, depth: number): boolean => {
  if (a === b) return true;
  if (depth === 0 || !a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => sameish((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], depth - 1));
};

const Artboard = memo(function Artboard({ page, bible, bibleId, onOpen, onFit, edit, penInput, trace, floor, lookOnly }: ArtboardProps) {
  const els = lookOnly?.elements ?? page.elements ?? NO_ELEMENTS;
  const { width: W, height: H } = pageSize(page);
  const svgRef = useRef<SVGSVGElement>(null);
  const g = useGestures({ svgRef, page, els, W, H, edit, penInput, lookOnly: !!lookOnly });
  const { pageRef, fpOf, single, editingText, setEditingText } = g;

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || !onFit) return;
    let overflowPx = 0;
    const overflowing: string[] = [];
    svg.querySelectorAll<HTMLElement>('[data-text]').forEach((box) => {
      if (box.closest('[data-asset]')) return;   // an asset's own text belongs to the asset
      const over = (box.firstElementChild as HTMLElement).offsetHeight - box.clientHeight;
      if (over > 0) { overflowing.push(box.dataset.text!); overflowPx = Math.max(overflowPx, over); }
    });
    const shown = new Set(drawOrder(els, layersOf(page)).map((x) => x.id));
    for (const el of els) if (shown.has(el.id) && el.type !== 'line' && outOfBounds(visualBounds(el, els), { width: W, height: H })) overflowing.push(el.id);
    onFit({ fits: overflowing.length === 0, overflowPx, overflowing });
  }, [page, bible, onFit]); // eslint-disable-line react-hooks/exhaustive-deps -- els derives from page

  // Kept across renders: panning, zooming and live strokes shouldn't redraw every element.
  const editable = !!edit;
  const editRef = useRef(edit); editRef.current = edit;
  const openRef = useRef(onOpen); openRef.current = onOpen;
  const layers = page.layers;
  const drawn = useMemo(() => drawOrder(els, layersOf({ layers })).map((el) => (
    <Element
      key={el.id} el={el} all={els} bible={bible} bibleId={bibleId} editing={editable}
      onOpen={(id) => openRef.current(id)}
      inlineEdit={editingText === el.id && el.type === 'text' ? {
        onChange: (text) => editRef.current?.apply(updateElement(pageRef.current, el.id, { text } as Partial<VText>), `text:${el.id}`),
        onDone: () => setEditingText(null),
      } : undefined}
    />
  )), [els, layers, bible, bibleId, editable, editingText]); // eslint-disable-line react-hooks/exhaustive-deps -- refs and a state setter

  const line = 1.5 / (edit?.scale ?? 1);
  return (
    <svg
      ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H}
      style={{ display: 'block', touchAction: edit ? 'none' : undefined, cursor: edit && edit.tool !== 'select' ? 'crosshair' : undefined }}
      {...g.handlers}
    >
      <style>{`.vlink{cursor:pointer}.vlink:hover{opacity:.65}`}</style>
      <rect width={W} height={H} fill={page.background ?? PAPER} />
      {trace && <TraceImage t={trace} />}
      {floor && <polygon points={toPoints(floor)} fill={ACCENT} fillOpacity={0.12} stroke={ACCENT} strokeWidth={2} strokeDasharray="10 6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none"><title>The block&apos;s footprint: where it stands on a floor</title></polygon>}
      {g.gridShown && <GridLines g={g.lattice} line={1 / (edit?.scale ?? 1)} />}
      {lookOnly ? <g transform={lookOnly.transform}>{drawn}</g> : drawn}
      {edit && <Crowded els={els} fpOf={fpOf} line={line} />}
      {edit && <Footprints els={els} selected={edit.selected} fpOf={fpOf} line={line} />}
      {edit && <Selection els={els} selected={edit.selected} single={single && fpOf(single) && !edit.styles.select.turnBlocks ? undefined : single} knobOnly={!!single && !!fpOf(single)} handle={11 / edit.scale} line={line} />}
      {g.preview && <Preview g={g.preview} line={line} pen={edit?.styles.pen} />}
      {penInput && <circle ref={g.ringRef} display="none" fill="none" pointerEvents="none" />}
      {edit && g.menu && (
        <SheetMenu
          at={g.menu} page={pageRef.current} apply={(next) => edit.apply(next)} select={edit.select} close={() => g.setMenu(null)}
          selectable={(() => { const blocked = untouchable(pageRef.current); return els.filter((x) => !blocked.has(x.id) && !edit.styles.select.off.includes(x.type)).map((x) => x.id); })()}
        />
      )}
      {edit && <rect ref={g.eraserRef} display="none" fill="#dc2626" fillOpacity={0.12} stroke="#dc2626" pointerEvents="none" />}
    </svg>
  );
}, (a, b) => sameish(a, b, 3));   // props → edit → placing; props → page → grid
