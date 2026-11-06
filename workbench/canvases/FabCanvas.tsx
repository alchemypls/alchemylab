"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkbenchStore } from '@/lib/store';
import type { FabEditor } from '@/lib/scenes';
import { useCurrentProject } from '@/workbench/hooks/useCurrentProject';
import { useFileDraft } from '@/workbench/hooks/useDesignEditor';
import { useSheetView } from '@/workbench/hooks/useSheetView';
import { createAsset, createPalette, saveAsset, savePalette, usePalettes, useVault } from '@/workbench/hooks/useVault';
import { useVectorTools, type VectorDoc } from '@/workbench/hooks/useVectorTools';
import { FabricatorHeader, FabricatorList, FabricatorOptions, FabricatorSide, FabricatorStage, FabricatorStyles, useFabricator } from '@/workbench/ui/Fabricator';
import { PANEL_SELECT, PanelToggle, SheetPanel, TraceFields, TraceMover } from '@/workbench/ui/SheetPanel';
import { Banner, CANVAS_BG, EmptyNote, SaveDot, Sheet, SheetSurface } from '@/workbench/ui/SheetShell';
import { useTrace } from '@/workbench/hooks/useTrace';
import { menuTop, toolsFor, type ToolKey } from '@/workbench/ui/ToolRail';
import { VectorArtboard } from '@/workbench/ui/VectorArtboard';
import { VectorBox, VectorRail, VectorToolMenu } from '@/workbench/ui/VectorKit';
import { AssetFile } from '@/workbench/ui/fab/AssetFile';
import { ComponentFilePicker } from '@/workbench/ui/fab/ComponentFilePicker';
import { addColor, PaletteFields, PaletteSheet, removeColor } from '@/workbench/ui/PaletteEditor';
import { paletteSheet, type Palette } from '@/lib/design/palette';
import { gridOf } from '@/lib/design/vector';
import { ASSET_KINDS, blockFloor, projectedElements, topDownView, KIND_LABEL, type AssetKind, type VaultAsset } from '@/lib/design/vault';
import { pageSize, type DesignPage } from '@/lib/design/types';

// The Fab canvas: one editor at a time makes assets for the other canvases, in the same layout as Ideation.
// Visual Identity and Blocks draw with the vector tools; Components edits recipes on a stage.
// Visual Identity's files are the vault's shapes, icons and palettes (a palette's file key is `palette:<id>`).
// Blocks' files are the vault's blocks: game pieces drawn on top of their footprint, on an isometric grid.

const EDITORS: { id: FabEditor; label: string; first: ToolKey; tools: ToolKey[] }[] = [
  { id: 'identity',   label: 'Visual Identity', first: 'select', tools: ['select', 'shape', 'text', 'pen', 'erase', 'read'] },
  { id: 'components', label: 'Components',      first: 'browse', tools: ['browse', 'options'] },
  { id: 'blocks',     label: 'Blocks',          first: 'shape',  tools: ['select', 'shape', 'text', 'pen', 'erase', 'read'] },
];

const NEW_FILE: Record<string, AssetKind | 'palette'> = { '__new_shape__': 'shape', '__new_icon__': 'icon', '__new_palette__': 'palette', '__new_block__': 'block' };
const PALETTE_TOOLS: ToolKey[] = ['select'];
const NO_PAGE = { current: null };
type Doc = VectorDoc & { canUndo: boolean; canRedo: boolean };
const NO_DOC: Doc = { shown: null, current: NO_PAGE, apply: () => {}, undo: () => {}, redo: () => {}, canUndo: false, canRedo: false };
// Components works on a stage, not a file: a fixed sheet the recipe preview sits on
const STAGE: DesignPage = { title: 'Stage', blocks: [], elements: [], size: { width: 1280, height: 720 } };
const STAGE_DOC: Doc = { ...NO_DOC, shown: STAGE, current: { current: STAGE } };

