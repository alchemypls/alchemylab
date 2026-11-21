"use client";

import { memo, useEffect, useRef, type ReactNode } from 'react';
import { ROW_HEIGHT, componentOf, geometryAt, hiddenAt, isGroup, nest, readingOrder, pinStyle, type Insets, type LiveBackdrop, type PagePlacement, type PageSketch, type PlacementGeom } from '@/lib/project';
import { BEHAVIORS, type ProjectComponent } from '@/lib/library';
import { TIER_COLUMNS, deviceById, type Tier } from '@/lib/devices';
import { RecipeView, themeScope } from '@/workbench/ui/RecipeView';
import { PageGrid, cellStyle, planCellStyle } from './PageGrid';
import { VectorArtboard } from '@/workbench/ui/VectorArtboard';
import type { DesignPage } from '@/lib/design/types';

// The Web canvas's three layers of one page, bottom to top: the wireframe (sketch), the layout (component
// placements on the column grid) and the preview (the real components). All in page px at the device width.

export type WebLayer = 'wireframe' | 'layout' | 'preview';
export const WEB_LAYERS: { id: WebLayer; label: string; hint: string }[] = [
  { id: 'wireframe', label: 'Wireframe', hint: 'Sketch the page: boxes, strokes, reference images' },
  { id: 'layout',    label: 'Layout',    hint: 'Place components on the column grid' },
  { id: 'preview',   label: 'Preview',   hint: 'The page as it ships' },
];

export interface Placed { p: PagePlacement; g: PlacementGeom }

export const WIRE_PAPER = '#f4efe6';
export const WIRE_GRID = { cell: 8, flat: true };

// How tall a sketch's page is, at its own width: as given, else the device's screen
export const sketchHeight = (s: PageSketch) => s.height ?? deviceById(s.deviceId)?.height ?? Math.round(s.width * 1.6);

// A wireframe as a vector page, `height` tall (at least its own), for the vector tools and VectorArtboard
export function sketchPage(s: PageSketch, title: string, height = 0): DesignPage {
  return {
    title, updated: '', blocks: [], elements: s.elements, layers: s.layers,
    grid: s.grid ?? WIRE_GRID, background: s.background ?? WIRE_PAPER,
    size: { width: s.width, height: Math.max(sketchHeight(s), height) },
  };
}
// …and back: what the store keeps of an edited wireframe page
export const pageSketch = (p: DesignPage, base: Pick<PageSketch, 'width' | 'deviceId'>): PageSketch => ({
  ...base, height: p.size?.height, elements: p.elements ?? [], layers: p.layers, grid: p.grid, background: p.background === WIRE_PAPER ? undefined : p.background,
});

// The wireframe, read-only, scaled from the width it was drawn at to `width`
export const WireframeLayer = memo(function WireframeLayer({ sketch, width }: { sketch: PageSketch; width: number }) {
  const page = sketchPage(sketch, ''), k = width / sketch.width;
  return (
    <div className="absolute left-0 top-0 pointer-events-none" style={{ width: sketch.width, height: page.size!.height, transform: `scale(${k})`, transformOrigin: '0 0' }}>
      <VectorArtboard page={{ ...page, background: 'transparent' }} bible={null} bibleId="" onOpen={() => {}} />
    </div>
  );
});

// The blocks a tier shows, nested as the export nests them (nest): each group's inside its cell
function tree(placements: PagePlacement[], tier: Tier, cell: (x: Placed & { top: number }, inner: ReactNode) => ReactNode): ReactNode[] {
  const hidden = hiddenAt(placements, tier), geo = geometryAt(placements, tier);
  return nest<ReactNode>(placements, (p, inner) => cell({ p, ...geo.get(p.id)! }, inner.length ? inner : null), (p) => !hidden.has(p.id));
}

// What a slot holds on the page: nothing (the export ships it empty), not the editor's labelled placeholder
const NO_SLOT = () => '';

