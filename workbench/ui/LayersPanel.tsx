"use client";

import { useState } from 'react';
import { Box, Circle, CircleDot, Eye, EyeOff, Grid3x3, Image as ImageIcon, Lock, Minus, MoveUpRight, Pentagon, PenLine, RectangleHorizontal, Shapes, Square, Sticker, Type, Unlock, type LucideIcon } from 'lucide-react';
import { useVault } from '@/workbench/hooks/useVault';
import { addLayer, layerOf, layersOf, moveLayer, moveToLayer, removeLayer, updateLayer, type VLayer } from '@/lib/design/layers';
import type { DesignPage } from '@/lib/design/types';
import type { VElement } from '@/lib/design/vector';

// A vector page's layers, top first, in the box under the minimap. Click a layer to draw on it.
// Each layer opens to list what's on it, and a click there selects it.

const BTN = 'text-[11px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30';
const ICON = 'w-5 h-5 shrink-0 rounded text-[11px] hover:bg-neutral-700/60';

const ICONS: Record<VElement['type'], LucideIcon> = {
  rect: Square, ellipse: Circle, capsule: RectangleHorizontal, poly: Pentagon, line: MoveUpRight, text: Type,
  image: ImageIcon, status: CircleDot, stroke: PenLine, zone: Grid3x3, asset: Box,
};
const ASSET_ICONS: Record<string, LucideIcon> = { block: Box, shape: Shapes, icon: Sticker };

// What an element is in a list, at a glance: its type, and for a vault piece its kind (block, shape, icon)
export function ElementIcon({ el }: { el: VElement }) {
  const vault = useVault().entries;
  const kind = el.type === 'asset' ? vault.find((v) => v.id === el.asset)?.asset.kind : undefined;
  const Icon = el.type === 'line' && el.arrow === 'none' ? Minus : (kind && ASSET_ICONS[kind]) || ICONS[el.type] || Square;
  const tint = el.type === 'zone' ? 'text-teal-400/80' : el.type === 'asset' ? 'text-amber-400/80' : el.type === 'text' ? 'text-sky-300/80' : 'text-neutral-500';
  return <Icon size={11} className={`shrink-0 ${tint}`} aria-label={kind ?? el.type} />;
}

// What an element is called in a list
export function elementLabel(el: VElement): string {
  if (el.name?.trim()) return el.name;
  switch (el.type) {
    case 'text': return el.text.trim().slice(0, 28) || (el.bind ? `Bound ${el.bind.field}` : 'Text');
    case 'zone': return `Floor ${el.cols}×${el.rows}`;
    case 'asset': return el.asset;
    case 'line': return el.arrow === 'none' ? 'Line' : 'Arrow';
    case 'stroke': return 'Pen stroke';
    case 'status': return `Status: ${el.topic}`;
    default: return el.type[0].toUpperCase() + el.type.slice(1);
  }
}

