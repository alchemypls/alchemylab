"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useWorkbenchStore } from '@/lib/store';
import { useFileDraft } from '@/workbench/hooks/useDesignEditor';
import { useSheetView } from '@/workbench/hooks/useSheetView';
import { createAsset, saveAsset, useVault } from '@/workbench/hooks/useVault';
import { blockFloor, isStructure, partOf, type VaultAsset } from '@/lib/design/vault';
import {
  addLevel, addRoof, setRoofs, objFp, turnObjects, builtStructure, WALL_VIEWS, type WallView, clearTiles, edgeKey, fillTiles, fitFootprint, floorNewRooms, levelBase, levelEmpty, LEVELS_MAX, movePieces, paintFloors,
  paintWalls, parseKey, pieceAt, pieceId, piecesIn, placeObject, removeLevel, removePieces, roomAt, spanOf, structureOf, structureSize, swapPieces,
  tileKey, wallEdges, type Piece, type PieceKind, type Span, type Structure,
} from '@/lib/design/structure';
import { fromGrid, toGrid, type Pt } from '@/lib/design/vector';
import { PITCH_MAX, ROOF_OVER, ROOF_PITCH, ROOF_SHAPES, type Roof, type RoofShape } from '@/lib/design/roof';
import { Element } from '@/workbench/ui/vector/shapes';
import { toPoints } from '@/workbench/ui/vector/gesture';
import { ACCENT } from '@/workbench/ui/DesignArtboard';
import { Banner, CANVAS_BG, EmptyNote, SaveDot, Sheet, SheetSurface } from '@/workbench/ui/SheetShell';
import { MAP_RAIL, PANEL_SELECT, PanelToggle, SheetPanel } from '@/workbench/ui/SheetPanel';
import { menuTop, ToolRail, toolsFor, type ToolKey } from '@/workbench/ui/ToolRail';
import { AssetThumb } from '@/workbench/ui/AssetPicker';
import { AssetFile } from '@/workbench/ui/fab/AssetFile';
import { EditorPicker, EDITORS } from '@/workbench/ui/fab/EditorPicker';
import { VAULT_DRAG } from '@/workbench/shell/FileVault';
import { askConfirm, askText } from '@/workbench/ui/Ask';

// Fab's Structures editor: a set piece built Sims style from the vault's atoms, on a grid. The vault is the catalog: pick
// a floor or a wall there and it's the brush (Floors: drag over tiles, Shift-click a room; Walls: drag along grid lines,
// Shift for a whole room); pick an object and each click on a tile stands one there (Esc stops); or drag any of them onto
// the sheet. Select picks floors, walls and objects (Shift adds, drag on empty ground for a box), drags them by whole
// tiles, Del deletes them, and a vault pick of the same part swaps it in. The eraser takes walls when pressed on a grid
// line, floors and objects otherwise. Levels stack on the pips left of the minimap (PgUp / PgDn, Ctrl + wheel): the ones
// below show, the ones above don't. What's saved is data (lib/design/structure.ts); the drawing is built from the atoms.

const TOOLS = EDITORS.find((e) => e.id === 'structures')!.tools;
type G = { a: number; b: number };
type Drag =
  | { kind: 'paint'; tool: ToolKey; start: G; cur: G; line: boolean; room: boolean }
  | { kind: 'marquee'; start: G; cur: G; add: boolean }
  | { kind: 'move'; from: G; da: number; db: number };
const NO_DOC = { title: '', blocks: [], elements: [] };
const KIND_OF: Partial<Record<string, PieceKind>> = { floor: 'floor', wall: 'wall', object: 'object', roof: 'roof' };
type RoofOpts = Pick<Roof, 'shape' | 'pitch' | 'over' | 'along' | 'flip'>;
const BTN = 'px-1.5 py-0.5 rounded border text-[10px]';

