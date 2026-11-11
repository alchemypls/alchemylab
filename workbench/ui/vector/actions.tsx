"use client";

// The action registry (lib/design/actions.ts) on screen: icons, running one, and the selection bar.

import type { ReactNode } from 'react';
import { ClipboardCopy, ClipboardPaste, Copy, FlipHorizontal2, FlipVertical2, Link2, RotateCcw, RotateCw, Scissors, SquareDashedMousePointer, Trash2, Unlink2 } from 'lucide-react';
import { actionsFor, type Action, type ActionCtx } from '@/lib/design/actions';
import type { DesignPage } from '@/lib/design/types';
import { AuxBar, AuxButton } from '../AuxDock';
import { BackIcon, FrontIcon } from '../OrderIcons';
import { getClip, putClip } from './clipboard';

// Optional: an action without an icon here shows its glyph
const ICONS: Record<string, ReactNode> = {
  duplicate: <Copy size={14} />, copy: <ClipboardCopy size={14} />, cut: <Scissors size={14} />, paste: <ClipboardPaste size={14} />,
  'select-all': <SquareDashedMousePointer size={14} />, group: <Link2 size={14} />, ungroup: <Unlink2 size={14} />,
  front: <FrontIcon size={14} />, back: <BackIcon size={14} />, 'flip-x': <FlipHorizontal2 size={14} />, 'flip-y': <FlipVertical2 size={14} />,
  'turn-cw': <RotateCw size={14} />, 'turn-ccw': <RotateCcw size={14} />, delete: <Trash2 size={14} />,
};
export const actionIcon = (a: Action) => ICONS[a.id] ?? <span className="inline-block w-3.5 text-center leading-none">{a.glyph}</span>;

export interface ActionHost { apply: (next: DesignPage) => void; select: (ids: string[]) => void }

// The context an action sees: the clipboard is read only when needed (it's in localStorage)
export const actionCtx = (page: DesignPage, ids: string[], selectable?: string[]): ActionCtx => ({ page, ids, selectable, get clip() { return getClip(); } });

export function runAction(a: Action, c: ActionCtx, host: ActionHost) {
  const r = a.run(c);
  if (r.clip) putClip(r.clip);
  if (r.page) host.apply(r.page);
  if (r.ids) host.select(r.ids);
}

// Beside the properties box while something is selected: the actions marked `bar`. Lab ones carry a dot
export function SelectionBar({ page, selected, host }: { page: DesignPage | null | undefined; selected: string[]; host: ActionHost }) {
  if (!page || !selected.length) return null;
  const c = actionCtx(page, selected), list = actionsFor('selection', c).filter((a) => a.bar);
  if (!list.length) return null;
  return (
    <AuxBar>
      {list.map((a) => (
        <span key={a.id} className="relative">
          <AuxButton title={`${a.label}${a.keys ? ` (${a.keys})` : ''}${a.hint ? `\n${a.hint}` : ''}${a.stage === 'lab' ? '\nIn the lab: new, still being tried out' : ''}`} onClick={() => runAction(a, c, host)}>{actionIcon(a)}</AuxButton>
          {a.stage === 'lab' && <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-sky-400 pointer-events-none" />}
        </span>
      ))}
    </AuxBar>
  );
}
