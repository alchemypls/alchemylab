"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkbenchStore } from '@/lib/store';
import { useDesignEditor } from '@/workbench/hooks/useDesignEditor';
import { useSheetView } from '@/workbench/hooks/useSheetView';
import { useVault } from '@/workbench/hooks/useVault';
import { useVectorTools } from '@/workbench/hooks/useVectorTools';
import { DesignArtboard } from '@/workbench/ui/DesignArtboard';
import { DesignInspector } from '@/workbench/ui/DesignInspector';
import { PANEL_SELECT as SELECT, PanelToggle, SheetPanel, TraceFields, TraceMover } from '@/workbench/ui/SheetPanel';
import { Banner, CANVAS_BG, EmptyNote, SaveDot, Sheet, SheetSurface } from '@/workbench/ui/SheetShell';
import { useTrace } from '@/workbench/hooks/useTrace';
import { toolsFor, type ToolKey } from '@/workbench/ui/ToolRail';
import { VectorArtboard } from '@/workbench/ui/VectorArtboard';
import { VectorBox, VectorRail, VectorToolMenu } from '@/workbench/ui/VectorKit';
import { SelectionBar } from '@/workbench/ui/vector/actions';
import { addElement, newId } from '@/lib/design/vector';
import { removeBlock, resizeBlock } from '@/lib/design/ops';
import { pageSize, type DesignPage } from '@/lib/design/types';
import { fitBlocks, placeAsset } from '@/lib/design/vault';
import { VAULT_DRAG } from '@/workbench/shell/FileVault';

// The Ideation canvas: one page of a design bible (design/<bible>/pages/<page>.json) fills the screen,
// live from disk. The agent writes the files (design-bible skill); this draws them and edits them by hand.
// Read is a tool, not a mode: with it, links navigate and dragging pans. Any other tool edits.

const TBTN   = 'text-xs text-neutral-400 hover:text-white disabled:opacity-30 px-1';
const NEW_PAGE = '__new__';
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const VECTOR_TOOLS = toolsFor(['select', 'shape', 'text', 'zone', 'pen', 'erase', 'read']);   // placing from the vault starts in the Vault panel
const BLOCK_TOOLS = toolsFor(['read', 'select']);

