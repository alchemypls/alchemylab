"use client";

import { useRef, useState, type MutableRefObject } from 'react';
import { useSheetPen } from './useSheetPen';
import { useToolStyles } from './useToolStyles';
import { useVault } from './useVault';
import { footingOf } from '@/lib/design/vault';
import { copyElements, duplicateElements, gridOf, groupElements, pasteElements, ungroupElements, regridZones, removeElements, SNAP, tenants, translateElements, updateElement, type FootingOf, type Lattice, type VElement } from '@/lib/design/vector';
import { favoritePatch, type Favorites, type ShapeKind, type ToolStyles, type ZoneTool } from '@/lib/design/toolStyles';
import { pageSize, type DesignPage } from '@/lib/design/types';
import { layersOf, stampLayer } from '@/lib/design/layers';
import type { PagePen, VectorEdit, VTool } from '@/workbench/ui/VectorArtboard';
import type { RailTool, ToolKey } from '@/workbench/ui/ToolRail';
import { getClip, putClip } from '@/workbench/ui/vector/clipboard';

// Everything the vector drawing tools need on a canvas: the tool in hand, the selection, the tool menu's
// changes, the tablet pen and the drawing keys. A canvas supplies the page and how to edit it.

const DRAW_TOOLS: ToolKey[] = ['select', 'shape', 'text', 'zone', 'asset', 'pen', 'erase'];
export const LAYERS_BLOCKED = 'Every layer is hidden or locked. Show or unlock one to draw.';

const SHAPE_HOTKEYS: Record<string, ShapeKind> = { r: 'rect', o: 'ellipse', c: 'capsule', l: 'line', a: 'arrow' };

export interface VectorDoc {
  shown: DesignPage | null;
  current: MutableRefObject<DesignPage | null>;   // latest draft, including edits not yet rendered
  apply: (next: DesignPage, key?: string) => void;
  undo: () => void;
  redo: () => void;
}