// A roof's shape and slope: for the next roof (Roof tool) or the picked ones (Select)
function RoofFields({ v, set }: { v: RoofOpts; set: (patch: Partial<RoofOpts>) => void }) {
  const pick = (on: boolean) => `${BTN} ${on ? 'border-amber-400 text-amber-300 bg-amber-500/10' : 'border-neutral-700 text-neutral-400 hover:bg-neutral-800'}`;
  const row = 'flex flex-wrap items-center gap-1';
  return (
    <div className="flex flex-col gap-2 text-[10px] text-neutral-400">
      <div className={row}>{ROOF_SHAPES.map((sh: RoofShape) => <button key={sh} className={pick(v.shape === sh)} onClick={() => set({ shape: sh })}>{sh}</button>)}</div>
      {v.shape !== 'flat' && <label className="flex items-center gap-2">pitch
        <input type="range" min={0.1} max={PITCH_MAX} step={0.05} value={v.pitch ?? ROOF_PITCH} onChange={(e) => set({ pitch: Number(e.target.value) })} className="flex-1 accent-amber-400" />
        <span className="w-7 text-right font-mono">{(v.pitch ?? ROOF_PITCH).toFixed(2)}</span></label>}
      <label className="flex items-center gap-2">overhang
        <input type="range" min={0} max={1} step={0.125} value={v.over ?? ROOF_OVER} onChange={(e) => set({ over: Number(e.target.value) })} className="flex-1 accent-amber-400" />
        <span className="w-7 text-right font-mono">{(v.over ?? ROOF_OVER).toFixed(2)}</span></label>
      {(v.shape === 'gable' || v.shape === 'shed') && <div className={row}>
        <span>{v.shape === 'gable' ? 'ridge' : 'rises'}</span>
        <button className={pick(!v.along)} onClick={() => set({ along: undefined })} title="Along the longer side">auto</button>
        <button className={pick(v.along === 'a')} onClick={() => set({ along: 'a' })} title="Along the columns (down-right)">↘</button>
        <button className={pick(v.along === 'b')} onClick={() => set({ along: 'b' })} title="Along the rows (down-left)">↙</button>
        {v.shape === 'shed' && <button className={pick(!!v.flip)} onClick={() => set({ flip: !v.flip || undefined })} title="Rise the other way">flip</button>}
      </div>}
    </div>
  );
}

