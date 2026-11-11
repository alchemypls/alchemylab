"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

// The app's own name box / confirm / notice, in place of window.prompt/confirm/alert (embedded browsers such as
// VS Code's refuse those). Await them anywhere; <AskHost /> (mounted once, app/page.tsx) draws the one open.
//   const name = await askText('Name this favorite');            → string, or null on cancel / empty
//   if (await askConfirm('Delete it?', { ok: 'Delete', danger: true })) …
//   await tell("Couldn't copy it");

type Ask = { text: string; input?: string; ok: string; cancel?: string; danger?: boolean; done: (v: string | null) => void };

let open: Ask | null = null;
const queue: Ask[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

function show(a: Omit<Ask, 'done'>) {
  return new Promise<string | null>((resolve) => {
    const ask: Ask = { ...a, done: (v) => { open = queue.shift() ?? null; emit(); resolve(v); } };
    if (open) queue.push(ask); else { open = ask; emit(); }
  });
}

export const askText = async (text: string, o: { value?: string; ok?: string } = {}) =>
  (await show({ text, input: o.value ?? '', ok: o.ok ?? 'OK', cancel: 'Cancel' }))?.trim() || null;
export const askConfirm = async (text: string, o: { ok?: string; danger?: boolean } = {}) =>
  (await show({ text, ok: o.ok ?? 'OK', cancel: 'Cancel', danger: o.danger })) !== null;
export const tell = async (text: string) => { await show({ text, ok: 'OK' }); };

const BTN = 'px-3 py-1 rounded-md text-[12px] border focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500';

export function AskHost() {
  const a = useSyncExternalStore(subscribe, () => open, () => null);
  return a ? <AskBox key={a.text + a.ok} a={a} /> : null;
}

function AskBox({ a }: { a: Ask }) {
  const [value, setValue] = useState(a.input ?? '');
  const field = useRef<HTMLInputElement>(null), okBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (a.input !== undefined) field.current?.select(); else okBtn.current?.focus(); }, [a]);
  const ok = () => a.done(a.input !== undefined ? value : '');
  const cancel = () => a.done(null);

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-start justify-center pt-[18vh] bg-black/50"
      // Keys and presses stay here: the sheet under it takes them as shortcuts and gestures otherwise
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); a.cancel ? cancel() : ok(); }
        else if (e.key === 'Enter' && e.target === field.current) { e.preventDefault(); ok(); }
      }}
      onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget && a.cancel) cancel(); }}
      onPointerMove={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div role="dialog" aria-modal className="w-[min(380px,calc(100vw-32px))] p-4 flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-950 shadow-[0_10px_40px_rgba(0,0,0,0.75)] text-neutral-200">
        <p className="text-[12px] leading-relaxed whitespace-pre-line">{a.text}</p>
        {a.input !== undefined && (
          <input
            ref={field} type="text" value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false}
            className="bg-neutral-800 text-neutral-200 text-xs px-2 py-1.5 rounded border border-neutral-700 focus:outline-none focus:border-sky-600"
          />
        )}
        <div className="flex justify-end gap-2">
          {a.cancel && <button onClick={cancel} className={`${BTN} border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80`}>{a.cancel}</button>}
          <button
            ref={okBtn} onClick={ok} disabled={a.input !== undefined && !value.trim()}
            className={`${BTN} disabled:opacity-35 ${a.danger ? 'border-red-900 bg-red-950/60 text-red-300 hover:bg-red-900/60' : 'border-neutral-700 bg-neutral-800 hover:bg-neutral-700'}`}
          >{a.ok}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
