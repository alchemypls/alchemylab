"use client";

// The pointer engine of a vector sheet: mouse and tablet pen presses become gestures (select, move, resize, rotate, draw,
// erase, place), and gestures become page edits through edit.apply. All drawing goes through lib/design/vector.ts ops,
// so it lands in the same file the agent writes. A tablet pen drives the same gestures as the mouse, through `penInput`.

import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { untouchable } from '@/lib/design/layers';
import type { DesignPage } from '@/lib/design/types';
import { footingOf, placeAsset } from '@/lib/design/vault';
import {
  addElement, boundsOf, cutStrokes, dragDelta, gridOf, invert, ISO_DEG, latticeVertex, mapPt, liftOf, magnet, newId, offPlane, onPlane, planeOf, PLANES, polyFrom,
  pullBox, pullBoxToLattice, pullZone, removeElements, ROOF_LIFT, rotatePt, rotationOf, rubArea, rubElements, snap, snapAngle, standing, tenants, tidyStroke,
  translateElements, updateElement, visualBounds, withGroups,
  type Anchor, type FootingOf, type Lattice, type Pt, type VElement, type VLine,
} from '@/lib/design/vector';
import { isLineKind, shapeFields, strokeFields, textFields, zoneFields } from '@/lib/design/toolStyles';
import { useVault } from '@/workbench/hooks/useVault';
import { carveElements } from '@/lib/design/carve';
import type { SheetMenuAt } from '../SheetMenu';
import { ACCENT } from '../DesignArtboard';
import {
  angleAt, boxFrom, down, DRAG_START, fromPointer, MIN_SIZE, tileAt, ZONE_TAP, zoneSpan,
  type Dir, type Gesture, type PagePen, type Press, type VectorEdit, type VTool,
} from './gesture';

type Pointer = { clientX: number; clientY: number };

// Where points stick while drawing. Only while the grid shows and Snap to grid is on: a square grid pulls edges near a line
// (about 10 screen px), an isometric one pulls points near a tile corner onto it. Elsewhere points move freely.
function snapping(lattice: Lattice, edit: VectorEdit | undefined, gridShown: boolean) {
  const on = !edit?.styles.select.free;
  const mag = on && gridShown && lattice.flat && edit ? { cell: lattice.cell, tol: Math.min(10 / edit.scale, lattice.cell / 3) } : null;
  const iso = on && gridShown && !lattice.flat && edit ? { tol: Math.min(12 / edit.scale, lattice.cell / 3) } : null;
  const vertex = (p: Pt): Pt | undefined => (iso ? latticeVertex(lattice, p, iso.tol) : undefined);
  const pullPt = (p: Pt): Pt => vertex(p) ?? (mag ? { x: magnet(p.x, mag.cell, mag.tol) ?? p.x, y: magnet(p.y, mag.cell, mag.tol) ?? p.y } : p);
  return { on, mag, iso, vertex, pullPt };
}

