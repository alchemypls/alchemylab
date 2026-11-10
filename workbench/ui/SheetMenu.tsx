"use client";

import { useCallback, useState, type MouseEvent } from 'react';
import { ClipboardCopy, ClipboardPaste, Copy, CopyPlus, FlipHorizontal2, Link2, PenLine, SquareDashedMousePointer, Trash2, Unlink2 } from 'lucide-react';
import { BackIcon, FrontIcon } from './OrderIcons';
import { useWorkbenchStore } from '@/lib/store';
import { getSlideDir } from '@/lib/scenes';
import { copyElements, duplicateElements, groupElements, pasteElements, PLANAR, ungroupElements, removeElements, reorderElements, updateElement, type Plane, type VElement } from '@/lib/design/vector';
import type { DesignPage } from '@/lib/design/types';
import { copyAsset, useVault } from '@/workbench/hooks/useVault';
import { PLANE_OPTIONS } from './ToolMenu';
import { getClip, putClip } from './vector/clipboard';
import { MENU_KEY as KEY, MENU_ROW as ROW, MenuRule, PopMenu } from './PopMenu';

// The right-click menu on a vector sheet (Ideation and Fab): what can be done to the selection, or to the page when
// nothing is under the pointer. Its frame is PopMenu.

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
  const welded = els.length > 1 && !!els[0].group && els.every((e) => e.group === els[0].group);
  const clip = els.length ? null : getClip();
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
          <button className={ROW} onClick={run(() => { const r = duplicateElements(page, at.ids); apply(r.page); select(r.ids); })}><Copy size={14} />Duplicate<span className={KEY}>Ctrl D</span></button>
          <button className={ROW} onClick={run(() => putClip(copyElements(page, at.ids)))}><ClipboardCopy size={14} />Copy<span className={KEY}>Ctrl C</span></button>
          {els.length > 1 && (welded
            ? <button className={ROW} onClick={run(() => apply(ungroupElements(page, at.ids)))}><Unlink2 size={14} />Ungroup<span className={KEY}>Ctrl ⇧ G</span></button>
            : <button className={ROW} onClick={run(() => apply(groupElements(page, at.ids)))}><Link2 size={14} />Group<span className={KEY}>Ctrl G</span></button>)}
          <button className={ROW} onClick={run(() => apply(reorderElements(page, at.ids, 'front')))}><FrontIcon size={14} />Bring to front</button>
          <button className={ROW} onClick={run(() => apply(reorderElements(page, at.ids, 'back')))}><BackIcon size={14} />Send to back</button>
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
          {only?.type === 'asset' && (
            <button className={ROW} onClick={run(() => apply(updateElement(page, only.id, { mirror: only.mirror ? undefined : true } as Partial<VElement>)))}>
              <FlipHorizontal2 size={14} />{only.mirror ? 'Unmirror' : 'Mirror'}
            </button>
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
                if ('error' in r) { window.alert(`Couldn't make it unique: ${r.error}`); return; }
                apply(updateElement(page, only.id, { asset: r.id } as Partial<VElement>));
                toFab(r.id);
              })}
            >
              <CopyPlus size={14} />Make unique
            </button>
          )}
          <MenuRule />
          <button className={`${ROW} text-red-300`} onClick={run(() => { apply(removeElements(page, at.ids)); select([]); })}><Trash2 size={14} />Delete<span className={KEY}>Del</span></button>
        </>
      ) : (
        <>
          <button className={ROW} disabled={!selectable.length} onClick={run(() => select(selectable))}><SquareDashedMousePointer size={14} />Select all</button>
          <button className={ROW} disabled={!clip} onClick={run(() => { if (!clip) return; const r = pasteElements(page, clip); apply(r.page); select(r.ids); })}><ClipboardPaste size={14} />Paste{clip && ` ${clip.elements.length}`}<span className={KEY}>Ctrl V</span></button>
        </>
      )}
    </PopMenu>
  );
}