export function StructureCanvas() {
  const active = useWorkbenchStore((s) => s.activeScene === 'fab');
  const fabFile = useWorkbenchStore((s) => s.fabAsset), setFabFile = useWorkbenchStore((s) => s.setFabAsset);
  const armed = useWorkbenchStore((s) => s.vaultArmed), setArmed = useWorkbenchStore((s) => s.setVaultArmed);
  const { entries, loaded } = useVault();
  const structures = entries.filter((e) => isStructure(e.asset));
  const entry = structures.find((e) => e.id === fabFile);
  const atomOf = useCallback((id: string) => entries.find((e) => e.id === id)?.asset, [entries]);

  // The open file isn't a structure: open the last one here, else the first
  const last = useRef<string>();
  if (entry) last.current = entry.id;
  useEffect(() => {
    if (!loaded || entry) return;
    const next = structures.find((e) => e.id === last.current) ?? structures[0];
    if (next) setFabFile(next.id);
  }, [loaded, entry, structures, setFabFile]);

  const saveFile = useCallback((a: VaultAsset) => saveAsset(entry?.id ?? '', a), [entry?.id]);
  const file = useFileDraft(entry?.id ?? '', entry?.asset ?? null, saveFile);
  const st = file.shown;
  const s = st ? structureOf(st) : null;
  // Every change keeps the structure inside its footprint and the sheet big enough for its levels
  const apply = useCallback((next: VaultAsset, key?: string) => {
    const fp = next.footprint ?? { cols: 1, rows: 1 }, structure = fitFootprint(structureOf(next), fp.cols, fp.rows);
    file.apply({ ...next, structure, size: structureSize(fp, structure, blockFloor(next).cell) }, key);
  }, [file]);
  const set = (next: Structure, key?: string) => st && apply({ ...st, structure: next }, key);

  const [tool, setTool] = useState<ToolKey>('select');
  const [level, setLevel] = useState(0);
  const [brush, setBrush] = useState<{ floor?: string; wall?: string; roof?: string }>({});
  const [roofOpts, setRoofOpts] = useState<RoofOpts>({ shape: 'gable' });
  const [showRoofs, setShowRoofs] = useState(true);
  const [wallView, setWallView] = useState<WallView>('up');   // C cycles: up, cut (see into rooms), down
  const [sel, setSel] = useState<Piece[]>([]);
  const [menuOpen, setMenuOpen] = useState(true);
  const [fileOpen, setFileOpen] = useState(false);
  const [above, setAbove] = useState(false);   // show the levels above the one being built
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<(G & { line: boolean; shift?: boolean }) | null>(null);
  const lv = Math.min(level, (s?.levels.length ?? 1) - 1);
  const fp = st?.footprint ?? { cols: 1, rows: 1 };
  useEffect(() => { setLevel(0); setDrag(null); setSel([]); }, [entry?.id]);
  useEffect(() => { setSel([]); }, [lv]);
  useEffect(() => () => setArmed(null), [setArmed]);   // leaving: nothing stays armed for Ideation

  const firstOf = (p: string) => entries.find((e) => partOf(e.asset) === p)?.id;
  const floorBrush = brush.floor && atomOf(brush.floor) ? brush.floor : firstOf('floor');
  const wallBrush = brush.wall && atomOf(brush.wall) ? brush.wall : firstOf('wall');
  const roofBrush = brush.roof && atomOf(brush.roof) ? brush.roof : firstOf('roof');
  const placing = armed && partOf(atomOf(armed) ?? ({} as VaultAsset)) === 'object' ? armed : null;

  // A vault pick: with a selection of that part, swap it in; a floor or wall becomes the brush; an object stays armed
  useEffect(() => {
    const a = armed ? atomOf(armed) : undefined, part = a && partOf(a);
    if (!armed || !a || !s) return;
    const kind = KIND_OF[part ?? ''];
    if (tool === 'select' && kind && sel.some((p) => p.kind === kind)) { set(swapPieces(s, lv, sel, kind, armed)); setArmed(null); return; }
    if (part === 'floor') { setBrush((b) => ({ ...b, floor: armed })); setTool('tile'); setArmed(null); }
    else if (part === 'wall') { setBrush((b) => ({ ...b, wall: armed })); setTool('wall'); setArmed(null); }
    else if (part === 'roof') { setBrush((b) => ({ ...b, roof: armed })); setTool('roof'); setArmed(null); }
    else if (part !== 'object') setArmed(null);
  }, [armed]); // eslint-disable-line react-hooks/exhaustive-deps -- reacts to the pick only

  // Moving shows the structure as it would land
  const shownS = useMemo(() => (s && drag?.kind === 'move' ? movePieces(s, lv, sel, drag.da, drag.db, fp.cols, fp.rows, atomOf) : null), [s, drag, sel, lv, fp.cols, fp.rows, atomOf]);
  const shownSt = st && shownS ? { ...st, structure: shownS.s } : st;
  const built = useMemo(() => (shownSt ? builtStructure(shownSt, atomOf, above ? undefined : lv + 1, { roofs: showRoofs, walls: wallView }) : null), [shownSt, atomOf, above, lv, showRoofs, wallView]);
  const sheet = st?.size ?? { width: 1024, height: 1024 };
  const f = st ? blockFloor(st) : null, cell = f?.cell ?? 64, O = f?.corners[0] ?? { x: 0, y: 0 };
  const z = s ? levelBase(s, lv) : 0, top = z + (s?.levels[lv]?.h ?? 0);   // this level's floor and its walls' top, tiles up
  const at = (a: number, b: number, up = z): Pt => { const p = fromGrid({ cell }, { a, b }); return { x: O.x + p.x, y: O.y + p.y - up * cell }; };

  const remove = () => { if (s && sel.length) { set(removePieces(s, lv, sel)); setSel([]); } };
  const stepLevel = (d: 1 | -1) => s && setLevel((l) => Math.max(0, Math.min(s.levels.length - 1, Math.min(l, s.levels.length - 1) - d)));   // wheel up = level up
  const onKey = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); (e.shiftKey ? file.redo : file.undo)(); return; }
    if (mod && k === 'y') { e.preventDefault(); file.redo(); return; }
    if (mod) return;
    if (e.key === 'Escape') { if (drag) setDrag(null); else if (placing) setArmed(null); else setSel([]); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) { e.preventDefault(); remove(); return; }
    if ((k === ',' || k === '.') && s && sel.some((p) => p.kind === 'object')) { set(turnObjects(s, lv, sel, k === '.' ? 1 : -1, fp.cols, fp.rows, atomOf)); return; }
    if (k === 'c') { setWallView(WALL_VIEWS[(WALL_VIEWS.indexOf(wallView) + 1) % WALL_VIEWS.length]); return; }
    if (e.key === 'PageUp') { e.preventDefault(); stepLevel(-1); return; }
    if (e.key === 'PageDown') { e.preventDefault(); stepLevel(1); return; }
    const t = toolsFor(TOOLS).find((x) => x.hotkey === k);
    if (t) { setTool(t.key); setMenuOpen(true); setArmed(null); }
  };
  const sv = useSheetView({ sheet, active, panOnDrag: tool === 'read', onKey, onCtrlWheel: s ? stepLevel : undefined });
  const { fit } = sv;
  useEffect(() => { fit(); }, [entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- each file opens fitted

  // ── Pointer → the grid on the level being built ──
  const svgRef = useRef<SVGSVGElement>(null);
  const gridAt = (e: { clientX: number; clientY: number }, up = z) => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return toGrid({ cell }, { x: p.x - O.x, y: p.y - O.y + up * cell });
  };
  const clampTile = (t: G) => ({ a: Math.max(0, Math.min(fp.cols - 1, Math.floor(t.a))), b: Math.max(0, Math.min(fp.rows - 1, Math.floor(t.b))) });
  const clampCorner = (t: G) => ({ a: Math.max(0, Math.min(fp.cols, Math.round(t.a))), b: Math.max(0, Math.min(fp.rows, Math.round(t.b))) });
  const nearLine = (t: G) => Math.min(Math.abs(t.a - Math.round(t.a)), Math.abs(t.b - Math.round(t.b))) < 0.18;
  const spot = (t: G, line: boolean) => (line ? clampCorner(t) : clampTile(t));
  // The grid line nearest a point, as a wall's edge
  const edgeNear = (t: G) => (Math.abs(t.b - Math.round(t.b)) < Math.abs(t.a - Math.round(t.a))
    ? edgeKey(Math.max(0, Math.min(fp.cols - 1, Math.floor(t.a))), Math.max(0, Math.min(fp.rows, Math.round(t.b))), 'a')
    : edgeKey(Math.max(0, Math.min(fp.cols, Math.round(t.a))), Math.max(0, Math.min(fp.rows - 1, Math.floor(t.b))), 'b'));
  const putObject = (id: string, t: G) => {
    if (!s) return;
    const ofp = atomOf(id)?.footprint ?? { cols: 1, rows: 1 }, c = clampTile(t);
    set(placeObject(s, lv, id, Math.max(0, Math.min(c.a, fp.cols - ofp.cols)), Math.max(0, Math.min(c.b, fp.rows - ofp.rows))));
  };

  const down = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || tool === 'read' || sv.spaceHeld || !s) return;
    const t = gridAt(e);
    if (!t) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (placing) return putObject(placing, t);
    if (tool === 'select') {
      const hit = pieceAt(s.levels[lv], t, atomOf, showRoofs ? gridAt(e, top) ?? undefined : undefined), on = hit && sel.some((p) => pieceId(p) === pieceId(hit));
      if (hit && e.shiftKey) { setSel(on ? sel.filter((p) => pieceId(p) !== pieceId(hit)) : [...sel, hit]); return; }
      if (hit) { if (!on) setSel([hit]); setDrag({ kind: 'move', from: t, da: 0, db: 0 }); return; }
      if (!e.shiftKey) setSel([]);
      const c = clampTile(t);
      setDrag({ kind: 'marquee', start: c, cur: c, add: e.shiftKey });
      return;
    }
    if (tool === 'tile' && e.shiftKey) {   // Shift: floor the whole room under the pointer
      const c = clampTile(t), room = roomAt(s.levels[lv], fp.cols, fp.rows, c.a, c.b);
      if (room && floorBrush) set(fillTiles(s, lv, room, floorBrush));
      return;
    }
    const line = tool === 'wall' || (tool === 'erase' && nearLine(t)), p = spot(t, line);
    setDrag({ kind: 'paint', tool, start: p, cur: p, line, room: e.shiftKey });
  };
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    const t = gridAt(e);
    if (!t) return;
    const line = !placing && (tool === 'wall' || (tool === 'erase' && (drag?.kind === 'paint' ? drag.line : nearLine(t))));
    setHover({ ...spot(t, line), line, shift: e.shiftKey });
    if (drag?.kind === 'paint') setDrag({ ...drag, cur: spot(t, drag.line), room: e.shiftKey });
    else if (drag?.kind === 'marquee') setDrag({ ...drag, cur: clampTile(t) });
    else if (drag?.kind === 'move') setDrag({ ...drag, da: Math.round(t.a - drag.from.a), db: Math.round(t.b - drag.from.b) });
  };
  const up = () => {
    if (!drag || !s) return;
    if (drag.kind === 'move') {
      if (shownS && (shownS.da || shownS.db)) {   // the selection follows its pieces to their new tiles
        set(shownS.s);
        const shift = (k: string) => { const p = parseKey(k); return p.d ? edgeKey(p.a + shownS.da, p.b + shownS.db, p.d) : tileKey(p.a + shownS.da, p.b + shownS.db); };
        setSel(sel.map((p) => (p.kind === 'object' ? p : { ...p, key: shift(p.key) })));
      }
    } else if (drag.kind === 'paint' && drag.tool === 'roof') {
      const r = roofSpan(drag.start, drag.cur);
      if (r && roofBrush) { set(addRoof(s, lv, { ...r, atom: roofBrush, ...roofOpts })); setShowRoofs(true); }
    } else if (drag.kind === 'marquee') {
      const got = piecesIn(s.levels[lv], spanOf(drag.start, drag.cur)), ids = new Set(sel.map(pieceId));
      setSel(drag.add ? [...sel, ...got.filter((p) => !ids.has(pieceId(p)))] : got);
    } else {
      const span = spanOf(drag.start, drag.cur);
      if (drag.tool === 'tile') { if (floorBrush) set(paintFloors(s, lv, span, floorBrush)); }
      else if (drag.tool === 'wall') {   // a room it closes comes floored, with the floor brush
        const next = wallBrush && paintWalls(s, lv, wallEdges(drag.start, drag.cur, drag.room), wallBrush);
        if (next) set(floorBrush ? floorNewRooms(s, next, lv, fp.cols, fp.rows, floorBrush) : next);
      }
      else if (drag.tool === 'erase') set(drag.line ? paintWalls(s, lv, wallEdges(drag.start, drag.cur, drag.room), null) : clearTiles(s, lv, span));
    }
    setDrag(null);
  };
  // A vault file dropped on the sheet: a floor on the tile, a wall on the nearest grid line, an object standing there
  const dropped = (e: React.DragEvent) => {
    const id = e.dataTransfer.getData(VAULT_DRAG), a = id && atomOf(id), t = gridAt(e);
    if (!a || !t || !s) return;
    e.preventDefault();
    const part = partOf(a);
    if (part === 'floor') { const c = clampTile(t); set(paintFloors(s, lv, { a0: c.a, b0: c.b, a1: c.a, b1: c.b }, id)); setBrush((b) => ({ ...b, floor: id })); }
    else if (part === 'wall') { set(paintWalls(s, lv, [edgeNear(t)], id)); setBrush((b) => ({ ...b, wall: id })); }
    else if (part === 'object') putObject(id, t);
  };

  // A roof's tiles: a click covers the room under it (its bounding box), a drag the box dragged
  const roofSpan = (p: G, q: G): Span | undefined => {
    if (p.a !== q.a || p.b !== q.b || !s) return spanOf(p, q);
    const room = roomAt(s.levels[lv], fp.cols, fp.rows, p.a, p.b);
    if (!room) return spanOf(p, q);
    const ts = room.map(parseKey);
    return { a0: Math.min(...ts.map((t) => t.a)), b0: Math.min(...ts.map((t) => t.b)), a1: Math.max(...ts.map((t) => t.a)), b1: Math.max(...ts.map((t) => t.b)) };
  };

  // ── Overlays: what a drag will do, what's picked, where the pointer is ──
  const tilesPoly = (r: Span, up = z) => toPoints([at(r.a0, r.b0, up), at(r.a1 + 1, r.b0, up), at(r.a1 + 1, r.b1 + 1, up), at(r.a0, r.b1 + 1, up)]);
  const edgePath = (keys: string[]) => keys.map((k) => { const { a, b, d } = parseKey(k), p = at(a, b), q = d === 'a' ? at(a + 1, b) : at(a, b + 1); return `M${p.x},${p.y}L${q.x},${q.y}`; }).join('');
  const tint = drag?.kind === 'paint' && drag.tool === 'erase' ? '#dc2626' : ACCENT;
  const preview = drag?.kind === 'paint' && drag.tool === 'roof' ? <polygon points={tilesPoly(roofSpan(drag.start, drag.cur)!, top)} fill={ACCENT} fillOpacity={0.25} stroke={ACCENT} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    : drag?.kind === 'paint' ? (drag.line
    ? <path d={edgePath(wallEdges(drag.start, drag.cur, drag.room))} stroke={tint} strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.85} />
    : <polygon points={tilesPoly(spanOf(drag.start, drag.cur))} fill={tint} fillOpacity={0.25} stroke={tint} strokeWidth={2} vectorEffect="non-scaling-stroke" />)
    : drag?.kind === 'marquee' ? <polygon points={tilesPoly(spanOf(drag.start, drag.cur))} fill={ACCENT} fillOpacity={0.1} stroke={ACCENT} strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
    : null;
  const picked = s && sel.length > 0 && (() => {
    const da = shownS?.da ?? 0, db = shownS?.db ?? 0, l = s.levels[lv];
    return sel.map((p) => {
      const k = parseKey(p.key);
      if (p.kind === 'wall') return <path key={pieceId(p)} d={edgePath([edgeKey(k.a + da, k.b + db, k.d!)])} stroke={ACCENT} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
      if (p.kind === 'floor') return <polygon key={pieceId(p)} points={tilesPoly({ a0: k.a + da, b0: k.b + db, a1: k.a + da, b1: k.b + db })} fill={ACCENT} fillOpacity={0.18} stroke={ACCENT} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />;
      if (p.kind === 'roof') { const r = l.roofs?.[Number(p.key)]; return r && <polygon key={pieceId(p)} points={tilesPoly({ a0: r.a0 + da, b0: r.b0 + db, a1: r.a1 + da, b1: r.b1 + db }, top)} fill="none" stroke={ACCENT} strokeWidth={2.5} strokeDasharray="8 5" vectorEffect="non-scaling-stroke" />; }
      const o = l.objects?.[Number(p.key)], ofp = o ? objFp(atomOf, o) : { cols: 1, rows: 1 };
      return o && <polygon key={pieceId(p)} points={tilesPoly({ a0: o.a + da, b0: o.b + db, a1: o.a + da + ofp.cols - 1, b1: o.b + db + ofp.rows - 1 })} fill="none" stroke={ACCENT} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />;
    });
  })();
  const hoverRoom = !drag && hover && tool === 'tile' && !placing && hover.shift && s ? roomAt(s.levels[lv], fp.cols, fp.rows, hover.a, hover.b) : undefined;
  const hoverTint = tool === 'erase' && !placing ? '#dc2626' : ACCENT;
  const hoverRoof = !drag && hover && tool === 'roof' && !placing && !hover.line ? roofSpan(hover, hover) : undefined;
  const hovered = !drag && hover && tool !== 'read' && (tool !== 'select' || placing) && (hoverRoof
    ? <polygon points={tilesPoly(hoverRoof, top)} fill={ACCENT} fillOpacity={0.15} stroke={ACCENT} strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
    : hoverRoom
    ? <g>{hoverRoom.map((k) => { const { a, b } = parseKey(k); return <polygon key={k} points={tilesPoly({ a0: a, b0: b, a1: a, b1: b })} fill={ACCENT} fillOpacity={0.25} />; })}</g>
    : hover.line
    ? <circle cx={at(hover.a, hover.b).x} cy={at(hover.a, hover.b).y} r={6} fill={hoverTint} />
    : <polygon points={tilesPoly({ a0: hover.a, b0: hover.b, a1: hover.a, b1: hover.b })} fill="none" stroke={hoverTint} strokeWidth={2} vectorEffect="non-scaling-stroke" />);
  // The grid lies on this level's floor: over the floors, under what stands on them (built ids say what each piece is)
  const drawn = built?.elements ?? [], standsHere = new RegExp(`^L${lv}[wjor]`);
  const after = drawn.findIndex((e) => standsHere.test(e.id) || parseInt(e.id.slice(1), 10) > lv), split = after < 0 ? drawn.length : after;
  const draw = (el: (typeof drawn)[number]) => <Element key={el.id} el={el} all={drawn} bible={null} bibleId="" editing={false} onOpen={() => {}} />;
  let gridLines = '';
  for (let a = 0; a <= fp.cols; a++) { const p = at(a, 0), q = at(a, fp.rows); gridLines += `M${p.x},${p.y}L${q.x},${q.y}`; }
  for (let b = 0; b <= fp.rows; b++) { const p = at(0, b), q = at(fp.cols, b); gridLines += `M${p.x},${p.y}L${q.x},${q.y}`; }

  // ── Levels: pips, + to add one on top, − to take the open one away ──
  const levelPips = s && (
    <div className={MAP_RAIL}>
      <button className="px-1 text-[11px] text-neutral-400 hover:text-amber-300 disabled:opacity-30" title="Add a level on top" disabled={s.levels.length >= LEVELS_MAX}
        onClick={() => { set(addLevel(s)); setLevel(s.levels.length); }}>+</button>
      {s.levels.map((_, i) => s.levels.length - 1 - i).map((i) => (
        <button key={i} className="group p-1" title={`Level ${i + 1}`} aria-pressed={i === lv} onClick={() => setLevel(i)}>
          <span className={`block w-2 h-2 rounded-full ${i === lv ? 'bg-amber-400' : levelEmpty(s.levels[i]) ? 'bg-neutral-700 group-hover:bg-neutral-400' : 'bg-neutral-500 group-hover:bg-neutral-300'}`} />
        </button>
      ))}
      <button className="px-1 text-[11px] text-neutral-400 hover:text-red-300 disabled:opacity-30" title="Remove this level" disabled={s.levels.length < 2}
        onClick={async () => { if (levelEmpty(s.levels[lv]) || await askConfirm(`Remove level ${lv + 1} and everything on it?`, { ok: 'Remove', danger: true })) { set(removeLevel(s, lv)); setLevel(Math.max(0, lv - 1)); } }}>−</button>
    </div>
  );

  const newStructure = async () => {
    let free = 'New structure';
    for (let n = 2; entries.some((e) => e.asset.title === free); n++) free = `New structure ${n}`;
    const title = await askText('Name this structure', { value: free, ok: 'Create' });
    if (!title) return;
    const r = await createAsset('block', title, 'structure');
    if ('error' in r) file.setSave({ kind: 'error', message: r.error }); else setFabFile(r.id);
  };

  const tools = toolsFor(TOOLS);
  const count = (k: PieceKind) => sel.filter((p) => p.kind === k).length;
  const brushFor = tool === 'tile' ? { id: floorBrush, part: 'floor' } : tool === 'wall' ? { id: wallBrush, part: 'wall' } : tool === 'roof' ? { id: roofBrush, part: 'roof' } : null;
  const selRoof = s && sel.find((p) => p.kind === 'roof'), selRoofV = selRoof && s?.levels[lv].roofs?.[Number(selRoof.key)];
  const menu = tool === 'select' ? (
    <div className="p-3 flex flex-col gap-2 text-[11px] text-neutral-400 leading-relaxed">
      {sel.length ? <>
        <span className="text-neutral-200">{[['floor', 'floor'], ['wall', 'wall'], ['object', 'object']].map(([k, w]) => count(k as PieceKind) && `${count(k as PieceKind)} ${w}${count(k as PieceKind) > 1 ? 's' : ''}`).filter(Boolean).join(' · ')}</span>
        <span>Drag to move · Del deletes · , and . turn objects · pick one of the same part in the vault to swap it in.</span>
        {selRoofV && s && <RoofFields v={selRoofV} set={(patch) => set(setRoofs(s, lv, sel, patch))} />}
        <button className="self-start text-[11px] px-2 py-0.5 rounded border border-red-900 text-red-300 hover:bg-red-950" onClick={remove}>Delete</button>
      </> : <span>Click a floor, wall or object (Shift adds); drag on empty ground for a box.</span>}
    </div>
  ) : brushFor ? (
    <div className="p-2 flex flex-col gap-2">
      {brushFor.id ? (
        <div className="flex items-center gap-2">
          <span className="w-14 h-14 shrink-0 rounded bg-[#f4efe6] p-1"><AssetThumb id={brushFor.id} /></span>
          <span className="text-[11px] text-neutral-200 truncate">{atomOf(brushFor.id)?.title}</span>
        </div>
      ) : <p className="text-[11px] text-neutral-500 leading-relaxed">No {brushFor.part}s in the vault yet: make one on Fab → Blocks (+ New {brushFor.part}).</p>}
      <p className="text-[10px] text-neutral-500 leading-relaxed">
        {tool === 'tile' ? 'Drag over tiles; Shift-click floors a room.' : tool === 'wall' ? 'Drag along a grid line; Shift for a whole room.' : 'Click a room to roof it, or drag a box.'} Pick another {brushFor.part} in the vault.
      </p>
      {tool === 'roof' && <RoofFields v={roofOpts} set={(patch) => setRoofOpts({ ...roofOpts, ...patch })} />}
    </div>
  ) : (
    <p className="p-3 text-[11px] text-neutral-400 leading-relaxed">Press on a grid line and drag to take walls away (Shift: a room&apos;s); anywhere else, drag over tiles to clear their floors and objects.</p>
  );

  return (
    <div className={CANVAS_BG}>
      <SheetSurface
        sv={sv} grab={tool === 'read'} onBackground={() => setSel([])}
        onDragOver={(e) => { if (st && e.dataTransfer.types.includes(VAULT_DRAG)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
        onDrop={dropped}
      >
        {st && built ? (
          <Sheet sv={sv} size={sheet}>
            <svg
              ref={svgRef} viewBox={`0 0 ${sheet.width} ${sheet.height}`} width={sheet.width} height={sheet.height} className="block touch-none select-none"
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={() => setHover(null)}
              style={{ cursor: tool === 'read' ? undefined : drag?.kind === 'move' ? 'grabbing' : tool === 'select' && !placing ? 'default' : 'crosshair' }}
            >
              <rect width={sheet.width} height={sheet.height} fill={st.background ?? '#f4efe6'} />
              <polygon points={toPoints([at(0, 0), at(fp.cols, 0), at(fp.cols, fp.rows), at(0, fp.rows)])} fill={ACCENT} fillOpacity={0.06} />
              {drawn.slice(0, split).map(draw)}
              <path d={gridLines} fill="none" stroke="#8a8378" strokeOpacity={0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />
              {drawn.slice(split).map(draw)}
              <g pointerEvents="none">{picked}{preview}{hovered}</g>
            </svg>
          </Sheet>
        ) : (
          <EmptyNote>{!loaded ? 'Loading…' : <span>No structures yet.<br /><span className="font-mono text-sm">Pick + New structure in the file menu.</span></span>}</EmptyNote>
        )}
      </SheetSurface>

      <ToolRail tools={tools} tool={tool} pick={(t) => { setArmed(null); if (t === tool) setMenuOpen(!menuOpen); else { setTool(t); setMenuOpen(true); } }} />
      {menuOpen && st && tool !== 'read' && (
        <div
          className="absolute left-[61px] z-30 w-[208px] flex flex-col overflow-hidden bg-neutral-900/95 border border-neutral-700/60 rounded-xl backdrop-blur-sm text-xs text-neutral-300"
          style={{ top: menuTop(tools, tool), maxHeight: `calc(100vh - ${menuTop(tools, tool) + 16}px)` }}
        >{menu}</div>
      )}

      {placing ? <Banner tone="hint">Placing {atomOf(placing)?.title}: click tiles · Esc to stop</Banner>
        : drag?.kind === 'paint' && drag.tool === 'wall' ? <Banner tone="hint">{wallEdges(drag.start, drag.cur, drag.room).length} wall tiles{drag.room ? ', a room' : ''}</Banner>
        : !drag && 'message' in file.save ? <Banner>{file.save.message}</Banner> : null}

      {active && (
        <SheetPanel
          sv={sv} page={built ?? NO_DOC}
          undo={file.undo} redo={file.redo} canUndo={file.canUndo} canRedo={file.canRedo}
          rail={levelPips}
          pickers={
            <>
              <EditorPicker />
              <select
                value={entry ? entry.id : ''} className={PANEL_SELECT} title="File"
                onChange={(e) => { const v = e.target.value; e.target.blur(); if (v === '__new__') void newStructure(); else setFabFile(v); }}
              >
                {!entry && <option value="">—</option>}
                {structures.map((x) => <option key={x.id} value={x.id}>{x.asset.title}</option>)}
                <option value="__new__">+ New structure…</option>
              </select>
            </>
          }
          status={entry && <SaveDot save={file.save} saved="Saved to the vault" />}
          controls={s && <>
            <span className="text-[10px] font-mono text-neutral-400" title="The level being built (PgUp / PgDn, Ctrl + wheel)">level {lv + 1}/{s.levels.length}</span>
            <PanelToggle on={above} onClick={() => setAbove(!above)} title="Show the levels above this one too">above</PanelToggle>
            <PanelToggle on={showRoofs} onClick={() => setShowRoofs(!showRoofs)} title="Show the roofs (hide them to build under one)">roofs</PanelToggle>
            <PanelToggle on={wallView !== 'up'} onClick={() => setWallView(WALL_VIEWS[(WALL_VIEWS.indexOf(wallView) + 1) % WALL_VIEWS.length])} title="Walls (C): up · cut, lowered in front of rooms so you see in · down, all lowered. Only while building">walls {wallView}</PanelToggle>
          </>}
          panels={entry && <PanelToggle on={fileOpen} onClick={() => setFileOpen(!fileOpen)} title="This structure's name, footprint and sheet color">file</PanelToggle>}
          below={fileOpen && entry && st ? <AssetFile id={entry.id} asset={st} apply={(p, key) => apply(p as VaultAsset, key)} opened={(id) => setFabFile(id)} /> : undefined}
        />
      )}
    </div>
  );
}