// A block's real content, invisible: it sizes the cell (rows grow with it) under a planning box. Memoized: the layout
// editor re-renders on every pointer move of a drag, and its props (store objects) only change with an edit
export const Sizer = memo(function Sizer({ placement, component, here }: { placement: PagePlacement; component: ProjectComponent | undefined; here?: string }) {
  return component ? (
    <div aria-hidden style={{ visibility: 'hidden' }}>
      <RecipeView recipe={component.recipe} props={placement.props} options={placement.options} slotContent={NO_SLOT} here={here} still />
    </div>
  ) : null;
});

// The layout as planning blocks (seen through from the preview): each placement's cell at its real size, its color and name
export function LayoutLayer({ pid, placements, tier, ins, width, components }: {
  pid: string; placements: PagePlacement[]; tier: Tier; ins: Insets; width: number; components: Record<string, ProjectComponent> | undefined;
}) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <PageGrid cols={TIER_COLUMNS[tier]} ins={ins} width={width} scope={themeScope(pid)}>
        {(() => {
          const numbers = readingOrder(placements, tier);
          return tree(placements, tier, ({ p, g, top }, inner) => {
            const group = isGroup(p), color = p.color ?? (group ? '#64748b' : '#818cf8'), c = componentOf(components, p);
            return (
              <div key={p.id} style={planCellStyle(p, g, ins, top)}>
                {!group && <Sizer placement={p} component={c} />}
                <div className={`absolute inset-0 rounded-md border-2 flex items-start gap-1.5 p-2 overflow-hidden ${group ? 'border-dashed' : ''}`} style={{ borderColor: color, background: `${color}${group ? '14' : '26'}` }}>
                  <span className="text-[11px] font-mono font-bold rounded px-1 shrink-0" style={{ background: color, color: '#0a0a0a' }}>{numbers.get(p.id)}</span>
                  <span className="text-[12px] font-sans text-neutral-800 truncate">{p.name ?? (group ? 'Group' : c?.recipe.name) ?? `missing: ${p.componentId}`}</span>
                </div>
                {inner}
              </div>
            );
          });
        })()}
      </PageGrid>
    </div>
  );
}

// One placement as it ships: the real component (same elements and generated CSS as the exported code) in its cell
export function PlacementCell({ placement, geom, top, ins, component, here, children }: {
  placement: PagePlacement; geom: PlacementGeom; top?: number; ins: Insets; component: ProjectComponent | undefined; here?: string; children?: ReactNode;
}) {
  return (
    <div style={cellStyle(placement, geom, ins, top)}>
      {isGroup(placement) ? children : component ? (
        <RecipeView recipe={component.recipe} props={placement.props} options={placement.options} slotContent={NO_SLOT} here={here} />
      ) : (
        <div className="w-full h-full flex items-center justify-center border border-dashed border-neutral-500/50 rounded" style={{ minHeight: ROW_HEIGHT }}>
          <span className="text-[8px] text-neutral-500 font-mono truncate px-2">missing: {placement.componentId}</span>
        </div>
      )}
    </div>
  );
}