export function FabCanvas() {
  const active    = useWorkbenchStore((s) => s.activeScene === 'fab');
  const editor    = useWorkbenchStore((s) => s.fabEditor);
  const setEditor = useWorkbenchStore((s) => s.setFabEditor);
  const config = EDITORS.find((e) => e.id === editor) ?? EDITORS[0];

  // The open file: a vault asset, or `palette:<id>`
  const fabFile    = useWorkbenchStore((s) => s.fabAsset);
  const setFabFile = useWorkbenchStore((s) => s.setFabAsset);
  const paletteId = fabFile?.startsWith('palette:') ? fabFile.slice(8) : undefined;
  const fabAsset = paletteId ? undefined : fabFile;
  const { entries, loaded } = useVault();
  const palettes = usePalettes();
  const entry = entries.find((e) => e.id === fabAsset);
  const pEntry = palettes.entries.find((e) => e.id === paletteId);
  const paletteOpen = config.id === 'identity' && !!paletteId;
  // The open file belongs to this editor: blocks to Blocks, everything else to Visual Identity
  const isBlock = (a?: VaultAsset) => a?.kind === 'block';
  const fileHere = config.id === 'blocks' ? !!entry && isBlock(entry.asset) : config.id === 'identity' ? !!pEntry || (!!entry && !isBlock(entry.asset)) : true;
  const drawing = config.id !== 'components' && !paletteOpen;
  const tools = toolsFor(paletteOpen ? PALETTE_TOOLS : config.tools);
  const [fileProps, setFileProps] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [color, setColor] = useState<number | null>(null);   // the swatch selected on an open palette

  const savePage = useCallback((a: VaultAsset) => saveAsset(fabAsset ?? '', a), [fabAsset]);
  const file = useFileDraft(fabAsset ?? '', entry?.asset ?? null, savePage);
  const savePal = useCallback((p: Palette) => savePalette(paletteId ?? '', p), [paletteId]);
  const pal = useFileDraft(fabFile ?? '', pEntry?.asset ?? null, savePal);
  const assetDoc: VectorDoc = { ...file, apply: (p, key) => file.apply(p as VaultAsset, key) };
  const paletteDoc: VectorDoc = { shown: null, current: NO_PAGE, apply: () => {}, undo: pal.undo, redo: pal.redo };
  const doc = paletteOpen ? { ...paletteDoc, canUndo: pal.canUndo, canRedo: pal.canRedo }
    : config.id === 'components' ? STAGE_DOC : fileHere ? { ...assetDoc, canUndo: file.canUndo, canRedo: file.canRedo } : NO_DOC;
  const fileSave = paletteOpen ? pal.save : file.save;
  const vt = useVectorTools({ doc, tools, enabled: drawing && !!doc.shown, onDeselect: () => setColor(null) });
  const { setTool, setMenuOpen, select, setGridOn } = vt;
  const toolKeys = paletteOpen ? PALETTE_TOOLS : config.tools;
  const tool = toolKeys.includes(vt.tool) ? vt.tool : toolKeys[0];   // the tool in hand may belong to the last editor
  const page = paletteOpen ? (pal.shown ? paletteSheet(pal.shown) : null) : doc.shown;
  const sheet = pageSize(page);
  const onKey = (e: KeyboardEvent) => {
    if (paletteOpen && color !== null && pal.shown && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault(); pal.apply(removeColor(pal.shown, color)); setColor(null); return;
    }
    vt.onKey(e);
  };
  const sv = useSheetView({ sheet, active, panOnDrag: tool === 'read', onKey, onCtrlWheel: drawing && !!doc.shown ? vt.stepLayer : undefined });   // Ctrl + wheel walks the layer pips
  // The box under the minimap holds one panel: opening the tracing image's settings closes file and layers
  const tr = useTrace(drawing ? `fab:${fabFile ?? ''}` : null, sheet);
  const { fit } = sv;

  // Components still saves into the most recent project, until it can save to the vault
  const { pid, project } = useCurrentProject();
  const f = useFabricator(pid, project);

  // Each editor opens fitted, with its first tool in hand. Blocks are placed on tiles, so their grid starts on.
  useEffect(() => {
    fit();
    select([]);
    setTool(config.first);
    setMenuOpen(true);
    setGridOn(config.id === 'blocks');
  }, [config.id]); // eslint-disable-line react-hooks/exhaustive-deps -- runs per editor; the rest are stable

  // When the open file isn't this editor's (or is gone), open the one this editor had last, else its first
  const bothLoaded = loaded && palettes.loaded;
  const lastFile = useRef<Partial<Record<FabEditor, string>>>({});
  if (fabFile && fileHere && config.id !== 'components') lastFile.current[config.id] = fabFile;
  useEffect(() => {
    if (!bothLoaded || config.id === 'components' || fileHere) return;
    const mine = (id?: string) => !!id && (config.id === 'blocks'
      ? isBlock(entries.find((e) => e.id === id)?.asset)
      : id.startsWith('palette:') ? palettes.entries.some((p) => `palette:${p.id}` === id) : entries.some((e) => e.id === id && !isBlock(e.asset)));
    const remembered = lastFile.current[config.id], firstPalette = palettes.entries[0];
    setFabFile(mine(remembered) ? remembered : config.id === 'blocks'
      ? entries.find((e) => isBlock(e.asset))?.id
      : entries.find((e) => !isBlock(e.asset))?.id ?? (firstPalette && `palette:${firstPalette.id}`));
  }, [bothLoaded, config.id, fileHere, entries, palettes.entries, setFabFile]);

  // Each file opens fitted. Icons and blocks are drawn to a grid, so theirs starts on.
  const openKind = entry?.asset.kind;
  useEffect(() => {
    if (config.id === 'components') return;
    fit();
    select([]);
    setColor(null);
    setFileProps(false);
    setGridOn(openKind === 'icon' || openKind === 'block');
  }, [fabFile, openKind]); // eslint-disable-line react-hooks/exhaustive-deps -- runs per file; the rest are stable

  const newFile = async (kind: AssetKind | 'palette') => {
    const title = window.prompt(`Name this ${kind}`)?.trim();
    if (!title) return;
    const r = kind === 'palette' ? await createPalette(title) : await createAsset(kind, title);
    if ('error' in r) return (paletteOpen ? pal : file).setSave({ kind: 'error', message: r.error });
    setFabFile(kind === 'palette' ? `palette:${r.id}` : r.id);
    if (kind !== 'palette') setTool('shape');
  };

  // A block switched to flat on the minimap is shown from above, as it stands on a flat floor: a preview, not an edit.
  // Its own view (the sheet's grid) stays what it was drawn in.
  const [topDown, setTopDown] = useState(false);
  useEffect(() => setTopDown(false), [fabFile]);
  const topBlock = config.id === 'blocks' && fileHere && file.shown && isBlock(file.shown) ? file.shown : undefined;
  // Worked out once per file version, so panning the preview doesn't redraw it
  const topDownOf = useMemo(() => topBlock && topDownView(topBlock), [topBlock]);
  const shownTop = useMemo(() => (topDown && topBlock && topDownOf ? { ...topDownOf, elements: projectedElements(topBlock, true) } : undefined), [topDown, topBlock, topDownOf]);

  const save = fileSave;
  const banner = shownTop ? 'Top-down preview: how it stands on a flat floor. Switch to iso on the minimap to edit.' : vt.blocked(drawing && !!page) ?? (config.id !== 'components' && 'message' in save ? save.message : null);

  return (
    <div className={CANVAS_BG}>
      {config.id === 'components' && <FabricatorStyles f={f} />}
      <SheetSurface sv={sv} grab={tool === 'read'} onBackground={() => { if (drawing && tool !== 'read') select([]); setColor(null); }}>
        {paletteOpen && pal.shown ? (
          <Sheet sv={sv}>
            <PaletteSheet palette={pal.shown} selected={color} select={setColor} add={() => { pal.apply(addColor(pal.shown!, color)); setColor(pal.shown!.colors.length); }} />
          </Sheet>
        ) : page && !paletteOpen ? (
          <Sheet sv={sv} size={sheet}>
            {drawing && shownTop ? (
              <VectorArtboard
                bibleId="" bible={null} page={{ ...page!, grid: { ...page!.grid, flat: true } }} onOpen={() => {}}
                floor={shownTop.corners} lookOnly={shownTop}
              />
            ) : drawing ? (
              <VectorArtboard
                bibleId="" bible={null} page={page} onOpen={() => {}} trace={tr.box}
                edit={vt.edit({ scale: sv.view.scale, tool, eraseAll: true })}
                floor={isBlock(file.shown ?? undefined) ? blockFloor(file.shown!).corners : undefined}
                penInput={vt.penInput}
              />
            ) : (
              <FabricatorStage f={f} className="w-full h-full" />
            )}
            {drawing && <TraceMover t={tr} scale={sv.view.scale} />}
          </Sheet>
        ) : (
          <EmptyNote>
            {!bothLoaded ? 'Loading…' : config.id === 'blocks'
              ? <span>No blocks yet.<br /><span className="font-mono text-sm">Pick + New block in the file menu.</span></span>
              : <span>The vault is empty.<br /><span className="font-mono text-sm">Pick + New shape, icon or palette in the file menu.</span></span>}
          </EmptyNote>
        )}
      </SheetSurface>

      <VectorRail vt={vt} tools={tools} tool={tool} />
      {drawing && <VectorToolMenu vt={vt} tools={tools} tool={tool} page={page} eraseAll />}
      {config.id === 'components' && vt.menuOpen && (tool === 'browse' || tool === 'options') && (
        <div
          className="absolute left-[61px] z-30 w-[208px] flex flex-col overflow-hidden bg-neutral-900/95 border border-neutral-700/60 rounded-xl backdrop-blur-sm text-xs text-neutral-300"
          style={{ top: menuTop(tools, tool), maxHeight: `calc(100vh - ${menuTop(tools, tool) + 16}px)` }}
        >
          {tool === 'browse' ? <FabricatorList f={f} /> : <div className="p-3 overflow-y-auto">{f.recipe ? <FabricatorOptions f={f} /> : 'Pick a component first.'}</div>}
        </div>
      )}

      {banner && <Banner>{banner}</Banner>}

      {active && (
        <SheetPanel
          sv={sv} page={page}
          trace={drawing ? tr : undefined}
          view={drawing && page ? (topDownOf ? { flat: topDown, set: setTopDown } : { flat: !!gridOf(page).flat, set: (flat) => { vt.setGrid({ flat: flat || undefined }); vt.setGridOn(true); } }) : undefined}
          mapFocus={vt.mapLayer} onMapFocus={drawing ? vt.focusLayer : undefined}
          undo={doc.undo} redo={doc.redo} canUndo={doc.canUndo} canRedo={doc.canRedo}
          pickers={
            <>
              <select
                value={config.id} className={PANEL_SELECT} title="Editor"
                onChange={(e) => { setEditor(e.target.value as FabEditor); e.target.blur(); }}
              >
                {EDITORS.map((x) => <option key={x.id} value={x.id} className="bg-neutral-900">{x.label}</option>)}
              </select>
              {config.id === 'identity' ? (
                <select
                  value={fabFile ?? ''} className={PANEL_SELECT} title="File"
                  onChange={(e) => { const v = e.target.value; e.target.blur(); if (NEW_FILE[v]) newFile(NEW_FILE[v]); else setFabFile(v); }}
                >
                  {!entry && !pEntry && <option value="">—</option>}
                  {ASSET_KINDS.filter((k) => k !== 'block').map((k) => {
                    const items = entries.filter((x) => x.asset.kind === k);
                    return items.length ? <optgroup key={k} label={KIND_LABEL[k]}>{items.map((x) => <option key={x.id} value={x.id}>{x.asset.title}</option>)}</optgroup> : null;
                  })}
                  {palettes.entries.length > 0 && <optgroup label="Palettes">{palettes.entries.map((x) => <option key={x.id} value={`palette:${x.id}`}>{x.asset.title}</option>)}</optgroup>}
                  <option value="__new_shape__">+ New shape…</option>
                  <option value="__new_icon__">+ New icon…</option>
                  <option value="__new_palette__">+ New palette…</option>
                </select>
              ) : config.id === 'blocks' ? (
                <select
                  value={fileHere ? fabFile ?? '' : ''} className={PANEL_SELECT} title="File"
                  onChange={(e) => { const v = e.target.value; e.target.blur(); if (NEW_FILE[v]) newFile(NEW_FILE[v]); else setFabFile(v); }}
                >
                  {!fileHere && <option value="">—</option>}
                  {entries.filter((x) => isBlock(x.asset)).map((x) => <option key={x.id} value={x.id}>{x.asset.title}</option>)}
                  <option value="__new_block__">+ New block…</option>
                </select>
              ) : <ComponentFilePicker f={f} />}
            </>
          }
          status={config.id !== 'components' && fileHere && <SaveDot save={save} saved="Saved to the vault" />}
          controls={drawing && (
            <>
              <PanelToggle on={vt.gridOn} onClick={() => setGridOn(!vt.gridOn)} title="Show the grid (G)">grid</PanelToggle>
            </>
          )}
          panels={drawing && (
            <>
              {config.id !== 'components' && fileHere && entry && (
                <PanelToggle on={fileProps} onClick={() => { setFileProps(!fileProps); setLayersOpen(false); select([]); }} title="This file's name, kind and sheet color">file</PanelToggle>
              )}
              {page && <PanelToggle on={layersOpen} onClick={() => { setLayersOpen(!layersOpen); setFileProps(false); }} title="Layers: draw on one, hide or lock others">layers</PanelToggle>}
            </>
          )}
          below={
            paletteOpen
              ? (pal.shown && paletteId ? <PaletteFields id={paletteId} palette={pal.shown} selected={color} select={setColor} apply={pal.apply} open={setFabFile} /> : undefined)
              : drawing && page && (layersOpen || vt.selected.length > 0)
              ? <VectorBox vt={vt} page={page} layersOpen={layersOpen} apply={doc.apply} asset />
              : drawing
              ? (fileProps && fileHere && file.shown && fabAsset ? <>
                  <AssetFile id={fabAsset} asset={file.shown} apply={assetDoc.apply} moved={(kind) => setEditor(kind === 'block' ? 'blocks' : 'identity')} />
                  <div className="border-t border-neutral-700/60"><TraceFields t={tr} /></div>
                </> : undefined)
              : <div className="flex flex-col text-neutral-300"><FabricatorHeader f={f} /><FabricatorSide f={f} /></div>
          }
        />
      )}
    </div>
  );
}
