"use client";

import { useCallback, useState, type MouseEvent } from 'react';
import { CopyPlus, PenLine } from 'lucide-react';
import { useWorkbenchStore } from '@/lib/store';
import { getSlideDir } from '@/lib/scenes';
import { actionsFor, keysLabel, type Action } from '@/lib/design/actions';
import { PLANAR, updateElement, type Plane, type VElement } from '@/lib/design/vector';
import type { DesignPage } from '@/lib/design/types';
import { copyAsset, useVault } from '@/workbench/hooks/useVault';
import { PLANE_OPTIONS } from './ToolMenu';
import { actionCtx, actionIcon, runAction } from './vector/actions';
import { MENU_KEY as KEY, MENU_ROW as ROW, MenuRule, PopMenu } from './PopMenu';
import { tell } from '@/workbench/ui/Ask';

// The right-click menu on a vector sheet (Ideation and Fab): what can be done to the selection, or to the page when
// nothing is under the pointer. Its frame is PopMenu. Most rows come from the action registry (lib/design/actions.ts);
// the rest need the vault or the canvas (plane, Edit in Fab, Make unique).

export interface SheetMenuAt { x: number; y: number; ids: string[] }

// Right-click on a row in a list (the layers box, the selection list): the sheet's menu for that row's element, or for
// the whole selection when the row is part of it. `menu` goes anywhere in the list's tree (it renders on <body>).
export function useRowMenu(page: DesignPage, apply: (next: DesignPage) => void, selected: string[], select: (ids: string[]) => void) {
  const [at, setAt] = useState<SheetMenuAt | null>(null);
  const close = useCallback(() => setAt(null), []);
  const open = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    const ids = selected.includes(id) ? selected : [id];
    select(ids); setAt({ x: e.clientX, y: e.clientY, ids });
  };
  const menu = at && <SheetMenu at={at} page={page} apply={apply} select={select} selectable={[]} close={close} />;
  return { open, menu };
}

export function SheetMenu({ at, page, apply, select, selectable, close }: {
  at: SheetMenuAt; page: DesignPage;
  apply: (next: DesignPage) => void; select: (ids: string[]) => void;
  selectable: string[];   // what Select all picks: not on a hidden or locked layer, not switched off in Select's menu
  close: () => void;
}) {
  const vault = useVault().entries;
  const setScene = useWorkbenchStore((s) => s.setActiveScene);
  const scene = useWorkbenchStore((s) => s.activeScene);
  const setEditor = useWorkbenchStore((s) => s.setFabEditor);
  const setFabAsset = useWorkbenchStore((s) => s.setFabAsset);

  const els = (page.elements ?? []).filter((e) => at.ids.includes(e.id));
  const run = (f: () => void) => () => { f(); close(); };
  const toFab = (id: string) => { const a = vault.find((v) => v.id === id)?.asset ?? asset; setEditor(a?.kind === 'block' ? 'blocks' : 'identity'); setFabAsset(id); setScene('fab', getSlideDir(scene, 'fab')); };
  const only: VElement | undefined = els.length === 1 ? els[0] : undefined;
  const ctx = actionCtx(page, at.ids, selectable), host = { apply, select };
  const acts = actionsFor(els.length ? 'selection' : 'page', ctx);
  const row = (a: Action) => (
    <button key={a.id} className={`${ROW} ${a.group === 'remove' ? 'text-red-300' : ''}`} title={a.hint} onClick={run(() => runAction(a, ctx, host))}>
      {actionIcon(a)}{a.label}{a.id === 'paste' && ctx.clip ? ` ${ctx.clip.elements.length}` : ''}
      {a.stage === 'lab' && <span className="text-[8px] uppercase tracking-wider text-sky-400/80" title="In the lab: new, still being tried out">lab</span>}
      {a.keys && <span className={KEY}>{keysLabel(a.keys)}</span>}
    </button>
  );
  const asset = only?.type === 'asset' ? vault.find((v) => v.id === only.asset)?.asset : undefined;
  const planar = els.length > 0 && els.every((e) => PLANAR.includes(e.type));
  const planeNow = planar && new Set(els.map((e) => ('plane' in e && e.plane) || 'none')).size === 1 ? (('plane' in els[0] && els[0].plane) || 'none') : null;
  const lay = (v: 'none' | Plane) => {
    let next = page;
    for (const e of els) next = updateElement(next, e.id, { plane: v === 'none' ? undefined : v, rotate: undefined, lift: undefined, slope: undefined, slopeAlong: undefined } as Partial<VElement>);
    apply(next);
  };

  return (
    <PopMenu x={at.x} y={at.y} close={close}>
      {els.length ? (
        <>
          <div className="px-2.5 pt-1 pb-1.5 text-[9px] uppercase tracking-widest text-amber-500">{only ? (asset ? asset.title : only.type) : `${els.length} selected`}</div>
          {acts.filter((x) => x.group !== 'remove').map(row)}
          {planar && (
            <div className="px-2.5 py-1.5">
              <div className="text-[9px] uppercase tracking-widest text-neutral-500 mb-1">Plane</div>
              <div className="flex rounded border border-neutral-700 overflow-hidden">
                {PLANE_OPTIONS.map((o) => (
                  <button
                    key={o.value} onClick={run(() => lay(o.value))} aria-pressed={planeNow === o.value}
                    className={`flex-1 py-0.5 text-[10px] ${planeNow === o.value ? 'bg-amber-500/20 text-amber-400' : 'text-neutral-400 hover:bg-neutral-800'}`}
                  >{o.label}</button>
                ))}
              </div>
            </div>
          )}
          {asset && only?.type === 'asset' && (
            <button className={ROW} title="Edit the vault piece: every placement of it changes" onClick={run(() => toFab(only.asset))}>
              <PenLine size={14} />Edit in Fab
            </button>
          )}
          {asset && only?.type === 'asset' && (
            <button
              className={ROW} title={`Copy "${asset.title}" to a new vault piece, put this one placement on it, and open it on Fab. The others stay as they are.`}
              onClick={run(async () => {
                const r = await copyAsset(asset);
                if ('error' in r) { void tell(`Couldn't make it unique: ${r.error}`); return; }
                apply(updateElement(page, only.id, { asset: r.id } as Partial<VElement>));
                toFab(r.id);
              })}
            >
              <CopyPlus size={14} />Make unique
            </button>
          )}
          <MenuRule />
          {acts.filter((x) => x.group === 'remove').map(row)}
        </>
      ) : (
        <>
          {acts.length ? acts.map(row) : <div className="px-2.5 py-1 text-[11px] text-neutral-500">Nothing to paste or select</div>}
        </>
      )}
    </PopMenu>
  );
}