export function IdeationCanvas() {
  const active        = useWorkbenchStore((s) => s.activeScene === 'ideation');
  const { bible: bibleId, page: pageId } = useWorkbenchStore((s) => s.designView);
  const setDesignView = useWorkbenchStore((s) => s.setDesignView);
  const doc = useDesignEditor(bibleId, pageId);
  const { list, bible, shown, apply, current, setSave } = doc;

  const [nav,      setNav]      = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);   // block page
  const [pageProps, setPageProps] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const armed = useWorkbenchStore((s) => s.vaultArmed);   // picked in the Vault panel: the next clicks place it
  const setArmed = useWorkbenchStore((s) => s.setVaultArmed);
  const vault = useVault().entries;
  const placing = vault.find((e) => e.id === armed);
  // Placed blocks drawn at the size their Fab file gives them now; the next edit saves it
  const fitted = useMemo(() => (shown?.elements ? fitBlocks(shown, (id) => vault.find((e) => e.id === id)?.asset) : shown), [shown, vault]);
  const toolOnOpen = useRef<ToolKey>('read');

  const isVector = !!shown?.elements;
  const pages = list.find((b) => b.id === bibleId)?.pages ?? [];
  const tools = isVector ? VECTOR_TOOLS : BLOCK_TOOLS;
  const sheet = pageSize(shown);
  const { width: W, height: H } = sheet;

  const tr = useTrace(isVector && bibleId ? `ideation:${bibleId}/${pageId}` : null, sheet);
  // The box under the minimap holds one panel: opening the tracing image's settings closes page and layers
  const vt = useVectorTools({ doc, tools, enabled: isVector, onDeselect: () => { setSelected(null); setPageProps(false); } });
  const { tool, setTool, selected: vsel, select: setVsel, gridOn, setGridOn } = vt;

  // Delete on a block page; everything else is shared with the vector tools
  const onKey = (e: KeyboardEvent) => {
    const cur = current.current;
    if (!isVector && cur && selected && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault(); e.stopImmediatePropagation();
      apply(removeBlock(cur, selected)); setSelected(null);
      return;
    }
    vt.onKey(e);
  };
  const sv = useSheetView({ sheet, active, panOnDrag: tool === 'read', onKey, onCtrlWheel: isVector ? vt.stepLayer : undefined });   // Ctrl + wheel walks the layer pips
  const { view, fit } = sv;

  // Bind to the first bible on disk if none is chosen yet
  useEffect(() => {
    if (!bibleId && list[0]) setDesignView({ bible: list[0].id, page: 'index' });
  }, [bibleId, list, setDesignView]);

  // Each page opens fitted, with the Read tool unless it was just created.
  useEffect(() => {
    fit();
    setSelected(null); setVsel([]); setPageProps(false);
    setTool(toolOnOpen.current);
    toolOnOpen.current = 'read';
  }, [bibleId, pageId, fit]); // eslint-disable-line react-hooks/exhaustive-deps -- setters are stable

  // ── Navigation ──
  const open = (next: string) => {
    if (next === pageId) return;
    setNav((h) => [...h, pageId]);
    setDesignView({ page: next });
  };
  const back = () => {
    const prev = nav[nav.length - 1];
    if (!prev) return;
    setNav((h) => h.slice(0, -1));
    setDesignView({ page: prev });
  };

  const createPage = async () => {
    const title = window.prompt('New page title');
    const id = title ? slug(title) : '';
    if (!title || !id || !bibleId) return;
    if (!pages.some((p) => p.id === id)) {
      const res = await fetch(`/api/design?bible=${bibleId}&page=${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, updated: new Date().toISOString().slice(0, 10), blocks: [], elements: [] }),
      }).catch(() => null);
      if (!res?.ok) return setSave({ kind: 'error', message: `Could not create page "${id}"` });
    }
    toolOnOpen.current = 'select';
    open(id);
  };

  // Puts a picked image file in assets/ and on the page, centered, at its own proportions
  const addImage = async (file: File) => {
    const cur = current.current;
    if (!bibleId || !cur) return;
    const dot = file.name.lastIndexOf('.');
    const stem = slug(dot > 0 ? file.name.slice(0, dot) : file.name) || 'image';
    const src = `${stem}-${Date.now().toString(36)}${dot > 0 ? file.name.slice(dot).toLowerCase() : '.png'}`;
    const res = await fetch(`/api/design?bible=${bibleId}&asset=${encodeURIComponent(src)}`, { method: 'PUT', body: file }).catch(() => null);
    if (!res?.ok) return setSave({ kind: 'error', message: `Could not upload ${file.name}` });
    const bmp = await createImageBitmap(file).catch(() => null);
    const w = 480, h = bmp ? Math.round((w * bmp.height) / bmp.width) : 360;
    const id = newId('image');
    vt.apply(addElement(current.current ?? cur, { id, type: 'image', src, x: (W - w) / 2, y: (H - h) / 2, w, h }));
    setVsel([id]); setTool('select');
  };

  // Picking in the Vault panel puts the place tool in hand; picking any other tool (or Esc) puts the asset back
  useEffect(() => {
    if (armed && isVector && placing) { setTool('asset'); setVsel([]); }
  }, [armed, isVector, !!placing]); // eslint-disable-line react-hooks/exhaustive-deps -- setters are stable
  useEffect(() => { if (tool !== 'asset' && armed) setArmed(null); }, [tool]); // eslint-disable-line react-hooks/exhaustive-deps -- only when the tool changes

  // ── Render ──
  const editing = tool !== 'read';
  const banner = vt.blocked(isVector) ?? ('message' in doc.save ? doc.save.message : doc.error && shown ? `${doc.error} — showing last good copy` : null);
  const showInspector = !!shown && (isVector ? vsel.length > 0 || pageProps || layersOpen : editing);

  return (
    <div className={CANVAS_BG}>
      <SheetSurface
        sv={sv} grab={!editing}
        onBackground={() => { if (editing) { setVsel([]); setSelected(null); } }}
        // A vault asset dropped on the page is placed where it lands (on a floor, it snaps to its tiles), then selected
        onDragOver={(e) => { if (isVector && fitted && vt.layer && e.dataTransfer.types.includes(VAULT_DRAG)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
        onDrop={(e) => {
          const a = vault.find((v) => v.id === e.dataTransfer.getData(VAULT_DRAG));
          if (!a || !isVector || !fitted || !vt.layer) return;
          e.preventDefault();
          const r = e.currentTarget.getBoundingClientRect();
          const placed = placeAsset(fitted as DesignPage, a.id, a.asset, { x: (e.clientX - r.left - view.x) / view.scale, y: (e.clientY - r.top - view.y) / view.scale });
          vt.apply(placed.page);
          setArmed(null);
          setTool('select'); setVsel([placed.id]);
        }}
      >
        {shown && bibleId ? (
          <Sheet sv={sv} size={sheet}>
            {isVector ? (
              <VectorArtboard
                bibleId={bibleId} bible={bible} page={fitted!} onOpen={open} onFit={doc.onFit} trace={tr.box}
                edit={vt.edit({ scale: view.scale, placing: placing && { id: placing.id, asset: placing.asset } })}
                penInput={vt.penInput}
              />
            ) : (
              <DesignArtboard
                bibleId={bibleId} bible={bible} page={shown} onOpen={open} onFit={doc.onFit}
                edit={editing ? {
                  selected, scale: view.scale,
                  onSelect: setSelected,
                  onSpan: (bid, span) => current.current && apply(resizeBlock(current.current, bid, span), `${bid}:span`),
                } : undefined}
              />
            )}
            <TraceMover t={tr} scale={view.scale} />
          </Sheet>
        ) : (
          <EmptyNote>
            {!list.length
              ? <span>No design bible yet.<br /><span className="font-mono text-sm">Run /design-bible in Claude Code to start one.</span></span>
              : `Page “${pageId}” isn’t built yet.`}
          </EmptyNote>
        )}
      </SheetSurface>

      {shown && <VectorRail vt={vt} tools={tools} addImage={isVector ? { title: 'Add image', add: addImage } : undefined} />}
      {shown && isVector && <VectorToolMenu vt={vt} tools={tools} page={shown as DesignPage} />}
      {tool === 'asset' && placing && !banner && <Banner tone="hint">Placing “{placing.asset.title}”: click the page. Esc stops.</Banner>}
      {banner && <Banner>{banner}</Banner>}

      {active && (
        <SheetPanel
          sv={sv} page={fitted} bible={bible}
          trace={isVector ? tr : undefined}
          mapFocus={vt.mapLayer} onMapFocus={isVector ? vt.focusLayer : undefined}
          undo={doc.undo} redo={doc.redo} canUndo={doc.canUndo} canRedo={doc.canRedo}
          pickers={
            <>
              <button onClick={back} disabled={!nav.length} className={TBTN} title="Back" aria-label="Back">←</button>
              <select
                value={bibleId ?? ''} className={SELECT} title="Bible"
                onChange={(e) => { setNav([]); setDesignView({ bible: e.target.value, page: 'index' }); e.target.blur(); }}
              >
                {!bibleId && <option value="">—</option>}
                {list.map((b) => <option key={b.id} value={b.id} className="bg-neutral-900">{b.title}</option>)}
              </select>
              <select
                value={pageId} className={SELECT} title="Page"
                onChange={(e) => { const v = e.target.value; e.target.blur(); if (v === NEW_PAGE) createPage(); else open(v); }}
              >
                {!pages.some((p) => p.id === pageId) && <option value={pageId}>{pageId}</option>}
                {pages.map((p) => <option key={p.id} value={p.id} className="bg-neutral-900">{p.title}</option>)}
                {bibleId && <option value={NEW_PAGE} className="bg-neutral-900">+ New vector page…</option>}
              </select>
            </>
          }
          status={<SaveDot save={doc.save} />}
          controls={
            <>
              {doc.fit && shown && (
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${doc.fit.fits ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}
                  title={doc.fit.fits ? 'Page fits the artboard' : `Overflowing: ${doc.fit.overflowing.join(', ')}`}
                >
                  {doc.fit.fits ? 'fits' : `+${Math.round(doc.fit.overflowPx)}px`}
                </span>
              )}
              {isVector && (
                <PanelToggle on={gridOn} onClick={() => { setGridOn(!gridOn); if (tool === 'read') setTool('select'); }} title="Show the placement grid (G). It also shows while placing or editing a floor zone.">grid</PanelToggle>
              )}
            </>
          }
          panels={isVector && (
            <>
              <PanelToggle on={pageProps} onClick={() => { setPageProps(!pageProps); setLayersOpen(false); setVsel([]); if (tool === 'read') setTool('select'); }} title="Page title, background, size and grid">page</PanelToggle>
              <PanelToggle on={layersOpen} onClick={() => { setLayersOpen(!layersOpen); setPageProps(false); if (tool === 'read') setTool('select'); }} title="This page's layers: draw on one, hide or lock others">layers</PanelToggle>
            </>
          )}
          belowAux={isVector && showInspector && <SelectionBar page={fitted as DesignPage} selected={vt.selected} host={vt} />}
          below={showInspector && shown ? (
            isVector
              ? <VectorBox vt={vt} page={fitted as DesignPage} layersOpen={layersOpen} apply={apply} bible={bible} pages={pages} always>{pageProps && <TraceFields t={tr} />}</VectorBox>
              : <DesignInspector page={shown as DesignPage} bible={bible} selected={selected} apply={apply} select={setSelected} saveBible={doc.saveBible} />
          ) : undefined}
        />
      )}
    </div>
  );
}
