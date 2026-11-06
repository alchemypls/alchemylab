"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

// Pan and zoom over one fixed-size sheet, shared by the full-screen canvases.
// The wheel zooms, space or middle drag pans, Ctrl+0 fits, Ctrl+1 is 100%. `panOnDrag` makes a plain drag pan too.
// `onKey` gets every other key press while the canvas is active and nothing is being typed in.
// `onCtrlWheel`, when given, takes Ctrl + mouse wheel notches (Web: its layers; Ideation/Fab: the drawing layer) (up = -1, down = 1) instead of zooming; a trackpad pinch still zooms.

export type View = { x: number; y: number; scale: number };   // sheet's top-left in screen px; screen px per sheet px
export type Sheet = { width: number; height: number };

const MARGIN = { left: 72, right: 325, top: 20, bottom: 20 };   // room for the tool rail and panel when fitted
const KEEP_VISIBLE = 160;   // px of sheet that always stays on screen
const MAX_SCALE = 4;
const DRAG_START = 4;       // px of movement before a press counts as a pan, so clicks on links still work

function fitView(w: number, h: number, sheet: Sheet): View {
  const aw = Math.max(w - MARGIN.left - MARGIN.right, 100), ah = Math.max(h - MARGIN.top - MARGIN.bottom, 100);
  const scale = Math.min(aw / sheet.width, ah / sheet.height);
  return { scale, x: MARGIN.left + (aw - sheet.width * scale) / 2, y: MARGIN.top + (ah - sheet.height * scale) / 2 };
}

function clampView(v: View, w: number, h: number, sheet: Sheet): View {
  return {
    scale: v.scale,
    x: Math.min(Math.max(v.x, KEEP_VISIBLE - sheet.width * v.scale), w - KEEP_VISIBLE),
    y: Math.min(Math.max(v.y, KEEP_VISIBLE - sheet.height * v.scale), h - KEEP_VISIBLE),
  };
}

