"use client";

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorkbenchStore } from '@/lib/store';

// The vault window's parts, shared by both vaults (the component vault on the React Flow canvases, the file vault
// on Ideation and Fab): a floating window you drag by its title and resize from its corner (place and size kept in
// the store), a search box with a filter button, a tab sidebar, and a grid of square slots that items pack into.

export const SLOT = 64;       // px: slots are SLOT × SLOT squares
export const SLOT_GAP = 4;
const MIN_COLS = 2, MIN_ROWS = 6, MIN_W = 240, MIN_H = 320;

export function VaultGlyph({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" className={`${className} fill-current shrink-0`}>
      <rect x="1" y="3" width="12" height="9" rx="1.5" />
      <rect x="3" y="1" width="8" height="3" rx="1" opacity="0.6" />
      <circle cx="7" cy="7.5" r="1.5" fill="#0a0a0a" /><circle cx="7" cy="7.5" r="0.6" />
    </svg>
  );
}

// ── Packing: items into a `cols`-wide grid, first fit, reading order ──
export interface Packed<T> { item: T; col: number; row: number; w: number; h: number }
export function packSlots<T>(items: T[], cols: number, size: (item: T) => [number, number]): Packed<T>[] {
  const occ = new Set<string>(), key = (c: number, r: number) => `${c}:${r}`;
  const fits = (c: number, r: number, w: number, h: number) => {
    if (c + w - 1 > cols) return false;
    for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) if (occ.has(key(c + dc, r + dr))) return false;
    return true;
  };
  const out: Packed<T>[] = [];
  for (const item of items) {
    const [rawW, h] = size(item), w = Math.min(rawW, cols);   // wider than the grid: clamp, or the search never ends
    for (let r = 1, done = false; !done; r++) {
      for (let c = 1; c <= cols - w + 1; c++) {
        if (!fits(c, r, w, h)) continue;
        for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) occ.add(key(c + dc, r + dr));
        out.push({ item, col: c, row: r, w, h }); done = true; break;
      }
    }
  }
  return out;
}

// ── The slot grid: columns and rows grow with the window; empty slots show as sunken ghosts ──
export function useSlotGrid() {
  const [cols, setCols] = useState(4), [rowsFit, setRowsFit] = useState(MIN_ROWS);
  const ro = useRef<ResizeObserver | null>(null);
  // A ref callback: the area mounts inside AnimatePresence, so an effect on mount would be too late
  const areaRef = useCallback((el: HTMLDivElement | null) => {
    ro.current?.disconnect(); ro.current = null;
    if (!el) return;
    ro.current = new ResizeObserver(([e]) => {
      setCols(Math.max(MIN_COLS, Math.floor((e.contentRect.width + SLOT_GAP) / (SLOT + SLOT_GAP))));
      setRowsFit(Math.max(MIN_ROWS, Math.floor((e.contentRect.height + SLOT_GAP) / (SLOT + SLOT_GAP))));
    });
    ro.current.observe(el);
  }, []);
  return { cols, rowsFit, areaRef };
}
export const gridStyle = (cols: number, rows: number): React.CSSProperties => ({
  display: 'grid', gridTemplateColumns: `repeat(${cols}, ${SLOT}px)`, gridTemplateRows: `repeat(${rows}, ${SLOT}px)`, gap: SLOT_GAP,
});

// An empty slot. While something is being dragged it lights up as a drop target.
export function GhostSlot({ dragging, onDrop }: { dragging: boolean; onDrop: () => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { if (dragging) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(); }}
      style={{
        background: over && dragging ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.018)',
        boxShadow: over && dragging ? 'inset 0 0 0 1px rgba(99,102,241,0.45)'
          : dragging ? 'inset 0 0 0 1px rgba(99,102,241,0.14)'
          : 'inset 0 2px 6px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.04)',
        borderRadius: 8, transition: 'background 0.1s, box-shadow 0.1s',
      }}
    />
  );
}

