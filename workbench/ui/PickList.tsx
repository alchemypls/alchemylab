"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';

// A dropdown drawn by the app instead of the browser's: a click opens it and it stays open until you pick,
// click outside or press Esc. Options can come in labelled groups. Used where a native <select> closed on release.

export type PickOption = { value: string; label: string; group?: string };

export function PickList({ value, options, onPick, className, title, children }: {
  value: string; options: PickOption[]; onPick: (value: string) => void;
  className?: string; title?: string;
  children?: ReactNode;   // the button's face; defaults to the picked option's label
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', esc, true);
    return () => { window.removeEventListener('pointerdown', away, true); window.removeEventListener('keydown', esc, true); };
  }, [open]);
  // The picked option scrolls into view when the list opens
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [open]);

  let lastGroup: string | undefined;
  return (
    <div ref={box} className="relative min-w-0">
      <button type="button" title={title} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`${className ?? ''} w-full text-left flex items-center gap-1`}>
        <span className="flex-1 truncate">{children ?? options.find((o) => o.value === value)?.label ?? value}</span>
        <span className="text-neutral-500 text-[8px]">▾</span>
      </button>
      {open && (
        <div ref={list} role="listbox" className="absolute left-0 right-0 top-full mt-0.5 z-50 max-h-64 overflow-y-auto rounded border border-neutral-700 bg-neutral-900 shadow-xl py-0.5">
          {options.map((o) => {
            const head = o.group !== lastGroup ? o.group : undefined;
            lastGroup = o.group;
            return (
              <div key={o.value}>
                {head && <div className="px-2 pt-1.5 pb-0.5 text-[8px] uppercase tracking-widest text-neutral-500">{head}</div>}
                <button
                  type="button" role="option" aria-selected={o.value === value}
                  onClick={() => { setOpen(false); onPick(o.value); }}
                  className={`w-full text-left px-2 py-0.5 text-[10px] font-mono truncate ${o.value === value ? 'bg-indigo-500/20 text-indigo-200' : 'text-neutral-300 hover:bg-neutral-800'}`}
                >{o.label}</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