// Pinned blocks over the first screen (the page's top `screenH` px, where the viewport is before scrolling). As
// planning boxes (click one to select it), or as they ship.
export function PinnedLayer({ pinned, cols, width, screenH, components, preview, selected, select, here }: {
  pinned: Placed[]; cols: number; width: number; screenH: number; components: Record<string, ProjectComponent> | undefined; here?: string;
  preview?: boolean; selected?: string | null; select?: (id: string) => void;
}) {
  if (!pinned.length) return null;
  return (
    <div className="absolute left-0 top-0 pointer-events-none" style={{ width, height: screenH, zIndex: 10 }}>
      {pinned.map(({ p, g }) => {
        const spot = pinStyle(g.pin!, g.colSpan, cols), side = g.pin!.at === 'left' || g.pin!.at === 'right';
        const c = componentOf(components, p), color = p.color ?? '#818cf8';
        if (preview) return (
          <div key={p.id} className="absolute" style={{ ...spot, containerType: 'inline-size' }}>
            {c ? <RecipeView recipe={c.recipe} props={p.props} options={p.options} slotContent={NO_SLOT} here={here} /> : null}
          </div>
        );
        return (
          <div
            key={p.id} className={`absolute p-1 ${select ? 'pointer-events-auto cursor-pointer' : ''}`}
            style={{ ...spot, height: side ? undefined : g.rowSpan * ROW_HEIGHT }}
            onPointerDown={select ? (e) => { if (e.button === 0) { e.stopPropagation(); select(p.id); } } : undefined}
          >
            <div className="w-full h-full rounded-md border-2 border-dashed flex items-start gap-1.5 p-2 overflow-hidden" style={{ borderColor: selected === p.id ? '#f59e0b' : color, background: `${color}33` }}>
              <span className="text-[12px] font-sans text-neutral-800 truncate">{p.name ?? c?.recipe.name ?? `missing: ${p.componentId}`}</span>
              <span className="ml-auto text-[10px] font-mono text-neutral-500 shrink-0" title="Pinned to the screen">pin {g.pin!.at}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// The page as it ships, on the project theme's background and the backdrop over its first screen (RecipeStyles must
// be mounted for `pid`): grid cells inside the kept-clear edges, pinned blocks over the screen
// The live backdrop over the first screen, run by the same runtime the export ships (the sky's WebGL, a video)
function LiveLayer({ live, width, height }: { live: LiveBackdrop; width: number; height: number }) {
  const ref = useRef<HTMLElement | null>(null), key = JSON.stringify(live);   // a fresh object each render: run again only when it changes
  useEffect(() => { const el = ref.current; return el ? BEHAVIORS.backdrop.attach(el) : undefined; }, [key, width, height]);
  const box = { position: 'absolute' as const, left: 0, top: 0, width, height, pointerEvents: 'none' as const, overflow: 'hidden' as const };
  return live.kind === 'video'
    ? <video key={key} ref={(el) => { ref.current = el; }} src={live.src} poster={live.poster} muted loop playsInline preload="metadata" aria-hidden style={{ ...box, objectFit: 'cover' }} />
    : <div key={key} ref={(el) => { ref.current = el; }} aria-hidden data-colors={live.colors} data-stars={live.stars} data-speed={live.speed} style={box} />;
}

export function PreviewLayer({ pid, placements, tier, pinned, ins, width, height, screenH, backdrop, live, components, here, onHeight }: {
  pid: string; placements: PagePlacement[]; tier: Tier; pinned: Placed[]; ins: Insets; width: number; height: number; screenH: number;
  backdrop: string | undefined; live?: LiveBackdrop; components: Record<string, ProjectComponent> | undefined; here?: string;
  onHeight?: (h: number) => void;
}) {
  const cols = TIER_COLUMNS[tier];
  return (
    <div
      className={`absolute left-0 top-0 ${themeScope(pid)}`}
      // --tier as the export sets it (0 phone, 1 tablet, 2 desktop), from the tier's column count
      style={{ width, height, background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', ['--tier' as string]: tier === 'desktop' ? 2 : tier === 'tablet' ? 1 : 0 }}
    >
      {backdrop && <div className="absolute left-0 top-0 pointer-events-none" style={{ width, height: screenH, background: backdrop, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
      {live && <LiveLayer live={live} width={width} height={screenH} />}
      <PageGrid cols={cols} ins={ins} width={width} onHeight={onHeight}>
        {tree(placements, tier, ({ p, g, top }, inner) => <PlacementCell key={p.id} placement={p} geom={g} top={top} ins={ins} component={componentOf(components, p)} here={here}>{inner}</PlacementCell>)}
      </PageGrid>
      <PinnedLayer pinned={pinned} cols={cols} width={width} screenH={screenH} components={components} preview here={here} />
    </div>
  );
}