// ── The search box and its filter button; the flyout drops under them ──
export function VaultSearch({ value, onChange, placeholder = 'Search vault…', filtering, filterOpen, toggleFilter, flyout }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  filtering: boolean; filterOpen: boolean; toggleFilter: () => void; flyout: ReactNode;
}) {
  return (
    <div className="shrink-0 px-2 pt-3 pb-2 border-b border-neutral-800/60 relative">
      <div className="flex items-center gap-1.5">
        <div className="flex-1 flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5">
          <svg viewBox="0 0 12 12" className="w-3 h-3 shrink-0 text-neutral-600" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="5" cy="5" r="3.5" /><line x1="7.8" y1="7.8" x2="10" y2="10" strokeLinecap="round" />
          </svg>
          <input
            type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
            className="flex-1 bg-transparent text-[10px] text-neutral-300 placeholder-neutral-600 outline-none font-mono"
          />
          {value && <button onClick={() => onChange('')} className="text-neutral-600 hover:text-neutral-400 text-[10px] leading-none">✕</button>}
        </div>
        <button
          onClick={toggleFilter} title="Filter and sort"
          className={`p-1.5 rounded-md border transition-colors text-[12px] leading-none font-mono ${
            filterOpen || filtering ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-400' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300'
          }`}
        >≡</button>
      </div>
      <AnimatePresence>
        {filterOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
            className="absolute top-full left-0 right-0 mt-1 z-20 bg-neutral-950 border border-neutral-800 rounded-lg p-3 shadow-2xl"
          >{flyout}</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// A row of choice chips in a flyout, under a small heading
export function FlyoutChoice<K extends string>({ label, options, value, onChange }: {
  label: string; options: { key: K; label: string; color?: string }[]; value: K; onChange: (k: K) => void;
}) {
  return (
    <>
      <div className="text-[8px] uppercase tracking-widest text-neutral-600 mb-2">{label}</div>
      <div className="flex flex-wrap gap-1 mb-3 last:mb-0">
        {options.map((o) => {
          const on = value === o.key, c = o.color ?? '#d4d4d4';
          return (
            <button
              key={o.key} onClick={() => onChange(o.key)}
              className="px-2 py-0.5 rounded text-[9px] font-medium border transition-colors"
              style={{ borderColor: on ? c : 'rgba(255,255,255,0.07)', color: on ? c : '#6b7280', background: on ? `${c}18` : 'transparent' }}
            >{o.label}</button>
          );
        })}
      </div>
    </>
  );
}

// The tab sidebar: one glyph button per tab
export function VaultTabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; glyph: ReactNode; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="w-9 shrink-0 border-r border-neutral-800/50 flex flex-col items-center pt-2 gap-0.5">
      {tabs.map((t) => (
        <button
          key={t.key} onClick={() => onChange(t.key)} title={t.label} aria-label={t.label} aria-pressed={value === t.key}
          className={`w-7 h-7 rounded-md flex items-center justify-center text-[12px] transition-all duration-100 ${
            value === t.key ? 'bg-neutral-800 text-neutral-100 shadow-inner' : 'text-neutral-600 hover:text-neutral-400 hover:bg-neutral-900/60'
          }`}
        >{t.glyph}</button>
      ))}
    </div>
  );
}

// The empty grid's message, with a big faint vault
export function VaultEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-neutral-600 text-[11px] text-center p-4">
      <VaultGlyph className="w-8 h-8 opacity-20" />
      {children}
    </div>
  );
}

// ── The window: title bar (drag it), close, the corner (resize it). Place and size are kept in the store. ──
export function VaultWindow({ open, title = 'Vault', onClose, footer, children }: {
  open: boolean; title?: string; onClose: () => void; footer?: ReactNode; children: ReactNode;
}) {
  const pos = useWorkbenchStore((s) => s.vaultPosition), size = useWorkbenchStore((s) => s.vaultSize);
  const setPos = useWorkbenchStore((s) => s.setVaultPosition), setSize = useWorkbenchStore((s) => s.setVaultSize);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const grow = useRef<{ x: number; y: number; ow: number; oh: number } | null>(null);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="vault-window"
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.15 }}
          style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.width, height: size.height }}
          className="z-[90] flex flex-col bg-neutral-950/97 backdrop-blur-sm border border-neutral-800 rounded-xl shadow-2xl overflow-hidden"
        >
          <div
            onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              setPos({
                x: Math.min(Math.max(d.ox + e.clientX - d.x, 0), Math.max(window.innerWidth - size.width, 0)),
                y: Math.min(Math.max(d.oy + e.clientY - d.y, 0), Math.max(window.innerHeight - size.height, 0)),
              });
            }}
            onPointerUp={(e) => { drag.current = null; e.currentTarget.releasePointerCapture(e.pointerId); }}
            className="shrink-0 flex items-center justify-between px-2.5 py-1.5 bg-neutral-900 border-b border-neutral-800 cursor-grab active:cursor-grabbing select-none touch-none"
          >
            <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-neutral-500 font-medium"><VaultGlyph className="w-3 h-3 opacity-70" />{title}</span>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} className="text-neutral-600 hover:text-neutral-300 text-[11px] leading-none px-1" aria-label="Close">✕</button>
          </div>
          {children}
          {footer && <div className="shrink-0 px-2.5 py-1.5 border-t border-neutral-800/60 text-[10px] text-neutral-500 leading-snug">{footer}</div>}
          <div
            onPointerDown={(e) => { e.stopPropagation(); grow.current = { x: e.clientX, y: e.clientY, ow: size.width, oh: size.height }; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => {
              const g = grow.current;
              if (!g) return;
              setSize({
                width: Math.min(Math.max(g.ow + e.clientX - g.x, MIN_W), window.innerWidth - pos.x),
                height: Math.min(Math.max(g.oh + e.clientY - g.y, MIN_H), window.innerHeight - pos.y),
              });
            }}
            onPointerUp={(e) => { grow.current = null; e.currentTarget.releasePointerCapture(e.pointerId); }}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize touch-none"
          >
            <svg viewBox="0 0 16 16" className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 text-neutral-600">
              <path d="M14 2 L2 14 M14 8 L8 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
