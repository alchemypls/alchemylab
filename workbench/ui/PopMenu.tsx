"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// The frame every right-click menu shares (the sheet's, the vault's): rendered on <body> so zoom doesn't move it, kept
// on screen, closed by a press elsewhere, the wheel, Esc or leaving the window.

export const MENU_ROW = 'w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[12px] rounded-md hover:bg-neutral-800/80 disabled:opacity-35 disabled:hover:bg-transparent';
export const MENU_KEY = 'ml-auto pl-4 text-[10px] font-mono text-neutral-500';
export const MenuRule = () => <div className="my-1 border-t border-neutral-800" />;

export function PopMenu({ x, y, close, children }: { x: number; y: number; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: Math.min(x, window.innerWidth - r.width - 8), y: Math.min(y, window.innerHeight - r.height - 8) });
  }, [x, y]);
  useEffect(() => {
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('wheel', close, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('wheel', close, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', close);
    };
  }, [close]);

  return createPortal(
    <div
      ref={ref} role="menu"
      // A portal still bubbles React events up its React parents: a sheet would take this press as a drawing gesture
      // (and capture the pointer, so the button never gets its click)
      onPointerDown={(e) => e.stopPropagation()} onPointerMove={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      className="fixed z-[300] min-w-[190px] p-1 rounded-lg border border-neutral-800 bg-neutral-950 shadow-[0_10px_40px_rgba(0,0,0,0.75)] text-neutral-200"
      style={{ left: pos.x, top: pos.y }}
    >
      {children}
    </div>,
    document.body,
  );
}
