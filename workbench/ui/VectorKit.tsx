"use client";

// The vector drawing tools' UI, the same on every canvas that edits a vector page (Ideation, Fab, Web's wireframe).
// Each takes the canvas's useVectorTools, so a canvas only says which tools it shows and where its edits go.

import { useRef } from 'react';
import type { Bible, DesignPage } from '@/lib/design/types';
import { gridOf } from '@/lib/design/vector';
import type { useVectorTools } from '@/workbench/hooks/useVectorTools';
import { LayersPanel } from './LayersPanel';
import { shapeIcon, ToolMenu } from './ToolMenu';
import { menuTop, RAIL_BUTTON, ToolRail, type RailTool, type ToolKey } from './ToolRail';
import { VectorInspector } from './VectorInspector';
import type { VTool } from './VectorArtboard';

export type VectorTools = ReturnType<typeof useVectorTools>;

const MENU_TOOLS: ToolKey[] = ['select', 'shape', 'text', 'zone', 'pen', 'erase'];   // the tools with a settings menu
const IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';

// The tool rail: the shape tool shows the shape it makes, the pen its bridge's status. `addImage` adds an image button.
export function VectorRail({ vt, tools, tool = vt.tool, addImage }: {
  vt: VectorTools; tools: RailTool[]; tool?: ToolKey;
  addImage?: { title: string; add: (file: File) => void };
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { pen } = vt;
  return (
    <ToolRail
      tools={tools} tool={tool} pick={vt.pickTool}
      icon={(t) => t.key === 'shape' ? shapeIcon(vt.styles.shape.kind, vt.styles.shape) : t.key === 'pen' ? (
        <>{t.icon}{pen.live && <span className={`absolute -top-0.5 -right-1.5 w-1.5 h-1.5 rounded-full ${pen.status === 'live' ? 'bg-emerald-400' : pen.status === 'error' ? 'bg-red-500' : 'bg-amber-400 animate-pulse'}`} />}</>
      ) : undefined}
    >
      {addImage && (
        <>
          <button title={addImage.title} aria-label="Add image" onClick={() => fileRef.current?.click()} className={`${RAIL_BUTTON} text-neutral-400 hover:bg-neutral-800`}>▨</button>
          <input
            ref={fileRef} type="file" accept={IMAGE_TYPES} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addImage.add(f); }}
          />
        </>
      )}
    </ToolRail>
  );
}

// The settings menu beside the rail, for the tool in hand, while it's open
export function VectorToolMenu({ vt, tools, tool = vt.tool, page, eraseAll }: {
  vt: VectorTools; tools: RailTool[]; tool?: ToolKey; page: DesignPage | null;
  eraseAll?: boolean;   // the eraser rubs out everything (Fab), not just ink
}) {
  if (!page || !vt.menuOpen || !MENU_TOOLS.includes(tool)) return null;
  return (
    <ToolMenu
      key={tool} tool={tool as VTool} top={menuTop(tools, tool)}
      styles={vt.styles} favorites={vt.favorites}
      change={vt.changeTool} applyFavorite={vt.applyFavorite} saveFavorite={vt.saveFavorite} removeFavorite={vt.removeFavorite}
      grid={gridOf(page)} setGrid={vt.setGrid} pen={vt.pen} eraseAll={eraseAll}
    />
  );
}

// The box under the minimap for a vector page: the layers (when open) and the selection's properties.
// `always` shows the properties with nothing selected too (the page's own, on Ideation).
export function VectorBox({ vt, page, layersOpen, apply, bible = null, pages = [], asset, always, children }: {
  vt: VectorTools; page: DesignPage; layersOpen: boolean;
  apply: (next: DesignPage, key?: string) => void;   // property edits: straight to the file, not stamped on a layer
  bible?: Bible | null; pages?: { id: string; title: string }[];
  asset?: boolean;   // a vault asset's layers
  always?: boolean;
  children?: React.ReactNode;   // under the properties, with nothing selected (always only)
}) {
  const inspector = <VectorInspector page={page} bible={bible} pages={pages} selected={vt.selected} apply={apply} select={vt.select} />;
  const some = vt.selected.length > 0;
  if (layersOpen) return (
    <>
      <LayersPanel page={page} apply={vt.apply} active={vt.layer} setActive={vt.setLayer} selected={vt.selected} select={vt.select} asset={asset} />
      {some && <div className="border-t border-neutral-700/60">{inspector}</div>}
    </>
  );
  if (always) return <>{inspector}{!some && children && <div className="border-t border-neutral-700/60">{children}</div>}</>;
  return some ? inspector : null;
}