export function useSheetView({ sheet, active, panOnDrag, onKey, onCtrlWheel }: {
  sheet: Sheet; active: boolean; panOnDrag: boolean; onKey: (e: KeyboardEvent) => void; onCtrlWheel?: (dir: 1 | -1) => void;
}) {
  const onCtrlWheelRef = useRef(onCtrlWheel);
  onCtrlWheelRef.current = onCtrlWheel;
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setViewState] = useState<View>({ x: 0, y: 0, scale: 0.5 });
  const viewRef = useRef(view);
  const sizeRef = useRef(size);
  const fitted  = useRef(true);   // while true, the sheet refits when the window changes

  const setView = useCallback((v: View) => {
    const next = clampView(v, sizeRef.current.w, sizeRef.current.h, sheetRef.current);
    viewRef.current = next;
    setViewState(next);
  }, []);
  const fit = useCallback(() => {
    fitted.current = true;
    const next = fitView(sizeRef.current.w, sizeRef.current.h, sheetRef.current);
    viewRef.current = next;
    setViewState(next);
  }, []);
  // Centers the sheet in the space beside the rail and panel, without changing the zoom
  const recenter = useCallback(() => {
    const { w, h } = sizeRef.current, { width, height } = sheetRef.current, { scale } = viewRef.current;
    const aw = w - MARGIN.left - MARGIN.right, ah = h - MARGIN.top - MARGIN.bottom;
    setView({ scale, x: MARGIN.left + (aw - width * scale) / 2, y: MARGIN.top + (ah - height * scale) / 2 });
  }, [setView]);
  const zoomAt = useCallback((scale: number, cx: number, cy: number) => {
    const v = viewRef.current;
    const min = fitView(sizeRef.current.w, sizeRef.current.h, sheetRef.current).scale * 0.5;
    const s = Math.min(Math.max(scale, min), MAX_SCALE);
    fitted.current = false;
    setView({ scale: s, x: cx - ((cx - v.x) * s) / v.scale, y: cy - ((cy - v.y) * s) / v.scale });
  }, [setView]);
  // Puts this sheet point at the middle of the screen, as the minimap does
  const centerOn = useCallback((x: number, y: number) => {
    fitted.current = false;
    const s = viewRef.current.scale;
    setView({ scale: s, x: sizeRef.current.w / 2 - x * s, y: sizeRef.current.h / 2 - y * s });
  }, [setView]);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const next = { w: e.contentRect.width, h: e.contentRect.height };
      sizeRef.current = next;
      setSize(next);
      if (fitted.current) fit(); else setView(viewRef.current);
    });
    ro.observe(el);
    // Native listener: React's wheel handler is passive and can't stop the browser zooming the tab
    let notchAt = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      // A pinch arrives as Ctrl + small pixel deltas; a mouse notch is a line or a big jump
      if (e.ctrlKey && onCtrlWheelRef.current && (e.deltaMode !== 0 || Math.abs(delta) >= 40)) {
        if (e.timeStamp - notchAt > 120) onCtrlWheelRef.current(delta < 0 ? -1 : 1);   // one step per notch, even with smooth scrolling
        notchAt = e.timeStamp;
        return;
      }
      const r = el.getBoundingClientRect();
      zoomAt(viewRef.current.scale * Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener('wheel', onWheel); };
  }, [fit, setView, zoomAt]);

  // The sheet's size can arrive after it opens, or be changed in its properties.
  useEffect(() => {
    if (fitted.current) fit(); else setView(viewRef.current);
  }, [sheet.width, sheet.height, fit, setView]);

  const [spaceHeld, setSpaceHeld] = useState(false);
  const pan = useRef<{ id: number; x: number; y: number; view: View; moved: boolean } | null>(null);
  const justPanned = useRef(false);

  const surfaceProps = {
    onPointerDownCapture: (e: React.PointerEvent<HTMLDivElement>) => {
      justPanned.current = false;
      const plain = panOnDrag && e.button === 0;
      if (!(plain || e.button === 1 || (e.button === 0 && spaceHeld))) return;
      pan.current = { id: e.pointerId, x: e.clientX, y: e.clientY, view: viewRef.current, moved: false };
      if (!plain) e.stopPropagation();   // don't start a drawing gesture underneath
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const p = pan.current;
      if (!p || p.id !== e.pointerId) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (!p.moved && Math.hypot(dx, dy) < DRAG_START) return;
      if (!p.moved) { p.moved = true; fitted.current = false; e.currentTarget.setPointerCapture(e.pointerId); }
      setView({ ...p.view, x: p.view.x + dx, y: p.view.y + dy });
    },
    onPointerUp: endPan,
    onPointerCancel: endPan,
    onMouseDown: (e: React.MouseEvent) => { if (e.button === 1) e.preventDefault(); },   // no browser autoscroll on middle-drag
    onClickCapture: (e: React.MouseEvent) => { if (justPanned.current) { justPanned.current = false; e.stopPropagation(); } },
  };
  function endPan(e: React.PointerEvent<HTMLDivElement>) {
    if (pan.current?.id !== e.pointerId) return;
    justPanned.current = pan.current.moved;
    pan.current = null;
  }

  // Nothing else on these canvases owns the keys, so they work without focusing anything.
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;
  useEffect(() => {
    if (!active) return;
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest('input, textarea, select, [contenteditable="true"]');
    const down = (e: KeyboardEvent) => {
      if (e.altKey || typing(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const done = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (e.key === ' ') { done(); if (!e.repeat) setSpaceHeld(true); }
      else if (mod && e.key === '0') { done(); fit(); }
      else if (mod && e.key === '1') { done(); zoomAt(1, sizeRef.current.w / 2, sizeRef.current.h / 2); }
      else onKeyRef.current(e);
    };
    const up = (e: KeyboardEvent) => { if (e.key === ' ') setSpaceHeld(false); };
    const blur = () => setSpaceHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [active, fit, zoomAt]);

  return {
    surfaceRef, surfaceProps, view, spaceHeld, fit, recenter, centerOn,
    visible: { x: -view.x / view.scale, y: -view.y / view.scale, w: size.w / view.scale, h: size.h / view.scale },   // visible part of the sheet
  };
}