export function useVectorTools({ doc, tools, enabled, onDeselect }: {
  doc: VectorDoc;
  tools: RailTool[];
  enabled: boolean;   // the page is a vector page: drawing and the pen are available
  onDeselect?: () => void;   // Escape and the Read tool also clear whatever else the canvas has selected
}) {
  const { shown, current } = doc;
  const [tool, setTool] = useState<ToolKey>('read');
  // The layer new things go on: the one picked, else the top one that can be drawn on
  const [layerPick, setLayerPick] = useState<string>();
  // The layer the minimap focuses on (others dim), or null for all of them. Picking a layer moves the focus with it.
  const [mapLayer, setMapLayer] = useState<string | null>(null);
  const setLayer = (id: string) => { setLayerPick(id); setMapLayer((m) => (m ? id : m)); };
  const layers = layersOf(shown), usable = layers.filter((l) => !l.hidden && !l.locked);
  const layer = (usable.find((l) => l.id === layerPick) ?? usable[usable.length - 1])?.id;
  // Ctrl + wheel walks the minimap's layer pips (all layers, then top to bottom; down = +1), the same as clicking them:
  // the map focuses on the layer and you draw on it. Stops at the ends; a page without its own layers has no pips.
  const stepLayer = (d: 1 | -1) => {
    if (!shown?.layers?.length) return;
    const pips = [null, ...[...layers].reverse().map((l) => l.id)];
    const next = pips[Math.max(0, pips.indexOf(mapLayer)) + d];
    if (next === undefined) return;
    setMapLayer(next);
    if (next) setLayerPick(next);
  };
  // Every edit through here puts what it adds on that layer. Canvases pass this to the artboard.
  const apply = (next: DesignPage, key?: string) => doc.apply(stampLayer(current.current, next, layer), key);
  const [selected, select] = useState<string[]>([]);
  const vault = useVault().entries;
  const footing: FootingOf = (e) => { if (e.type !== 'asset') return undefined; const a = vault.find((v) => v.id === e.asset)?.asset; return a && footingOf(a, undefined, e); };
  const [gridOn, setGridOn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const styles = useToolStyles();
  const penInput = useRef<((s: PagePen) => void) | null>(null);

  // Touching the tip down while reading picks the pen tool, so the page always gets what lands on the paper.
  const pen = useSheetPen(enabled, pageSize(shown), (s) => {
    if (s.down && tool === 'read') setTool('pen');
    penInput.current?.(s);
  });

  // A press (key or rail click) picks the tool; pressing the tool already in hand opens or closes its menu
  const pickTool = (t: ToolKey) => {
    if (t === tool) setMenuOpen((o) => !o);
    setTool(t);
    if (t !== 'pen' && pen.calibrating) pen.toggleCalibrate();
    if (t === 'read') { select([]); onDeselect?.(); }
  };

  // A tool's menu sets only what that tool makes next. What's already drawn changes in its properties (the inspector).
  const changeTool = <K extends keyof ToolStyles>(t: K, patch: Partial<ToolStyles[K]>) => styles.setStyle(t, patch);
  // Floors follow the page's grid, so changing it redraws every floor (and what stands on it)
  const setGrid = (patch: Partial<Lattice>) => {
    const cur = current.current;
    if (cur) apply(regridZones({ ...cur, grid: { ...cur.grid, ...patch } }, footing), `grid:${Object.keys(patch).join()}`);
  };
  // A favorite sets the tool and restyles what's selected (only its look: see favoritePatch). The one toolbar pick that
  // touches the selection: everything else in a tool's menu only sets the next thing it makes.
  const restyle = (page: DesignPage, t: keyof Favorites, style: object) => {
    let next = page;
    for (const el of page.elements ?? []) {
      if (!selected.includes(el.id)) continue;
      const p = favoritePatch(el, t, style);
      if (p) next = updateElement(next, el.id, p as Partial<VElement>);
    }
    return next;
  };
  const applyFavorite = (t: keyof Favorites, style: object) => {
    const cur = current.current;
    if (t === 'zone') {
      // A favorite floor carries its tile size and view, which belong to the page's grid
      const { cell, flat, ...rest } = style as ZoneTool;
      const cleared = { fill: undefined, stroke: undefined, dash: undefined, noLines: undefined, ...rest };
      const grid = cell ? { cell, flat } : {};   // a favorite saved without them leaves the grid alone
      styles.setStyle('zone', cleared);
      if (!cur) return;
      const next = restyle(cell ? regridZones({ ...cur, grid: { ...cur.grid, ...grid } }, footing) : cur, 'zone', cleared);
      if (next !== cur) apply(next, 'favorite:zone');
      return;
    }
    const cleared = t === 'shape' ? { fill: undefined, stroke: undefined, dash: undefined, hollow: undefined } : { caps: undefined, bg: undefined, bgShape: undefined };
    changeTool(t, { ...cleared, ...style } as Partial<ToolStyles[typeof t]>);
    if (!cur) return;
    const next = restyle(cur, t, { ...cleared, ...style });
    if (next !== cur) apply(next, `favorite:${t}`);
  };
  const saveFavorite = (t: keyof Favorites) => {
    const name = window.prompt('Name this favorite');
    if (!name?.trim()) return;
    const style = t === 'zone' ? { ...styles.styles.zone, ...(current.current ? gridOf(current.current) : {}) } : styles.styles[t];
    styles.addFavorite(t, name.trim(), style);
  };

  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
    const done = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    const cur = current.current;
    const has = (t: ToolKey) => tools.some((x) => x.key === t);
    if (mod && k === 'z') { done(); (e.shiftKey ? doc.redo : doc.undo)(); return; }
    if (mod && k === 'y') { done(); doc.redo(); return; }
    // Copy, cut and paste, between pages too (vector/clipboard); Ctrl+G welds the selection into a group, Ctrl+Shift+G takes it apart
    if (mod && enabled && cur && ['c', 'x', 'v', 'g'].includes(k)) {
      if (k === 'v') { const clip = getClip(); if (!clip) return; done(); const r = pasteElements(cur, clip); apply(r.page); select(r.ids); return; }
      if (!selected.length) return;
      done();
      if (k === 'g') { apply((e.shiftKey ? ungroupElements : groupElements)(cur, selected)); return; }
      putClip(copyElements(cur, selected));
      if (k === 'x') { apply(removeElements(cur, selected)); select([]); }
      return;
    }
    if (k === 'escape') { done(); select([]); onDeselect?.(); if (tool !== 'read' && has('select')) setTool('select'); return; }
    if (!mod && k === 'g' && enabled) { done(); setGridOn((on) => !on); return; }
    if (!mod && enabled && has('shape') && SHAPE_HOTKEYS[k]) { done(); changeTool('shape', { kind: SHAPE_HOTKEYS[k] }); setTool('shape'); return; }
    if (!mod) {
      const t = tools.find((x) => x.hotkey === k);
      if (t) { done(); pickTool(t.key); return; }
    }
    if (!cur || !enabled) return;
    const arrows: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
    if (mod && k === 'd' && selected.length) { done(); const r = duplicateElements(cur, selected); apply(r.page); select(r.ids); }
    else if ((k === 'delete' || k === 'backspace') && selected.length) { done(); apply(removeElements(cur, selected)); select([]); }
    else if (arrows[k] && selected.length) {
      done();
      const all = cur.elements ?? [], times = e.shiftKey ? 5 : 1, [dx, dy] = arrows[k];
      // A floor nudges along the grid, so it still fits the floors around it, and takes what stands on it
      if (all.some((x) => x.type === 'zone' && selected.includes(x.id))) {
        const g = gridOf(cur);
        apply(translateElements(cur, all, [...selected, ...tenants(all, selected, footing).filter((t) => !selected.includes(t))], dx * times * (g.flat ? g.cell : 2 * g.cell), dy * times * g.cell), 'nudge');
      } else {
        apply(translateElements(cur, all, selected, dx * times * SNAP, dy * times * SNAP), 'nudge');
      }
    }
  };

  const placed = () => { if (tools.some((x) => x.key === 'select')) setTool('select'); };   // after a shape, text box or zone: back to select

  // What a canvas hands VectorArtboard: nothing while reading or when no layer can be drawn on (look only)
  const edit = (o: { scale: number; tool?: ToolKey; placing?: VectorEdit['placing']; eraseAll?: boolean }): VectorEdit | undefined => {
    const t = o.tool ?? tool;
    if (!layer || !DRAW_TOOLS.includes(t)) return undefined;
    return { tool: t as VTool, selected, select, apply, scale: o.scale, showGrid: gridOn, styles: styles.styles, placing: o.placing, eraseAll: o.eraseAll, placed };
  };
  // A layer picked on the minimap's pips: the map focuses on it (null: all of them) and new things go on it
  const focusLayer = (id: string | null) => { setMapLayer(id); if (id) setLayerPick(id); };
  // Why nothing can be drawn right now, for the canvas's banner (drawing: a vector page is open)
  const blocked = (drawing: boolean) => (pen.error ? `Pen: ${pen.error}` : drawing && !layer ? LAYERS_BLOCKED : null);

  return {
    apply, layer, setLayer, stepLayer, mapLayer, setMapLayer, focusLayer, edit, blocked, placed,
    tool, setTool, pickTool, selected, select, gridOn, setGridOn, menuOpen, setMenuOpen,
    styles: styles.styles, favorites: styles.favorites, removeFavorite: styles.removeFavorite,
    pen, penInput, changeTool, setGrid, applyFavorite, saveFavorite, onKey,
  };
}