export function LayersPanel({ page, apply, active, setActive, selected, select, asset }: {
  page: DesignPage; apply: (next: DesignPage, key?: string) => void;
  active?: string; setActive: (id: string) => void;
  selected: string[]; select: (ids: string[]) => void;
  asset?: boolean;   // a vault asset: say what hiding means for placements
}) {
  const layers = layersOf(page), els = page.elements ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const on = (l: VLayer) => els.filter((e) => layerOf(layers, e).id === l.id);
  const cur = layers.find((l) => l.id === active);

  // Hiding or locking a layer lets go of what's selected on it
  const toggle = (l: VLayer, key: 'hidden' | 'locked') => {
    apply(updateLayer(page, l.id, { [key]: !l[key] || undefined }));
    if (!l[key]) { const off = new Set(on(l).map((e) => e.id)); select(selected.filter((id) => !off.has(id))); }
  };
  const add = () => { const r = addLayer(page, active); apply(r.page); setActive(r.id); setRenaming(r.id); };
  const remove = () => {
    if (!cur) return;
    const n = on(cur).length;
    if (n && !window.confirm(`Delete "${cur.name}" and the ${n} thing${n === 1 ? '' : 's'} on it?`)) return;
    apply(removeLayer(page, cur.id));
    select([]);
  };

  return (
    <div className="p-3 flex flex-col gap-3 text-xs text-neutral-300">
      <div className="flex flex-col gap-0.5">
        {[...layers].reverse().map((l) => {
          const mine = on(l), usable = !l.hidden && !l.locked;
          return (
            <div key={l.id} className="flex flex-col">
              <div
                className={`flex items-center gap-1 rounded px-1 py-0.5 ${l.id === active ? 'bg-amber-500/15 ring-1 ring-amber-600/60' : 'hover:bg-neutral-800'} ${usable ? 'cursor-pointer' : ''}`}
                onClick={() => usable && setActive(l.id)}
                title={usable ? 'Draw on this layer' : 'Hidden or locked: show and unlock it to draw on it'}
              >
                <button className={`${ICON} text-neutral-500`} onClick={(e) => { e.stopPropagation(); setOpen(open === l.id ? null : l.id); }} aria-label="List what's on it">{open === l.id ? '▾' : '▸'}</button>
                {renaming === l.id ? (
                  <input
                    autoFocus defaultValue={l.name} className="flex-1 min-w-0 bg-neutral-800 border border-neutral-600 rounded px-1 text-xs outline-none"
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => { const name = e.target.value.trim(); if (name && name !== l.name) apply(updateLayer(page, l.id, { name })); setRenaming(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null); e.stopPropagation(); }}
                  />
                ) : (
                  <span className={`flex-1 min-w-0 truncate ${l.hidden ? 'text-neutral-500 italic' : ''}`} onDoubleClick={() => setRenaming(l.id)} title="Double-click to rename">{l.name}</span>
                )}
                <span className="text-[9px] font-mono text-neutral-500">{mine.length}</span>
                <button className={`${ICON} ${l.hidden ? 'text-neutral-600' : 'text-neutral-300'}`} onClick={(e) => { e.stopPropagation(); toggle(l, 'hidden'); }} aria-label={l.hidden ? 'Show' : 'Hide'} title={l.hidden ? 'Hidden: click to show' : 'Hide'}>{l.hidden ? <EyeOff size={12} className="mx-auto" /> : <Eye size={12} className="mx-auto" />}</button>
                <button className={`${ICON} ${l.locked ? 'text-amber-400' : 'text-neutral-600'}`} onClick={(e) => { e.stopPropagation(); toggle(l, 'locked'); }} aria-label={l.locked ? 'Unlock' : 'Lock'} title={l.locked ? 'Locked: click to unlock' : 'Lock'}>{l.locked ? <Lock size={12} className="mx-auto" /> : <Unlock size={12} className="mx-auto" />}</button>
              </div>
              {open === l.id && (
                <div className="flex flex-col pl-7 py-0.5">
                  {!mine.length && <span className="text-[10px] text-neutral-600">Empty</span>}
                  {[...mine].reverse().map((e) => (
                    <button
                      key={e.id} disabled={!usable} onClick={() => select([e.id])}
                      className={`flex items-center gap-1.5 text-left text-[10px] px-1 rounded ${selected.includes(e.id) ? 'text-amber-400' : 'text-neutral-400 hover:text-white'} disabled:opacity-50`}
                    ><ElementIcon el={e} /><span className="truncate">{elementLabel(e)}</span></button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1">
        <button className={BTN} onClick={add}>+ Layer</button>
        <button className={BTN} disabled={!cur || layers[layers.length - 1].id === cur.id} onClick={() => cur && apply(moveLayer(page, cur.id, 1))} title="Move up">↑</button>
        <button className={BTN} disabled={!cur || layers[0].id === cur.id} onClick={() => cur && apply(moveLayer(page, cur.id, -1))} title="Move down">↓</button>
        <span className="flex-1" />
        <button className={`${BTN} !border-red-900 !text-red-300`} disabled={!cur || layers.length < 2} onClick={remove}>Delete</button>
      </div>
      {selected.length > 0 && cur && (
        <button className={`${BTN} self-start`} onClick={() => apply(moveToLayer(page, selected, cur.id))}>
          Move {selected.length} selected to {cur.name}
        </button>
      )}
      <p className="text-[10px] text-neutral-500 leading-relaxed">
        {asset
          ? 'Hidden layers start hidden where this is placed, and each placement can show or hide layers. Use one for each version, like Outline and Filled.'
          : 'New drawing goes on the highlighted layer. The agent sees hidden layers too, and knows you hid them.'}
      </p>
    </div>
  );
}
