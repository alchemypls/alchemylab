"use client";

import { memo } from 'react';
import { ROW_HEIGHT, type PagePlacement, type PageSketch, type PlacementGeom } from '@/lib/project';
import type { ProjectComponent } from '@/lib/library';
import { deviceById } from '@/lib/devices';
import { RecipeView, themeScope } from '@/workbench/ui/RecipeView';
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

// The layout as planning blocks: each placement's cell, its color and name
export function LayoutLayer({ placed, colWidth, components }: { placed: Placed[]; colWidth: number; components: Record<string, ProjectComponent> | undefined }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {placed.map(({ p, g }, i) => {
        const color = p.color ?? '#818cf8', c = components?.[p.componentId];
        return (
          <div
            key={p.id} className="absolute p-1"
            style={{ left: g.col * colWidth, top: g.row * ROW_HEIGHT, width: g.colSpan * colWidth, height: g.rowSpan * ROW_HEIGHT }}
          >
            <div className="w-full h-full rounded-md border-2 flex items-start gap-1.5 p-2 overflow-hidden" style={{ borderColor: color, background: `${color}26` }}>
              <span className="text-[11px] font-mono font-bold rounded px-1 shrink-0" style={{ background: color, color: '#0a0a0a' }}>{i + 1}</span>
              <span className="text-[12px] font-sans text-neutral-800 truncate">{p.name ?? c?.recipe.name ?? `missing: ${p.componentId}`}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// One placement as it ships: the real component (same elements and generated CSS as the exported code) in its cell
export function PlacementCell({ placement, geom, component, colWidth }: {
  placement: PagePlacement; geom: PlacementGeom; component: ProjectComponent | undefined; colWidth: number;
}) {
  return (
    <div className="absolute p-2 flex items-start" style={{ left: geom.col * colWidth, top: geom.row * ROW_HEIGHT, width: geom.colSpan * colWidth, height: geom.rowSpan * ROW_HEIGHT }}>
      {component ? (
        <RecipeView recipe={component.recipe} props={placement.props} options={placement.options} />
      ) : (
        <div className="w-full h-full flex items-center justify-center border border-dashed border-neutral-500/50 rounded">
          <span className="text-[8px] text-neutral-500 font-mono truncate px-2">missing: {placement.componentId}</span>
        </div>
      )}
    </div>
  );
}

// The page as it ships, on the project theme's background (RecipeStyles must be mounted for `pid`)
export function PreviewLayer({ pid, placed, colWidth, width, height, components }: {
  pid: string; placed: Placed[]; colWidth: number; width: number; height: number; components: Record<string, ProjectComponent> | undefined;
}) {
  return (
    <div
      className={`absolute left-0 top-0 ${themeScope(pid)}`}
      style={{ width, height, background: 'var(--color-bg)', color: 'var(--color-text)', containerType: 'inline-size' }}
    >
      {placed.map(({ p, g }) => <PlacementCell key={p.id} placement={p} geom={g} component={components?.[p.componentId]} colWidth={colWidth} />)}
    </div>
  );
}
