"use client";

// The parts every full-screen canvas is built from: the pan/zoom surface, the sheet on it, the messages over it,
// and the save dot in its panel.

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import type { useSheetView } from '@/workbench/hooks/useSheetView';
import type { SaveState } from '@/workbench/hooks/useDesignEditor';

type SheetView = ReturnType<typeof useSheetView>;

export const CANVAS_BG = 'absolute inset-0 bg-[#1e1c19]';

// The whole screen: pans and zooms the sheet (useSheetView). A press on the bare surface, not the sheet, calls onBackground.
export function SheetSurface({ sv, grab, onBackground, children, ...rest }: {
  sv: SheetView; grab: boolean; onBackground?: () => void; children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children'>) {
  return (
    <div
      ref={sv.surfaceRef} className="absolute inset-0 overflow-hidden"
      style={{ cursor: sv.spaceHeld || grab ? 'grab' : undefined, touchAction: 'none' }}
      {...sv.surfaceProps}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onBackground?.(); }}
      {...rest}
    >
      {children}
    </div>
  );
}

// The sheet at the view's pan and zoom. Without a size it takes its content's.
export function Sheet({ sv, size, style, className = '', children }: { sv: SheetView; size?: { width: number; height: number }; style?: CSSProperties; className?: string; children: ReactNode }) {
  const { x, y, scale } = sv.view;
  return (
    <div
      className={`absolute left-0 top-0 ${className}`}
      style={{ width: size?.width, height: size?.height, transformOrigin: '0 0', transform: `translate(${x}px, ${y}px) scale(${scale})`, boxShadow: '0 8px 30px rgba(0,0,0,0.5)', ...style }}
    >
      {children}
    </div>
  );
}

// A line at the bottom of the screen: something's wrong (error), or what a click will do (hint)
export function Banner({ tone = 'error', children }: { tone?: 'error' | 'hint'; children: ReactNode }) {
  const look = tone === 'error' ? 'max-w-[60%] truncate text-red-300 bg-red-950/90 border-red-800' : 'text-amber-200/90 bg-neutral-900/90 border-neutral-700/60';
  return (
    <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-30 text-[11px] font-mono border rounded px-3 py-1.5 ${look}`} title={typeof children === 'string' ? children : undefined}>
      {children}
    </div>
  );
}

// What the canvas says when there's nothing to show. `over`: drawn over a sheet, so it gets a backing.
export function EmptyNote({ over, children }: { over?: boolean; children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-center font-serif text-[#a59c8e] text-base px-6 pointer-events-none">
      {over ? <span className="bg-[#1e1c19]/80 rounded px-3 py-1.5">{children}</span> : children}
    </div>
  );
}

// The open file's save state, in the panel
export function SaveDot({ save, saved = 'Saved to disk' }: { save: SaveState; saved?: string }) {
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full shrink-0 ${save.kind === 'saving' ? 'bg-amber-400' : save.kind === 'error' || save.kind === 'conflict' ? 'bg-red-500' : 'bg-emerald-500'}`}
      title={'message' in save ? save.message : save.kind === 'saving' ? 'Saving…' : saved}
    />
  );
}