export function useGestures({ svgRef, page, els, W, H, edit, penInput, lookOnly }: {
  svgRef: RefObject<SVGSVGElement>;
  page: DesignPage; els: VElement[]; W: number; H: number;
  edit?: VectorEdit;
  penInput?: MutableRefObject<((s: PagePen) => void) | null>;
  lookOnly: boolean;
}) {
  const pageRef = useRef(page); pageRef.current = page;
  const gesture = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<Gesture | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [menu, setMenu] = useState<SheetMenuAt | null>(null);   // the right-click menu
  const vault = useVault().entries;
  const fpOf: FootingOf = (e) => { if (e.type !== 'asset') return undefined; const a = vault.find((v) => v.id === e.asset)?.asset; return a && footingOf(a, undefined, e); };

  const handlesOn = edit?.tool === 'select' || edit?.tool === 'shape' || edit?.tool === 'text' || edit?.tool === 'zone';
  const single = handlesOn && edit?.selected.length === 1 ? els.find((x) => x.id === edit.selected[0]) : undefined;
  const gridShown = lookOnly || !!edit && (edit.showGrid || edit.tool === 'zone' || els.some((x) => x.type === 'zone' && edit.selected.includes(x.id)));
  const lattice = gridOf(page);
  const { on: snapOn, mag, iso, vertex, pullPt } = snapping(lattice, edit, gridShown);

  const toPt = (e: Pointer): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);   // a drag past the sheet's edge stops at it
    return { x: clamp(((e.clientX - r.left) * W) / r.width, W), y: clamp(((e.clientY - r.top) * H) / r.height, H) };
  };

  // Topmost element under the pointer (ignores handles and the dragged line itself)
  const elementAt = (e: Pointer, skipLines = false, skip?: string, off: VElement['type'][] = []): VElement | undefined => {
    const blocked = untouchable(pageRef.current);   // on a hidden or locked layer
    for (const node of document.elementsFromPoint(e.clientX, e.clientY)) {
      const id = node.closest<SVGGElement>('[data-el]')?.dataset.el;
      if (!id || id === skip || blocked.has(id)) continue;
      const el = pageRef.current.elements?.find((x) => x.id === id);
      if (el && !(skipLines && el.type === 'line') && !off.includes(el.type)) return el;
    }
    return undefined;
  };

  const anchorAt = (e: Pointer, p: Pt, skip?: string): Anchor => {
    const el = elementAt(e, true, skip);
    if (el) return { el: el.id };
    const v = vertex(p);
    if (v) return v;
    const q = pullPt(p);
    return snapOn ? { x: snap(q.x), y: snap(q.y) } : { x: Math.round(q.x), y: Math.round(q.y) };
  };

  const handleAt = (e: Pointer) => {
    for (const node of document.elementsFromPoint(e.clientX, e.clientY)) {
      const h = node.closest<SVGElement>('[data-handle]')?.dataset.handle;
      if (h) return h;
    }
    return undefined;
  };

  const begin = (g: Gesture) => { gesture.current = g; setPreview(g); };
  const drop = () => { gesture.current = null; setPreview(null); };

  // A press on the selected element's handle resizes it, in any tool that can show handles
  const startHandle = (e: Press, key: string) => {
    const handle = handleAt(e);
    const only = edit?.selected.length === 1 ? els.find((x) => x.id === edit.selected[0]) : undefined;
    if (!handle || !only) return false;
    if (only.type === 'line') begin({ kind: 'endpoint', id: only.id, end: handle as 'from' | 'to', key });
    else if (only.type === 'zone') begin({ kind: 'pull', id: only.id, dir: handle as Dir, base: only, key });
    else if (handle === 'rotate' && only.type === 'asset' && fpOf(only)) {   // a block turns about where it stands; on an isometric floor, by quarters
      const at = only.at ?? { x: 0.5, y: 0.5 }, c = { x: only.x + only.w * at.x, y: only.y + only.h * at.y };
      const flat = standing(els, only, fpOf)?.zone.flat ?? gridOf(pageRef.current).flat;
      begin({ kind: 'rotate', id: only.id, c, key, block: { from: angleAt(c, toPt(e)), turn: only.turn ?? 0, quarter: !flat } });
    }
    else if (handle === 'rotate') { const b = boundsOf(only, els); begin({ kind: 'rotate', id: only.id, c: { x: b.x + b.w / 2, y: b.y + b.h / 2 }, key }); }
    else begin({ kind: 'resize', id: only.id, dir: handle as Dir, box: boundsOf(only, els), deg: rotationOf(only), plane: planeOf(only), lift: liftOf(only), key });
    return true;
  };

  const rubs = useRef<{ key: string; open: Map<string, number> }>({ key: '', open: new Map() });   // the eraser marks this drag is drawing
  const eraseBetween = (from: Pt, to: Pt, e: Press, key: string) => {
    if (!edit) return;
    const s = edit.styles.erase;
    if (s.shape === 'whole') {
      const hit = elementAt(e);
      if (hit) { const next = removeElements(pageRef.current, [hit.id]); pageRef.current = next; edit.apply(next, key); }
      return;
    }
    // Fast movement leaves gaps between samples, so stamp the eraser along the way
    const r = s.size / 2, steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / Math.max(r / 2, 1)));
    let next = pageRef.current;
    const blocked = untouchable(next);
    for (let i = 0; i <= steps; i++) next = cutStrokes(next, { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }, r, s.shape === 'square', blocked);
    if (edit.eraseAll) {
      if (rubs.current.key !== key) rubs.current = { key, open: new Map() };
      next = rubElements(next, from, to, s.size, s.shape === 'square', blocked, rubs.current.open);
    }
    // Samples can arrive faster than renders, and the next one must build on this one
    if (next !== pageRef.current) { pageRef.current = next; edit.apply(next, key); }
  };

  const startGesture = (e: Press, tool: VTool) => {
    if (!edit) return;
    const p = toPt(e), key = `g${e.timeStamp}`;
    const lift = edit.styles.shape.plane === 'roof' ? edit.styles.shape.lift ?? ROOF_LIFT : undefined;
    switch (tool) {
      case 'select': {
        if (startHandle(e, key)) return;
        const hit = elementAt(e, false, undefined, edit.styles.select.off);
        if (!hit) {
          if (!e.shiftKey) edit.select([]);
          return begin({ kind: 'marquee', start: p, cur: p });
        }
        const welded = withGroups(els, [hit.id]);   // a group is picked as one
        const ids = edit.selected.includes(hit.id)
          ? (e.shiftKey ? edit.selected.filter((i) => !welded.includes(i)) : edit.selected)
          : (e.shiftKey ? Array.from(new Set([...edit.selected, ...welded])) : welded);
        edit.select(ids);
        return begin({ kind: 'move', start: p, base: els, ids, carried: tenants(els, ids, fpOf).filter((t) => !ids.includes(t)), key });
      }
      case 'zone': {
        if (startHandle(e, key)) return;
        const grid = gridOf(pageRef.current), t = tileAt(grid, p);
        return begin({ kind: 'zone', grid, start: t, cur: t });
      }
      case 'shape': {
        if (startHandle(e, key)) return;
        const kind = edit.styles.shape.kind;
        if (isLineKind(kind)) return begin({ kind: 'line', from: anchorAt(e, p), start: p, cur: p });
        const q = pullPt(p);
        if (kind === 'poly') {
          const g = gesture.current;
          if (g?.kind !== 'poly') return begin({ kind: 'poly', pts: [q], cur: q, plane: edit.styles.shape.plane, lift });
          const near = (a: Pt, d: number) => Math.hypot(a.x - q.x, a.y - q.y) <= d;
          if (g.pts.length >= 3 && near(g.pts[0], 10 / edit.scale)) return finishPoly();
          if (!near(g.pts[g.pts.length - 1], 3 / edit.scale)) begin({ ...g, pts: [...g.pts, q], cur: q });   // a double-click's second press adds nothing
          return;
        }
        return begin({ kind: 'create', type: kind === 'ellipse' || kind === 'bush' ? 'ellipse' : kind === 'capsule' ? kind : 'rect', start: q, cur: q, plane: edit.styles.shape.plane, lift });
      }
      case 'text': {
        if (startHandle(e, key)) return;
        const q = pullPt(p);
        return begin({ kind: 'create', type: 'text', start: q, cur: q });
      }
      case 'asset': {
        if (!edit.placing) return;
        const r = placeAsset(pageRef.current, edit.placing.id, edit.placing.asset, p);
        pageRef.current = r.page;
        edit.apply(r.page);
        edit.select([r.id]);
        return;
      }
      case 'pen':
        return begin({ kind: 'pen', points: [[p.x, p.y]], pressures: e.pressure === undefined ? undefined : [e.pressure] });
      case 'erase': {
        if (edit.styles.erase.shape === 'line') {   // near the placed line: pull it; anywhere else: a new line
          const g = gesture.current;
          if (g?.kind === 'cut' && g.placed && nearCut(g, p)) return begin({ ...g, from: p, off: { x: 0, y: 0 } });
          const q = pullPt(p);
          return begin({ kind: 'cut', a: q, b: q, placed: false, off: { x: 0, y: 0 } });
        }
        begin({ kind: 'erase', key, last: p });
        eraseBetween(p, p, e, key);
      }
    }
  };

  // ── Line eraser ── a pull goes across the floor, square to the line on the ground (an isometric sheet is worked on its
  // flat floor: PLANES.floor), by half tiles while snapping
  const nearCut = (g: { a: Pt; b: Pt }, p: Pt) => {
    const dx = g.b.x - g.a.x, dy = g.b.y - g.a.y, len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - g.a.x) * dx + (p.y - g.a.y) * dy) / len2));
    return Math.hypot(p.x - (g.a.x + t * dx), p.y - (g.a.y + t * dy)) <= 24 / (edit?.scale ?? 1);
  };
  const pullOf = (g: { a: Pt; b: Pt }, from: Pt, p: Pt): Pt => {
    const m = lattice.flat ? undefined : PLANES.floor, inv = m && invert(m);
    const flat = (q: Pt) => (inv ? mapPt(inv, q) : q), back = (q: Pt) => (m ? mapPt(m, q) : q);
    const ab = flat({ x: g.b.x - g.a.x, y: g.b.y - g.a.y }), len = Math.hypot(ab.x, ab.y) || 1;
    const n = { x: -ab.y / len, y: ab.x / len }, d = flat({ x: p.x - from.x, y: p.y - from.y });
    const step = snapOn && gridShown ? lattice.cell / 2 : 1, t = Math.round((d.x * n.x + d.y * n.y) / step) * step;
    return back({ x: n.x * t, y: n.y * t });
  };

  const previewFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(previewFrame.current), []);

  const moveGesture = (e: Press) => {
    const g = gesture.current;
    if (!g || !edit) return;
    const p = toPt(e);
    switch (g.kind) {
      case 'move': {
        // A click with a shaky hand isn't a move: it would pull a piece into its tile or add an undo step
        if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < DRAG_START) return;
        g.moved = true;
        const dx = p.x - g.start.x, dy = p.y - g.start.y, zoneMoving = g.base.some((x) => x.type === 'zone' && g.ids.includes(x.id));
        const d = !snapOn && !zoneMoving ? { x: Math.round(dx), y: Math.round(dy) } : dragDelta(pageRef.current, g.base, g.ids, dx, dy, iso ? (b) => pullBoxToLattice(b, lattice, iso.tol) : mag ? (b) => pullBox(b, mag.cell, mag.tol) : undefined, fpOf);
        edit.apply(translateElements(pageRef.current, g.base, [...g.ids, ...g.carried], d.x, d.y), g.key);
        return;
      }
      case 'pull':
        edit.apply(updateElement(pageRef.current, g.id, pullZone(g.base, g.dir, p)), g.key);
        return;
      case 'zone':
        begin({ ...g, cur: tileAt(g.grid, p) });
        return;
      case 'resize': {
        // A turned box resizes in its own frame, and the side or corner opposite the handle stays put on the page
        // A shape in a plane resizes in its own flat box: the pointer (on a tile corner when near one) goes back off the plane
        const b = g.box, c0 = { x: b.x + b.w / 2, y: b.y + b.h / 2 }, free = !!g.deg || !!g.plane || !snapOn;
        const lp = g.plane ? offPlane(g.plane, b, down(vertex(p) ?? p, g.lift)) : g.deg ? rotatePt(p, c0, -g.deg) : p;
        const v = free ? undefined : vertex(lp), q = free ? lp : pullPt(lp);
        const x = v ? v.x : free ? Math.round(lp.x) : snap(q.x), y = v ? v.y : free ? Math.round(lp.y) : snap(q.y);
        let l = b.x, t = b.y, r = b.x + b.w, btm = b.y + b.h;
        if (g.dir.includes('w')) l = Math.min(x, r - MIN_SIZE);
        if (g.dir.includes('e')) r = Math.max(x, l + MIN_SIZE);
        if (g.dir.includes('n')) t = Math.min(y, btm - MIN_SIZE);
        if (g.dir.includes('s')) btm = Math.max(y, t + MIN_SIZE);
        if (g.plane) {   // its corner (x, y) is where the new top-left lands on the page, so the opposite side stays put
          const tl = onPlane(g.plane, b, { x: l, y: t }), w = r - l, h = btm - t;
          l = tl.x; t = tl.y; r = l + w; btm = t + h;
        } else if (g.deg) {
          const anchor = (bl: number, bt: number, br: number, bb: number) => ({
            x: g.dir.includes('w') ? br : g.dir.includes('e') ? bl : (bl + br) / 2,
            y: g.dir.includes('n') ? bb : g.dir.includes('s') ? bt : (bt + bb) / 2,
          });
          const before = rotatePt(anchor(b.x, b.y, b.x + b.w, b.y + b.h), c0, g.deg);
          const after = rotatePt(anchor(l, t, r, btm), { x: (l + r) / 2, y: (t + btm) / 2 }, g.deg);
          const dx = before.x - after.x, dy = before.y - after.y;
          l += dx; r += dx; t += dy; btm += dy;
        }
        edit.apply(updateElement(pageRef.current, g.id, { x: Math.round(l), y: Math.round(t), w: Math.round(r - l), h: Math.round(btm - t) }), g.key);
        return;
      }
      case 'rotate': {
        if (g.block) {
          const raw = g.block.turn + angleAt(g.c, p) - g.block.from;
          const turn = g.block.quarter ? ((Math.round(raw / 90) * 90) % 360 + 360) % 360 : snapAngle(raw, e.shiftKey ? 15 : undefined);
          edit.apply(updateElement(pageRef.current, g.id, { turn: turn || undefined } as Partial<VElement>), g.key);
          return;
        }
        const deg = angleAt(g.c, p) + 90;
        const rotate = snapAngle(deg, e.shiftKey ? 15 : undefined, iso ? [ISO_DEG, 180 - ISO_DEG, 180 + ISO_DEG, 360 - ISO_DEG] : []);
        edit.apply(updateElement(pageRef.current, g.id, { rotate: rotate || undefined }), g.key);
        return;
      }
      case 'endpoint':
        edit.apply(updateElement(pageRef.current, g.id, { [g.end]: anchorAt(e, p, g.id) } as Partial<VLine>), g.key);
        return;
      case 'marquee':
        begin({ ...g, cur: p });
        return;
      case 'create': case 'line': case 'poly':
        begin({ ...g, cur: pullPt(p) });
        return;
      case 'pen':
        g.points.push([p.x, p.y]);
        if (e.pressure !== undefined) g.pressures?.push(e.pressure);
        // One redraw per frame: a tablet sends samples much faster than the screen updates
        if (!previewFrame.current) previewFrame.current = requestAnimationFrame(() => {
          previewFrame.current = 0;
          if (gesture.current?.kind === 'pen') setPreview({ ...gesture.current });
        });
        return;
      case 'erase':
        eraseBetween(g.last, p, e, g.key);
        g.last = p;
        return;
      case 'cut':
        if (!g.placed) begin({ ...g, b: pullPt(p) });
        else if (g.from) begin({ ...g, off: pullOf(g, g.from, p) });
    }
  };

  // A polygon of 3+ corners becomes an element. In a plane, its corners go back to the plane's flat box first.
  const finishPoly = () => {
    const g = gesture.current;
    drop();
    if (!edit || g?.kind !== 'poly' || g.pts.length < 3) return;
    const m = g.plane && PLANES[g.plane], o = down(g.pts[0], g.lift);
    const f = polyFrom(m ? g.pts.map((q) => offPlane(m, o, down(q, g.lift))) : g.pts);
    const corner = m ? onPlane(m, o, f) : f;
    const id = newId('poly');
    edit.apply(addElement(pageRef.current, { id, type: 'poly', ...f, x: Math.round(corner.x * 10) / 10, y: Math.round(corner.y * 10) / 10, ...shapeFields(edit.styles.shape) } as VElement));
    edit.select([id]);
    edit.placed?.();
  };
  // While drawing a polygon: Enter finishes, Backspace takes back a corner, Esc drops it. Another tool drops it too.
  useEffect(() => {
    if (preview?.kind !== 'poly' && preview?.kind !== 'cut') return;
    const key = (e: KeyboardEvent) => {
      const g = gesture.current;
      if (g?.kind === 'cut' && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); drop(); return; }
      if (g?.kind !== 'poly') return;
      if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); finishPoly(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); drop(); }
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault(); e.stopImmediatePropagation();
        if (g.pts.length > 1) begin({ ...g, pts: g.pts.slice(0, -1) }); else drop();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [preview?.kind]); // eslint-disable-line react-hooks/exhaustive-deps -- reads the live gesture
  useEffect(() => { if (gesture.current?.kind === 'poly' || gesture.current?.kind === 'cut') drop(); }, [edit?.tool, edit?.styles.shape.kind, edit?.styles.erase.shape]);

  const endGesture = (e: Press) => {
    const g = gesture.current;
    if (g?.kind === 'poly') return;   // a polygon finishes on its own (first corner, double-click, Enter)
    if (g?.kind === 'cut') {   // first drag places the line and it stays; the pulling drag rubs out the band
      if (!g.placed) return Math.hypot(g.b.x - g.a.x, g.b.y - g.a.y) < 4 ? drop() : begin({ ...g, placed: true });
      if (!g.from) return;
      drop();
      if ((!g.off.x && !g.off.y) || !edit) return;
      const cur = pageRef.current, up = (q: Pt) => ({ x: q.x + g.off.x, y: q.y + g.off.y });
      let next = rubArea(cur, [g.a, g.b, up(g.b), up(g.a)], untouchable(cur), !!edit.eraseAll);
      if (edit.eraseAll) { const was = new Set(cur.elements); next = carveElements(next, (next.elements ?? []).filter((x) => !was.has(x)).map((x) => x.id)); }
      if (next !== cur) { pageRef.current = next; edit.apply(next); }
      return;
    }
    drop();
    // An eraser stroke on Fab ends by cutting the shapes it rubbed: the marks become their outline (lib/design/carve)
    if (g?.kind === 'erase' && edit?.eraseAll && rubs.current.key === g.key && rubs.current.open.size) {
      const cur = pageRef.current, next = carveElements(cur, rubs.current.open.keys());
      rubs.current = { key: '', open: new Map() };
      if (next !== cur) { pageRef.current = next; edit.apply(next, g.key); }
      return;
    }
    if (!g || !edit) return;
    const cur = pageRef.current;
    const place = (el: VElement) => { edit.apply(addElement(cur, el)); edit.select([el.id]); };

    if (g.kind === 'marquee') {
      const m = boxFrom(g.start, g.cur);
      if (m.w < 4 && m.h < 4) return;
      const blocked = untouchable(cur);
      const inside = els.filter((x) => {
        if (edit.styles.select.off.includes(x.type) || blocked.has(x.id)) return false;
        const b = visualBounds(x, els);
        return b.x >= m.x && b.y >= m.y && b.x + b.w <= m.x + m.w && b.y + b.h <= m.y + m.h;
      });
      const ids = withGroups(els, inside.map((x) => x.id)).filter((id) => !blocked.has(id));
      edit.select(e.shiftKey ? Array.from(new Set([...edit.selected, ...ids])) : ids);
    } else if (g.kind === 'create') {
      const m = g.plane && PLANES[g.plane], s0 = down(g.start, g.lift), c0 = down(g.cur, g.lift);   // a roof is drawn where it shows; it's stored on the floor
      const b = m ? boxFrom(s0, offPlane(m, s0, c0)) : boxFrom(g.start, g.cur);   // in a plane: the drag in the shape's own flat box
      const tiny = b.w < 8 || b.h < 8;
      // A click on existing text edits it, instead of stacking a new box on it. On release, because
      // the press itself would take focus straight back from the text field.
      const onText = g.type === 'text' && tiny ? elementAt(e) : undefined;
      if (onText?.type === 'text' && !onText.bind) { edit.select([onText.id]); setEditingText(onText.id); return; }
      const def = g.type === 'text' ? { w: 420, h: 96 } : { w: 240, h: 140 };
      const fin = iso || m || !snapOn ? Math.round : snap;   // isometric corners can sit off the 8px grid
      const corner = m ? (tiny ? s0 : onPlane(m, s0, b)) : b;   // a planed shape keeps its top-left where it's drawn
      const box = { x: fin(corner.x), y: fin(corner.y), w: tiny ? def.w : fin(b.w), h: tiny ? def.h : fin(b.h) };
      const id = newId(g.type);
      if (g.type === 'text') { place({ id, type: 'text', ...box, text: '', ...textFields(edit.styles.text) }); setEditingText(id); }
      else place({ id, type: g.type, ...box, ...shapeFields(edit.styles.shape) } as VElement);
      edit.placed?.();
    } else if (g.kind === 'zone') {
      const tapped = g.start.a === g.cur.a && g.start.b === g.cur.b;
      const end = tapped ? { a: g.start.a + ZONE_TAP - 1, b: g.start.b + ZONE_TAP - 1 } : g.cur;
      place({ id: newId('zone'), type: 'zone', ...zoneFields(edit.styles.zone), ...zoneSpan(g.grid, g.start, end) });
      edit.placed?.();
    } else if (g.kind === 'line') {
      if (Math.hypot(g.cur.x - g.start.x, g.cur.y - g.start.y) < 8) return;
      place({ id: newId('line'), type: 'line', from: g.from, to: anchorAt(e, g.cur), ...shapeFields(edit.styles.shape) } as VElement);
    } else if (g.kind === 'pen') {
      // A tap with the pen tip is a dot; a mouse click draws nothing
      if (g.points.length > 1 || g.pressures) {
        const brush = strokeFields(edit.styles.pen);
        edit.apply(addElement(cur, { id: newId('stroke'), type: 'stroke', ...tidyStroke(g.points, brush.brush ? undefined : g.pressures), ...brush }));
      }
    }
  };

  // ── Tablet pen ── tip follows the active tool, the eraser end always erases.
  const ringRef = useRef<SVGCircleElement>(null);
  const eraserRef = useRef<SVGRectElement>(null);
  // Shows the eraser's real size and shape under the pointer. Set directly, like the ring.
  const moveEraser = (p: Pt | null) => {
    const el = eraserRef.current, s = edit?.styles.erase;
    if (!el) return;
    if (!p || !s || !edit || s.shape === 'whole' || s.shape === 'line') return el.setAttribute('display', 'none');
    const r = s.size / 2;
    el.setAttribute('display', 'inline');
    el.setAttribute('x', String(p.x - r)); el.setAttribute('y', String(p.y - r));
    el.setAttribute('width', String(s.size)); el.setAttribute('height', String(s.size));
    el.setAttribute('rx', String(s.shape === 'round' ? r : 0));
    el.setAttribute('stroke-width', String(1.5 / edit.scale));
  };
  const lastPen = useRef<Press>({ clientX: 0, clientY: 0, timeStamp: 0 });
  if (penInput) penInput.current = (s) => {
    const r = svgRef.current?.getBoundingClientRect();
    const ring = ringRef.current;
    if (!r) return;
    if (ring) {   // set directly: a React render per sample would slow the pen down
      ring.setAttribute('display', s.prox ? 'inline' : 'none');
      if (s.prox) {
        const per = r.width / W;   // screen px per page px
        ring.setAttribute('cx', String(s.x));
        ring.setAttribute('cy', String(s.y));
        ring.setAttribute('r', String(6 / per));
        ring.setAttribute('stroke-width', String(1.5 / per));
        ring.setAttribute('stroke', s.eraser ? '#dc2626' : ACCENT);
      }
    }
    if (!edit) return;
    moveEraser(s.prox && (s.eraser || edit.tool === 'erase') ? { x: s.x, y: s.y } : null);
    if (s.prox) lastPen.current = { clientX: r.left + (s.x * r.width) / W, clientY: r.top + (s.y * r.height) / H, timeStamp: performance.now(), pressure: s.p };
    const g = gesture.current;
    if (s.down && !g) startGesture(lastPen.current, s.eraser ? 'erase' : edit.tool);
    else if (s.down && g) moveGesture(lastPen.current);
    else if (!s.down && g) endGesture(lastPen.current);
  };

  // The svg's own handlers
  const handlers = {
    onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => {
      if (!edit || e.button !== 0 || (e.target as Element).closest('textarea')) return;
      if (editingText && !handleAt(e)) return;   // this press only ends the typing (a handle still resizes)
      svgRef.current!.setPointerCapture(e.pointerId);
      startGesture(fromPointer(e), edit.tool);
    },
    onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => { if (edit?.tool === 'erase') moveEraser(toPt(e)); moveGesture(fromPointer(e)); },
    onPointerLeave: () => moveEraser(null),
    onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => endGesture(fromPointer(e)),
    onDoubleClick: (e: React.MouseEvent<SVGSVGElement>) => {
      if (gesture.current?.kind === 'poly') return finishPoly();
      if (!edit || edit.tool !== 'select') return;
      const hit = elementAt(e);
      if (hit?.type === 'text' && !hit.bind) setEditingText(hit.id);
    },
    onContextMenu: (e: React.MouseEvent<SVGSVGElement>) => {
      if (!edit) return;   // reading: the browser's own menu
      e.preventDefault();
      if (gesture.current) return;
      const hit = elementAt(e, false, undefined, edit.styles.select.off);
      const ids = hit ? (edit.selected.includes(hit.id) ? edit.selected : [hit.id]) : [];
      edit.select(ids);
      setMenu({ x: e.clientX, y: e.clientY, ids });
    },
  };

  return { pageRef, fpOf, preview, editingText, setEditingText, menu, setMenu, single, gridShown, lattice, ringRef, eraserRef, handlers };
}
