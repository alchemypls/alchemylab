"use client";

import { useEffect, useRef, useState } from 'react';
import { usePenBridge, type PenSource } from './usePenBridge';
import { boundsFromTrace, loadCalib, loadTurn, penToSheet, saveCalib, saveTurn, type PenCalib, type PenTurn } from '@/lib/penCalibration';
import { ARTBOARD } from '@/lib/design/types';
import type { PagePen } from '@/workbench/ui/VectorArtboard';

// The tablet pen on a fixed-size page. Off until asked for (a USB tablet is locked to the app while on),
// and off again when the canvas closes, because the bridge stream ends with this hook.

const SOURCE_KEY = 'alchemy:penSource';

function loadSource(): PenSource {
  try { return localStorage.getItem(SOURCE_KEY) === 'local' ? 'local' : 'remarkable'; }
  catch { return 'remarkable'; }
}

export function useSheetPen(enabled: boolean, sheet: { width: number; height: number }, onPen: (s: PagePen) => void) {
  const [source, setSourceState] = useState<PenSource>(loadSource);
  const [live, setLive] = useState(false);
  const [turn, setTurnState] = useState<PenTurn>(() => loadTurn(loadSource()));
  const [calib, setCalib] = useState<PenCalib | null>(() => loadCalib(loadSource()));
  const [calibrating, setCalibrating] = useState(false);
  const trace = useRef<[number, number][]>([]);
  const aspect = useRef(ARTBOARD.width / ARTBOARD.height);
  const last = useRef({ x: 0, y: 0 });

  const bridge = usePenBridge(live && enabled ? source : null, (raw) => {
    if (calibrating) {
      if (raw.down && !raw.eraser) trace.current.push([raw.x, raw.y]);
      else if (!raw.down && trace.current.length) {
        const c = boundsFromTrace(trace.current);
        trace.current = [];
        if (c) { saveCalib(source, c); setCalib(c); setCalibrating(false); }
      }
      return;
    }
    const at = penToSheet(raw.x, raw.y, { aspect: aspect.current, calib, turn, sheetAspect: sheet.width / sheet.height });
    if (at) last.current = { x: at[0] * sheet.width, y: at[1] * sheet.height };
    // Off the sheet counts as lifted: the stroke ends at the edge, and nothing draws out there.
    onPen({ ...last.current, p: raw.p, prox: !!at && raw.prox, down: !!at && raw.down, eraser: raw.eraser });
  });
  if (bridge.info) aspect.current = bridge.info.aspect;

  // Loading a page or turning the pen off can leave the hover ring and any stroke hanging: lift it.
  useEffect(() => {
    if (bridge.status !== 'live') onPen({ ...last.current, p: 0, prox: false, down: false, eraser: false });
  }, [bridge.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSource = (s: PenSource) => {
    try { localStorage.setItem(SOURCE_KEY, s); } catch { /* just won't persist */ }
    setSourceState(s); setTurnState(loadTurn(s)); setCalib(loadCalib(s)); setCalibrating(false);
  };
  const setTurn = (t: PenTurn) => { saveTurn(source, t); setTurnState(t); };

  return {
    source, setSource, live, setLive, turn, setTurn,
    status: bridge.status,
    error: live && enabled ? bridge.error?.message ?? null : null,
    name: bridge.info?.name, grabbed: bridge.info?.grabbed,
    calibrated: !!calib, calibrating,
    toggleCalibrate: () => { trace.current = []; setCalibrating(!calibrating); },
    clearCalibration: () => { saveCalib(source, null); setCalib(null); setCalibrating(false); },
  };
}
