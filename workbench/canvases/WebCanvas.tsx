"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkbenchStore } from '@/lib/store';
import { useSheetView } from '@/workbench/hooks/useSheetView';
import { useFileDraft } from '@/workbench/hooks/useDesignEditor';
import { useVectorTools, type VectorDoc } from '@/workbench/hooks/useVectorTools';
import { PANEL_SELECT as SELECT, PanelToggle, SheetPanel } from '@/workbench/ui/SheetPanel';
import { Banner, CANVAS_BG, EmptyNote, Sheet, SheetSurface } from '@/workbench/ui/SheetShell';
import { DeviceBar } from '@/workbench/ui/DeviceBar';
import { RecipeStyles, themeScope } from '@/workbench/ui/RecipeView';
import { ToolRail, toolsFor } from '@/workbench/ui/ToolRail';
import { VectorArtboard } from '@/workbench/ui/VectorArtboard';
import { VectorBox, VectorRail, VectorToolMenu } from '@/workbench/ui/VectorKit';
import { SelectionBar } from '@/workbench/ui/vector/actions';
import { PAPER, ShadesIcon, WebLayerPips, WebMap } from '@/workbench/ui/web/WebChrome';
import { RouteTree } from '@/workbench/ui/web/RouteTree';
import { PageFields } from '@/workbench/ui/web/PageFields';
import { NoWebProject } from '@/workbench/ui/web/NoWebProject';
import { BlockInspector } from '@/workbench/ui/web/BlockFields';
import { ComponentsBox, LayoutEditor, VariantsBox, type Placing } from '@/workbench/ui/web/LayoutEditor';
import { useBlockActions } from '@/workbench/ui/web/LayoutMenu';
import { LayoutLayer, PinnedLayer, PreviewLayer, WEB_LAYERS, WireframeLayer, pageSketch, sketchHeight, sketchPage, type Placed, type WebLayer } from '@/workbench/ui/web/WebLayers';
import { CodeBox } from '@/workbench/ui/web/CodeBox';
import { GROUP, ROW_HEIGHT, componentOf, placedAt, readingOrder, GRID_GAP, getActivePlacements, hiddenAt, layoutEdit, liveBackdrop, pageInsets, projectTheme, resolvePlacement, safeBackdrop, sketchForWidth, type PageSketch } from '@/lib/project';
import { DEFAULT_VIEWPORT, TIERS, TIER_COLUMNS, tierOf } from '@/lib/devices';
import { addElement, newId, visualBounds, type VElement } from '@/lib/design/vector';
import { pageSize, type DesignPage } from '@/lib/design/types';
import { putAsset } from '@/lib/assets';
import type { SaveResult } from '@/workbench/hooks/useDesignDoc';

// The Web canvas: one page of a web project fills the screen, at the project's device size. The page has three
// layers, bottom to top: wireframe, layout, preview. You work on one; the ones under it show through, faded, like
// tracing paper (see-through). The wireframe is a vector page per breakpoint tier, drawn with Ideation's tools.
// Pages are picked in the panel; the route tree, the page's planning fields and the project's own open in the box
// under the minimap. Projects live in the browser's store (lib/store.ts).

const NEW = '__new__';
const FADE = 0.35;
const LAYER_KEY = 'web:layer';
const WIRE_TOOLS = toolsFor(['select', 'shape', 'text', 'pen', 'erase', 'read']);
const LAYOUT_TOOLS = toolsFor(['select', 'read']);
type Box = 'page' | 'routes' | 'layers' | 'components' | 'variants' | 'code';

const readLayer = (): WebLayer => {
  try { const v = localStorage.getItem(LAYER_KEY); return WEB_LAYERS.some((l) => l.id === v) ? (v as WebLayer) : 'layout'; } catch { return 'layout'; }
};
// Room kept under a wireframe's lowest shape, so the page grows as you draw down it
const roomBelow = (els: VElement[], screen: number) => Math.max(0, ...els.map((e) => { const b = visualBounds(e, els); return b.y + b.h; })) + screen / 2;

