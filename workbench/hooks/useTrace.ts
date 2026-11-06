"use client";

import { useEffect, useState } from 'react';
import { deleteAsset, imageSize, putAsset, useAssetUrl } from '@/lib/assets';

// A tracing image under one sheet: a reference to draw over, like the wireframe under the page layout.
// It belongs to this browser, not the file: the image sits in IndexedDB and its settings in localStorage,
// per sheet (`key`). So the agent never sees it, and nothing about the page changes.

const STORE = 'alchemy:trace';

export interface Trace {
  assetId: string;
  nw: number; nh: number;   // the image's own size, for its shape
  cx: number; cy: number;   // center on the sheet
  scale: number;            // 1 = fitted inside the sheet
  opacity: number;
  shown: boolean;
}
export interface TraceBox { url: string; x: number; y: number; w: number; h: number; opacity: number }

function readAll(): Record<string, Trace> {
  try { return JSON.parse(localStorage.getItem(STORE) ?? '{}'); } catch { return {}; }
}
function writeAll(all: Record<string, Trace>) {
  try { localStorage.setItem(STORE, JSON.stringify(all)); } catch { /* storage full or blocked: it lasts this visit */ }
}

export function useTrace(key: string | null, sheet: { width: number; height: number }) {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  useEffect(() => { setTrace(key ? readAll()[key] ?? null : null); setAdjusting(false); }, [key]);
  const url = useAssetUrl(trace?.assetId);

  const put = (next: Trace | null) => {
    setTrace(next);
    if (!key) return;
    const all = readAll();
    if (next) all[key] = next; else delete all[key];
    writeAll(all);
  };
  const set = (patch: Partial<Trace>) => trace && put({ ...trace, ...patch });

  const load = async (file: File) => {
    if (!key) return;
    const size = await imageSize(file).catch(() => null);
    if (!size) return;
    const assetId = await putAsset(file, 'trace');
    if (trace) deleteAsset(trace.assetId).catch(() => {});
    put({ assetId, nw: size.width, nh: size.height, cx: sheet.width / 2, cy: sheet.height / 2, scale: 1, opacity: 0.4, shown: true });
  };
  const remove = () => {
    if (trace) deleteAsset(trace.assetId).catch(() => {});
    setAdjusting(false);
    put(null);
  };

  // Where it lands: fitted inside the sheet, then scaled around its center
  let box: TraceBox | null = null;
  if (trace && url && trace.shown) {
    const fit = Math.min(sheet.width / trace.nw, sheet.height / trace.nh) * trace.scale;
    const w = trace.nw * fit, h = trace.nh * fit;
    box = { url, x: trace.cx - w / 2, y: trace.cy - h / 2, w, h, opacity: trace.opacity };
  }

  return {
    trace, box, load, set, remove,
    toggle: () => set({ shown: !trace?.shown }),
    fit: () => set({ cx: sheet.width / 2, cy: sheet.height / 2, scale: 1 }),
    adjusting: adjusting && !!box, setAdjusting,
  };
}
export type TraceControls = ReturnType<typeof useTrace>;
