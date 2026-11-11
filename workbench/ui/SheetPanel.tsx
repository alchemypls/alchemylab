"use client";

import type { ReactNode } from 'react';
import { CanvasPanelSlot } from '@/workbench/shell/CanvasPanel';
import { PageMap } from './PageMap';
import { AUX_BAR, Docked } from './AuxDock';
import { layersOf } from '@/lib/design/layers';
import { useRef } from 'react';
import { SliderField } from './StyleFields';
import type { TraceControls } from '@/workbench/hooks/useTrace';
import type { Bible, DesignPage } from '@/lib/design/types';
import type { VElement } from '@/lib/design/vector';
import type { useSheetView } from '@/workbench/hooks/useSheetView';

// What a full-screen canvas keeps in the top-right panel: two dropdowns, a row of controls, the minimap,
// then the toggles for the panels that open in the box below (page, layers, file).

export const PANEL_SELECT = 'bg-neutral-800/60 text-[10px] font-mono text-neutral-300 outline-none cursor-pointer min-w-0 flex-1 border border-neutral-700 rounded px-1 py-0.5';
const TBTN = 'text-xs text-neutral-400 hover:text-white disabled:opacity-30 px-1';

export function PanelToggle({ on, onClick, title, children }: { on?: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick} title={title}
      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${on ? 'border-amber-600 text-amber-400' : 'border-neutral-700 text-neutral-400 hover:text-white'}`}
    >{children}</button>
  );
}

export function SheetPanel({ pickers, row, status, controls, panels, undo, redo, canUndo, canRedo, sv, page, bible, below, mapFocus, onMapFocus, trace, view, map, rail, belowAux, mapLook }: {
  pickers: ReactNode;
  row?: ReactNode;        // a second row under the pickers
  map?: ReactNode;        // a minimap of the canvas's own, in place of the vector page's
  rail?: ReactNode;       // pips of the canvas's own left of the minimap, in place of the page's layer pips
  status?: ReactNode;     // before undo
  controls?: ReactNode;   // before recenter
  panels?: ReactNode;     // under the minimap: toggles for what opens in the box below
  undo?: () => void; redo?: () => void; canUndo?: boolean; canRedo?: boolean;   // left out: no undo buttons (Live)
  sv: ReturnType<typeof useSheetView>;
  page: DesignPage | null; bible?: Bible | null;
  below?: ReactNode;
  belowAux?: ReactNode;   // a bar docked left of the box below (the selection's actions)
  mapLook?: { elements: VElement[]; transform: string } | null;   // the sheet is showing a look-only view: the map follows it
  mapFocus?: string | null;   // the layer the minimap focuses on, null for all
  onMapFocus?: (layer: string | null) => void;   // given: the minimap shows layer pips
  trace?: TraceControls;   // given: the minimap outlines the tracing image (its settings live in the page box: TraceFields)
  view?: { flat: boolean; set: (flat: boolean) => void };   // given: the minimap shows the grid's iso / flat switch (top-right)
}) {
  return (
    <>
      <CanvasPanelSlot>
        <div className="flex items-center gap-1">{pickers}</div>
        {row}
        <div className="flex items-center gap-1 px-0.5">
          {status}
          {undo && <button onClick={undo} disabled={!canUndo} className={TBTN} title="Undo (Ctrl+Z)" aria-label="Undo">↶</button>}
          {redo && <button onClick={redo} disabled={!canRedo} className={TBTN} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">↷</button>}
          <span className="flex-1" />
          {controls}
          <PanelToggle onClick={sv.recenter} title={`Center the sheet, staying at ${Math.round(sv.view.scale * 100)}% zoom. Ctrl+0 fits it, Ctrl+1 is 100%.`}>recenter</PanelToggle>
        </div>
        {/* the pips float outside the panel, left of the map, so the map keeps the panel's full width */}
        <Docked side="left" align="center" gap={14} aux={rail ?? (onMapFocus && page && <LayerPips page={page} focus={mapFocus ?? null} pick={onMapFocus} />)}>
        <div className="relative rounded-lg border border-neutral-700/60">
          {map ?? <PageMap page={page} bible={bible ?? null} view={sv.visible} onCenter={sv.centerOn} focus={onMapFocus ? mapFocus : null} trace={trace?.box} look={mapLook} />}
          {view && (
            <div className="absolute top-1.5 right-1.5 flex rounded-full overflow-hidden bg-neutral-900/80 backdrop-blur-sm text-[10px] font-mono">
              {([false, true] as const).map((flat) => (
                <button
                  key={String(flat)} aria-pressed={view.flat === flat} onClick={() => view.set(flat)}
                  title={flat ? 'Flat grid: top-down square tiles' : 'Isometric grid'}
                  className={`px-2 py-0.5 ${view.flat === flat ? 'bg-amber-500/25 text-amber-300' : 'text-neutral-400 hover:text-neutral-200'}`}
                >{flat ? 'flat' : 'iso'}</button>
              ))}
            </div>
          )}
        </div>
        </Docked>
        {panels && <div className="flex items-center gap-1 [&>button]:flex-1 [&>button]:py-1">{panels}</div>}
      </CanvasPanelSlot>
      {below && (
        <CanvasPanelSlot area="below">
          {/* belowAux (the selection bar) floats outside the box on its left, like the pips by the map */}
          <Docked side="left" gap={14} aux={belowAux} className="max-h-full flex flex-col">
            <div className="min-h-0 overflow-y-auto bg-neutral-900/95 border border-neutral-700/60 rounded-xl backdrop-blur-sm pointer-events-auto">{below}</div>
          </Docked>
        </CanvasPanelSlot>
      )}
    </>
  );
}

// Left of the minimap, a vertical stack: the first pip is every layer at once, then one per layer, top layer first.
// A layer's pip focuses the map on it (the rest dim) and makes it the layer you draw on.
function LayerPips({ page, focus, pick }: { page: DesignPage; focus: string | null; pick: (layer: string | null) => void }) {
  const layers = page.layers?.length ? layersOf(page) : [];
  const on = layers.some((l) => l.id === focus) ? focus : null;
  const pip = (lit: boolean) => `block rounded-full transition-colors ${lit ? 'bg-amber-400' : 'bg-neutral-500 group-hover:bg-neutral-300'}`;
  return (
    <div className={MAP_RAIL}>
      <button className="group p-1" title="All layers" aria-label="All layers" aria-pressed={!on} onClick={() => pick(null)}>
        <span className={`${pip(!on)} w-2.5 h-2.5 ring-1 ring-offset-1 ring-offset-neutral-900 ${!on ? 'ring-amber-400/60' : 'ring-neutral-500/60'}`} />
      </button>
      {[...layers].reverse().map((l) => (
        <button
          key={l.id} className="group p-1" aria-pressed={on === l.id} onClick={() => pick(l.id)}
          title={`${l.name}${l.hidden ? ' (hidden)' : l.locked ? ' (locked)' : ''}`} aria-label={l.name}
        >
          <span className={`${pip(on === l.id)} w-2 h-2 ${l.hidden ? 'opacity-40' : ''}`} />
        </button>
      ))}
    </div>
  );
}

// Layer pips sit in this rail, docked outside the panel left of the minimap, so nothing covers the map (Web's and Live's too)
export const MAP_RAIL = `${AUX_BAR} flex-col`;

const MINI_BTN = 'text-[11px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30';
const TRACE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';

// The tracing image, at the bottom of the page box (Ideation) or the file box (Fab): add one, or its settings
export function TraceFields({ t }: { t: TraceControls }) {
  const input = useRef<HTMLInputElement>(null);
  if (!t.trace) return (
    <div className="p-3 flex items-center justify-between gap-2 text-xs text-neutral-300">
      <span className="text-[10px] uppercase tracking-widest text-sky-400">Tracing image</span>
      <button className={MINI_BTN} onClick={() => input.current?.click()} title="An image under the sheet to trace over. Kept in this browser only">Add</button>
      <input ref={input} type="file" accept={TRACE_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) t.load(f); }} />
    </div>
  );
  return (
    <div className="p-3 flex flex-col gap-4 text-xs text-neutral-300">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-sky-400">Tracing image</span>
        <button className={MINI_BTN} onClick={t.toggle}>{t.trace.shown ? 'Hide' : 'Show'}</button>
      </div>
      <SliderField label="Opacity %" value={Math.round(t.trace.opacity * 100)} min={5} max={100} notches={[15, 40, 70, [100, 'solid']]} onChange={(v) => t.set({ opacity: v / 100 })} />
      <SliderField label="Size %" value={Math.round(t.trace.scale * 100)} min={10} max={400} step={5} notches={[50, [100, 'fit'], 200, 300]} onChange={(v) => t.set({ scale: v / 100 })} />
      <div className="flex flex-wrap gap-1">
        <button className={`${MINI_BTN} ${t.adjusting ? '!border-sky-500 !text-sky-300' : ''}`} disabled={!t.trace.shown} onClick={() => t.setAdjusting(!t.adjusting)} title="Drag the sheet to move the image">{t.adjusting ? 'Done moving' : 'Move'}</button>
        <button className={MINI_BTN} onClick={t.fit}>Fit</button>
        <button className={MINI_BTN} onClick={() => input.current?.click()}>Replace</button>
        <span className="flex-1" />
        <button className={`${MINI_BTN} !border-red-900 !text-red-300`} onClick={t.remove}>Remove</button>
      </div>
      <input ref={input} type="file" accept={TRACE_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) t.load(f); }} />
      <p className="text-[10px] text-neutral-500 leading-relaxed">Kept in this browser for this sheet only. It isn&apos;t saved to the page, so the agent doesn&apos;t see it.</p>
    </div>
  );
}

// Over the sheet while moving the tracing image: dragging anywhere moves it
export function TraceMover({ t, scale }: { t: TraceControls; scale: number }) {
  const start = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  if (!t.adjusting || !t.trace) return null;
  return (
    <div
      className="absolute inset-0 z-10" style={{ cursor: 'move', touchAction: 'none' }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, y: e.clientY, cx: t.trace!.cx, cy: t.trace!.cy };
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (s) t.set({ cx: Math.round(s.cx + (e.clientX - s.x) / scale), cy: Math.round(s.cy + (e.clientY - s.y) / scale) });
      }}
      onPointerUp={() => { start.current = null; }}
    />
  );
}
