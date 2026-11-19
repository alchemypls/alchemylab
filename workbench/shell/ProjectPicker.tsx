"use client";

import { useState } from 'react';
import { Check, ChevronDown, Plus, Settings2 } from 'lucide-react';
import { useWorkbenchStore } from '@/lib/store';
import { useWorkspace } from '@/workbench/hooks/useWorkspace';
import { MENU_ROW as ROW, MenuRule, PopMenu } from '@/workbench/ui/PopMenu';

// The workspace project in the panel header (lib/workspace.ts): switches every canvas at once. Its menu lists the
// projects (archived ones under their own heading), New project… and Project settings… (opened by CanvasPanel).
export function ProjectPicker({ openSettings }: { openSettings: (mode: 'edit' | 'new') => void }) {
  const { projects, current, pid } = useWorkspace();
  const touch = useWorkbenchStore((s) => s.touchProject);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const open = projects.filter((p) => !p.archived), archived = projects.filter((p) => p.archived);
  const run = (f: () => void) => () => { setMenu(null); f(); };
  const row = (p: typeof projects[number]) => (
    <button key={p.id} className={`${ROW} ${p.archived ? 'text-neutral-500' : ''}`} onClick={run(() => touch(p.id))} title={[p.bible && 'bible', p.web && 'web project'].filter(Boolean).join(' + ')}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.accent ?? '#737373' }} />
      <span className="truncate flex-1">{p.name}</span>
      {p.id === pid && <Check size={13} className="text-amber-400" />}
    </button>
  );

  return (
    <>
      <button
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.left, y: r.bottom + 4 }); }}
        className="ml-auto min-w-0 max-w-[170px] flex items-center gap-1.5 px-1.5 py-0.5 rounded-md border border-neutral-700/60 hover:border-neutral-500 text-[10px] text-neutral-200"
        title="Project: switches every canvas"
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: current?.accent ?? '#737373' }} />
        <span className="truncate">{current?.name ?? pid}</span>
        <ChevronDown size={11} className="shrink-0 text-neutral-500" />
      </button>
      {menu && (
        <PopMenu x={menu.x} y={menu.y} close={() => setMenu(null)}>
          <div className="px-2.5 pt-1 pb-1.5 text-[9px] uppercase tracking-widest text-amber-500">Projects</div>
          {open.map(row)}
          {archived.length > 0 && <><MenuRule /><div className="px-2.5 pt-1 pb-1 text-[9px] uppercase tracking-widest text-neutral-600">Archived</div>{archived.map(row)}</>}
          <MenuRule />
          <button className={ROW} onClick={run(() => openSettings('new'))}><Plus size={14} />New project…</button>
          <button className={ROW} onClick={run(() => openSettings('edit'))} disabled={!current}><Settings2 size={14} />Project settings…</button>
        </PopMenu>
      )}
    </>
  );
}