// The open workspace project's web project; without one, a note that offers to make it
export function WebCanvas() {
  const has = useWorkbenchStore((s) => !!s.projects[s.lastProjectId]);
  return has ? <WebProjectCanvas /> : <NoWebProject canvas="Web" />;
}

function WebProjectCanvas() {
  const active         = useWorkbenchStore((s) => s.activeScene === 'web');
  const projects       = useWorkbenchStore((s) => s.projects);
  const lastProjectId  = useWorkbenchStore((s) => s.lastProjectId);
  const setActivePage  = useWorkbenchStore((s) => s.setActivePage);
  const setViewport    = useWorkbenchStore((s) => s.setProjectViewport);
  const updateWireframe = useWorkbenchStore((s) => s.updateWireframe);
  const removePlacement = useWorkbenchStore((s) => s.removePlacement);
  const setGeoms = useWorkbenchStore((s) => s.setPlacementGeoms);
  const undoLayout = useWorkbenchStore((s) => s.undoLayout), redoLayout = useWorkbenchStore((s) => s.redoLayout);
  const setInstance     = useWorkbenchStore((s) => s.setPlacementInstance);
  const setPin          = useWorkbenchStore((s) => s.setPlacementPin);
  const resetTier       = useWorkbenchStore((s) => s.resetPlacementTier);

  const pid = lastProjectId;
  const project = projects[pid]!;   // WebCanvas checked
  const page = project.pages.find((p) => p.path === project.activePath) ?? project.pages[0];
  const viewport = project.viewport ?? DEFAULT_VIEWPORT, tier = tierOf(viewport.width), cols = TIER_COLUMNS[tier];

  const [layer, setLayerState] = useState<WebLayer>(readLayer);
  const [seeThrough, setSeeThrough] = useState(true);
  const [box, setBox] = useState<Box | null>(null);
  const wiring = layer === 'wireframe' && !!page, laying = layer === 'layout' && !!page;
  // Layout layer: its tool (select or hand), the block selected, the component being placed
  const [layoutTool, setLayoutTool] = useState<'select' | 'read'>('select');
  const [block, setBlock] = useState<string | null>(null);
  const [placing, setPlacing] = useState<Placing>(null);

  // ── The wireframe: this tier's own sketch, edited as a vector page (draft, undo, autosave into the store) ──
  const own = page ? project.wireframes[page.path]?.[tier] : undefined;
  const shownSketch = page ? sketchForWidth(project.wireframes[page.path], viewport.width) : undefined;   // own, else the nearest tier's
  const base: PageSketch = useMemo(() => own ?? { elements: [], width: viewport.width, deviceId: viewport.deviceId }, [own, viewport.width, viewport.deviceId]);
  const k = viewport.width / base.width;   // its width → the device's
  const wirePage = useMemo(() => (page ? sketchPage(base, page.name, Math.ceil(viewport.height / k)) : null), [base, page, viewport.height, k]);
  const saveWire = useCallback(async (p: DesignPage): Promise<SaveResult> => {
    if (page) updateWireframe(pid, page.path, tier, pageSketch(p, { width: base.width, deviceId: base.deviceId }));
    return { ok: true };
  }, [pid, page, tier, base.width, base.deviceId, updateWireframe]);
  const draft = useFileDraft(`web:${pid}:${page?.path}:${tier}`, wirePage, saveWire);
  // Every edit keeps room under the drawing, so the page grows as you go
  const wdoc: VectorDoc = {
    ...draft,
    apply: (next, key) => {
      const s = pageSize(next), want = Math.ceil(roomBelow(next.elements ?? [], viewport.height / k));
      draft.apply(want > s.height ? { ...next, size: { width: s.width, height: want } } : next, key);
    },
  };
  const vt = useVectorTools({ doc: wdoc, tools: WIRE_TOOLS, enabled: wiring, onDeselect: () => setBox((b) => (b === 'layers' ? b : null)) });
  const { tool, setTool, selected: vsel, select: setVsel } = vt;

  const setLayer = (l: WebLayer) => {
    setLayerState(l); setVsel([]); setTool(l === 'wireframe' ? 'select' : 'read');
    setBlock(null); setPlacing(null); setLayoutTool('select');
    const keeps: Record<WebLayer, Box[]> = { wireframe: ['layers'], layout: ['components', 'variants'], preview: [] };
    if (box && ['layers', 'components', 'variants'].includes(box) && !keeps[l].includes(box)) setBox(null);
    try { localStorage.setItem(LAYER_KEY, l); } catch { /* per-browser convenience only */ }
  };

  // ── Layout and preview: the placements resolved for this tier ──
  const layout = page ? project.layouts[page.path] : undefined;
  const placements = useMemo(() => (layout ? getActivePlacements(layout) : []), [layout]);
  const resolved: Placed[] = useMemo(() => {   // what shows at this tier: not hidden, not inside a hidden group
    const hidden = hiddenAt(placements, tier);
    return placements.filter((p) => !hidden.has(p.id)).map((p) => ({ p, g: resolvePlacement(p, tier) }));
  }, [placements, tier]);
  // Pinned blocks sit over the screen; the grid sits inside the edges they keep clear
  const placed = useMemo(() => resolved.filter(({ p }) => !p.pin), [resolved]);
  const pinned = useMemo(() => resolved.filter(({ p }) => p.pin), [resolved]);
  const gridPlacements = useMemo(() => placements.filter((p) => !p.pin), [placements]);
  const ins = useMemo(() => pageInsets(placements, tier), [placements, tier]);
  const colWidth = (viewport.width - ins.left - ins.right) / cols;
  const backdrop = (page && safeBackdrop(page.backdrop)) ?? safeBackdrop(project.meta.backdrop);
  const live = liveBackdrop(page, project.meta);
  const picked = placements.find((p) => p.id === block);
  const numbers = useMemo(() => readingOrder(placements, tier), [placements, tier]);
  const blockActions = useBlockActions({ pid, path: page?.path ?? '', placements, tier, select: setBlock });
  const recipes = useMemo(() => Object.values(project.components ?? {}).map((c) => c.recipe), [project.components]);

  // The page is as tall as the device's screen, or longer when its layout or wireframe runs past the fold
  const rows = Math.max(0, ...placed.filter(({ p }) => !p.parent).map(({ g }) => g.row + g.rowSpan));
  const [gridH, setGridH] = useState(0);   // the grid's real height (rows grow with their content), from the layer drawing it
  const wireH = wiring && draft.shown ? pageSize(draft.shown).height * k : shownSketch ? (sketchHeight(shownSketch) * viewport.width) / shownSketch.width : 0;
  const sheet = { width: viewport.width, height: Math.ceil(Math.max(viewport.height, ins.top + ins.bottom + (rows + (laying ? 8 : 2)) * (ROW_HEIGHT + GRID_GAP), gridH + (laying ? 8 * (ROW_HEIGHT + GRID_GAP) : 0), wireH)) };   // room to place below on the layout
  const { width: W, height: H } = sheet;

  const sv = useSheetView({
    sheet, active, panOnDrag: wiring ? tool === 'read' : laying ? layoutTool === 'read' && !placing : true,
    onKey: (e) => {   // 1, 2, 3: the layers; on the wireframe, the drawing keys; on the layout, V / H, Delete, Escape
      const i = ['1', '2', '3'].indexOf(e.key);
      if (i >= 0 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setLayer(WEB_LAYERS[i].id); return; }
      if (wiring) return vt.onKey(e);
      if (laying && (e.ctrlKey || e.metaKey) && !e.altKey && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {   // undo / redo a layout edit
        e.preventDefault();
        const back = e.key.toLowerCase() === 'z' && !e.shiftKey, path = back ? undoLayout(pid) : redoLayout(pid);
        if (path && page && path !== page.path) setActivePage(pid, path);   // the step was on another page: show it
        return;
      }
      if (laying && block && page && (e.ctrlKey || e.metaKey) && !e.altKey) {   // the menu's keys: duplicate, group, ungroup
        const k = e.key.toLowerCase();
        if (k === 'd') { e.preventDefault(); blockActions.duplicate(block); return; }
        if (k === 'g') { e.preventDefault(); if (e.shiftKey) blockActions.ungroup(block); else blockActions.wrap(block); return; }
      }
      if (!laying || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') { setPlacing(null); setBlock(null); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && block && page) { e.preventDefault(); removePlacement(pid, page.path, block); setBlock(null); }
      else if (e.key.startsWith('Arrow') && block && page) {   // nudge the block a column / row; Shift: resize it
        const p = gridPlacements.find((x) => x.id === block);
        if (!p) return;
        e.preventDefault();
        const g = placedAt(gridPlacements, p, tier), d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key] ?? [0, 0];
        const patch = e.shiftKey ? { colSpan: g.colSpan + d[0], rowSpan: g.rowSpan + d[1] } : { col: g.col + d[0], row: g.row + d[1] };
        const edits = layoutEdit(gridPlacements, tier, p.id, patch, false);
        if (edits.length) setGeoms(pid, page.path, tier, edits);
      }
      else if (e.key.toLowerCase() === 'v') setLayoutTool('select');
      else if (e.key.toLowerCase() === 'h') setLayoutTool('read');
    },
    onCtrlWheel: (dir) => {   // Ctrl + wheel: up a layer toward the preview, down toward the wireframe
      const next = WEB_LAYERS[WEB_LAYERS.findIndex((l) => l.id === layer) - dir];
      if (next) setLayer(next.id);
    },
  });
  const { view, fit } = sv;
  useEffect(() => { fit(); }, [pid, page?.path, viewport.width, viewport.height, fit]);
  useEffect(() => { setVsel([]); setBlock(null); setPlacing(null); }, [pid, page?.path, tier]); // eslint-disable-line react-hooks/exhaustive-deps -- setters are stable

  // A reference image on the wireframe, kept in this browser (IndexedDB), at its own proportions
  const addImage = async (file: File) => {
    const cur = draft.current.current;
    if (!cur) return;
    const id = await putAsset(file, 'wire'), bmp = await createImageBitmap(file).catch(() => null);
    const w = Math.round(base.width * 0.8), h = bmp ? Math.round((w * bmp.height) / bmp.width) : Math.round(w * 0.6);
    const eid = newId('image'), top = Math.max(0, (-view.y / view.scale) / k + 40);
    vt.apply(addElement(draft.current.current ?? cur, { id: eid, type: 'image', src: `idb:${id}`, x: Math.round((base.width - w) / 2), y: Math.round(top), w, h, fit: 'contain' }));
    setVsel([eid]); setTool('select');
  };

  // The layers under the one you're on, drawn over it faded so they show through even an opaque preview
  const below = WEB_LAYERS.slice(0, WEB_LAYERS.findIndex((l) => l.id === layer)).map((l) => l.id);
  const draw = (l: WebLayer, faded: boolean) => {
    const style = faded ? { opacity: FADE } : undefined;
    if (l === 'wireframe') return shownSketch ? <div key={l} className="absolute inset-0 pointer-events-none" style={style}><WireframeLayer sketch={shownSketch} width={W} /></div> : null;
    if (l === 'layout') return (
      <div key={l} className="absolute inset-0 pointer-events-none" style={style}>
        <LayoutLayer pid={pid} placements={gridPlacements} tier={tier} ins={ins} width={W} components={project.components} />
        <PinnedLayer pinned={pinned} cols={cols} width={W} screenH={viewport.height} components={project.components} />
      </div>
    );
    return <PreviewLayer key={l} pid={pid} placements={gridPlacements} tier={tier} pinned={pinned} ins={ins} width={W} height={H} screenH={viewport.height} backdrop={backdrop} live={live} components={project.components} here={page?.path} onHeight={faded ? undefined : setGridH} />;
  };
  const borrowed = wiring && !own && shownSketch;   // no sketch for this tier yet: the nearest tier's shows faded to draw over
  const editing = (wiring && tool !== 'read') || (laying && layoutTool === 'select');
  const empty = !page ? 'No pages yet. Open “routes” under the minimap to add one.'
    : laying && !placements.length && !placing ? 'Nothing placed yet. Open “components” under the minimap, pick one, then click the page.'
    : layer === 'preview' && !placed.length ? 'No components placed on this page yet.' : null;

  const boxContent = (() => {
    if (wiring && draft.shown && (box === 'layers' || vsel.length > 0)) return <VectorBox vt={vt} page={draft.shown} layersOpen={box === 'layers'} apply={wdoc.apply} />;
    if (laying && picked && page) return (
      <BlockInspector
        key={picked.id} placement={picked} number={numbers.get(picked.id)} component={componentOf(project.components, picked)}
        tier={tier} onPatch={(patch) => setInstance(pid, page.path, picked.id, patch)} onPin={(pin) => setPin(pid, page.path, picked.id, tier, pin)} onDeselect={() => setBlock(null)}
      />
    );
    if (laying && box === 'components') return <div className="p-3"><ComponentsBox components={project.components} placements={placements} tier={tier} placing={placing} setPlacing={(c) => { setPlacing(c); if (c) setLayoutTool('select'); }} /></div>;
    if (laying && box === 'variants' && page) return <div className="p-3"><VariantsBox pid={pid} path={page.path} layout={layout} /></div>;
    if (box === 'code' && page) return <CodeBox project={project} page={page} layout={layout} />;
    if (box === 'routes') return <div className="p-3"><RouteTree pid={pid} project={project} /></div>;
    if (box === 'page' && page) return <div className="p-3"><PageFields key={`${pid}:${page.path}`} pid={pid} project={project} page={page} /></div>;
    return undefined;
  })();
  const toggle = (b: Box) => () => { setBox(box === b ? null : b); if (b !== 'layers') setVsel([]); setBlock(null); };

  return (
    <div className={CANVAS_BG}>
      <RecipeStyles scope={themeScope(pid)} theme={projectTheme(project)} recipes={recipes} fonts={project.meta.fonts} />
      <SheetSurface sv={sv} grab={!editing} onBackground={() => { if (editing) { setVsel([]); setBlock(null); } }}>
        {page && (
          <Sheet sv={sv} size={sheet} style={{ background: PAPER }}>
            {wiring && draft.shown ? (
              <>
                {borrowed && <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.25 }}><WireframeLayer sketch={shownSketch} width={W} /></div>}
                <div className="absolute left-0 top-0" style={{ width: base.width, transform: `scale(${k})`, transformOrigin: '0 0' }}>
                  <VectorArtboard
                    bibleId="" bible={null} onOpen={() => {}}
                    page={borrowed ? { ...draft.shown, background: 'transparent' } : draft.shown}
                    edit={editing ? vt.edit({ scale: view.scale * k }) : undefined}
                    penInput={vt.penInput}
                  />
                </div>
              </>
            ) : laying ? (
              <>
                <LayoutEditor
                  pid={pid} path={page.path} placements={gridPlacements} tier={tier} ins={ins} width={W} components={project.components}
                  selected={block} select={setBlock} placing={placing} donePlacing={() => setPlacing(null)} scale={view.scale} editing={layoutTool === 'select'}
                  onHeight={setGridH}
                />
                <PinnedLayer pinned={pinned} cols={cols} width={W} screenH={viewport.height} components={project.components} selected={block} select={layoutTool === 'select' ? setBlock : undefined} />
              </>
            ) : draw(layer, false)}
            {seeThrough && below.map((l) => draw(l, true))}
            {/* the fold: what shows before scrolling */}
            {H > viewport.height && (
              <div className="absolute left-0 right-0 pointer-events-none border-t border-dashed border-indigo-500/50" style={{ top: viewport.height }}>
                <span className="text-[10px] font-mono px-1 text-indigo-500/70">fold</span>
              </div>
            )}
          </Sheet>
        )}
        {empty && <EmptyNote over>{empty}</EmptyNote>}
      </SheetSurface>

      {wiring && <VectorRail vt={vt} tools={WIRE_TOOLS} addImage={{ title: 'Add a reference image (kept in this browser)', add: addImage }} />}
      {laying && (
        <ToolRail tools={LAYOUT_TOOLS} tool={layoutTool} pick={(t) => { if (t === 'select' || t === 'read') setLayoutTool(t); }} />
      )}
      {laying && !placing && tier !== 'mobile' && (() => {   // which size the edits land on, and a way back to inheriting
        const own = placements.filter((p) => p.at?.[tier]).length, label = TIERS.find((t) => t.id === tier)!.label;
        return (
          <Banner tone="hint">
            Editing {label}: changes apply from {label} up; the rest follows the smaller sizes.{own > 0 && <> {own} block{own > 1 ? 's' : ''} placed for {label} · <button className="underline hover:text-amber-100" onClick={() => resetTier(pid, page!.path, null, tier)}>inherit them again</button></>}
          </Banner>
        );
      })()}
      {laying && placing && <Banner tone="hint">Placing “{placing === GROUP ? "Group" : project.components?.[placing]?.recipe.name}”: click the page (or inside a group). Esc stops.</Banner>}
      {wiring && <VectorToolMenu vt={vt} tools={WIRE_TOOLS} page={draft.shown} />}
      {wiring && vt.blocked(true) && <Banner>{vt.blocked(true)}</Banner>}

      {active && (
        <SheetPanel
          sv={sv} page={null}
          undo={draft.undo} redo={draft.redo} canUndo={wiring && draft.canUndo} canRedo={wiring && draft.canRedo}
          pickers={
            <>
              <select
                value={page?.path ?? ''} className={SELECT} title="Page"
                onChange={(e) => { const v = e.target.value; e.target.blur(); if (v === NEW) setBox('routes'); else setActivePage(pid, v); }}
              >
                {!page && <option value="">—</option>}
                {project.pages.map((p) => <option key={p.path} value={p.path} className="bg-neutral-900">{p.name} · {p.path}</option>)}
                <option value={NEW} className="bg-neutral-900">+ New page…</option>
              </select>
            </>
          }
          row={<DeviceBar compact value={viewport} onChange={(v) => setViewport(pid, v)} className="px-0.5" />}
          controls={
            <>
              <span className="text-[9px] font-mono text-neutral-500" title={borrowed ? `No ${tier} wireframe yet: drawing starts one; the faded one is from another tier` : 'Breakpoint tier and its column grid'}>
                {TIERS.find((t) => t.id === tier)!.label} · {cols} cols{borrowed ? ' · new' : ''}
              </span>
              {wiring && <PanelToggle on={vt.gridOn} onClick={() => vt.setGridOn(!vt.gridOn)} title="Show the snapping grid (G)">grid</PanelToggle>}
              <PanelToggle on={seeThrough} onClick={() => setSeeThrough(!seeThrough)} title="See-through: the layers under this one show faded, like tracing paper"><span className="sr-only">see-through</span><ShadesIcon /></PanelToggle>
            </>
          }
          map={<WebMap width={W} height={H} wire={wiring ? draft.shown?.elements : shownSketch?.elements} k={wiring ? k : shownSketch ? W / shownSketch.width : 1} placed={placed} colWidth={colWidth} sv={sv} layer={layer} />}
          rail={<WebLayerPips layer={layer} setLayer={setLayer} />}
          panels={
            <>
              <PanelToggle on={box === 'page'} onClick={toggle('page')} title="This page: name, status, intent, head / SEO, notes">page</PanelToggle>
              <PanelToggle on={box === 'routes'} onClick={toggle('routes')} title="The project's pages as a route tree: open, add, delete">routes</PanelToggle>
              {page && <PanelToggle on={box === 'code'} onClick={toggle('code')} title="This page's output: plain HTML or a Next.js page. Copy, download, open in a tab">code</PanelToggle>}
              {wiring && <PanelToggle on={box === 'layers'} onClick={toggle('layers')} title="The wireframe's layers: draw on one, hide or lock others">layers</PanelToggle>}
              {laying && <PanelToggle on={box === 'components'} onClick={toggle('components')} title="This project's components: pick one, then click the page to place it">components</PanelToggle>}
              {laying && <PanelToggle on={box === 'variants'} onClick={toggle('variants')} title="Alternative layouts of this page">variants</PanelToggle>}
            </>
          }
          belowAux={wiring && <SelectionBar page={draft.shown} selected={vt.selected} host={vt} />}
          below={boxContent}
        />
      )}
    </div>
  );
}
