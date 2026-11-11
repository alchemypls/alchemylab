"use client";

import { useRef, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Trash2, Plus, X } from 'lucide-react';
import { useWorkbenchStore } from '@/lib/store';
import { ROW_HEIGHT, getEffectiveLayers, isOverridden, resolvePlacement, type PageLayout, type PagePlacement, type PlacementGeom } from '@/lib/project';
import { TIERS, TIER_COLUMNS, type Tier } from '@/lib/devices';
import type { ProjectComponent } from '@/lib/library';
import { askConfirm } from '@/workbench/ui/Ask';

// The Web canvas's layout layer, editable: the page's placements on the tier's column grid. Drag a block to move it,
// its corner to resize; both snap to columns and rows. Edits on a wider tier are that tier's own (mobile-first:
// mobile is the base). A component picked in the Components box (or dragged from it) lands where you click.

export type Placing = string | null;   // a component id being placed

// Reading order at this tier: top to bottom, then left to right. Hidden ones aren't numbered.
export function readingOrder(placements: PagePlacement[], tier: Tier): Map<string, number> {
  const out = new Map<string, number>();
  placements.map((p) => ({ p, g: resolvePlacement(p, tier) })).filter(({ g }) => !g.hidden)
    .sort((a, b) => a.g.row - b.g.row || a.g.col - b.g.col).forEach(({ p }, i) => out.set(p.id, i + 1));
  return out;
}

// A new placement at (col, row) on this tier. On a wider tier the mobile base is a full-width row at the same
// height, and what you placed is pinned for that tier only.
export function newPlacement(componentId: string, tier: Tier, col: number, row: number): PagePlacement {
  const cols = TIER_COLUMNS[tier], colSpan = Math.max(1, Math.round(cols / 2));
  const here = { col: Math.min(cols - colSpan, Math.max(0, col)), row: Math.max(0, row), colSpan, rowSpan: 1 };
  const id = `pl-${Date.now().toString(36)}`;
  return tier === 'mobile' ? { id, componentId, ...here }
    : { id, componentId, col: 0, row: here.row, colSpan: TIER_COLUMNS.mobile, rowSpan: 1, at: { [tier]: here } };
}

type Drag = { id: string; kind: 'move' | 'resize'; dx: number; dy: number; g: PlacementGeom };

export function LayoutEditor({ pid, path, placements, tier, colWidth, width, components, selected, select, placing, donePlacing, scale, editing }: {
  pid: string; path: string; placements: PagePlacement[]; tier: Tier; colWidth: number; width: number;
  components: Record<string, ProjectComponent> | undefined;
  selected: string | null; select: (id: string | null) => void;
  placing: Placing; donePlacing: () => void;
  scale: number;      // screen px per page px: keeps the block's buttons a steady size on screen
  editing: boolean;   // the select tool is in hand (otherwise the hand pans and blocks only show)
}) {
  const addPlacement    = useWorkbenchStore((s) => s.addPlacement);
  const removePlacement = useWorkbenchStore((s) => s.removePlacement);
  const setGeom         = useWorkbenchStore((s) => s.setPlacementGeom);
  const resetTier       = useWorkbenchStore((s) => s.resetPlacementTier);
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const cols = TIER_COLUMNS[tier], tierLabel = TIERS.find((t) => t.id === tier)!.label;
  const numbers = readingOrder(placements, tier);

  const at = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect(), k = r.width / width;
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };
  const place = (componentId: string, e: { clientX: number; clientY: number }) => {
    const p = at(e), pl = newPlacement(componentId, tier, Math.floor(p.x / colWidth), Math.floor(p.y / ROW_HEIGHT));
    addPlacement(pid, path, pl);
    select(pl.id);
  };

  const start = (e: React.PointerEvent, p: PagePlacement, kind: Drag['kind']) => {
    if (!editing || e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const g = resolvePlacement(p, tier), q = at(e);
    select(p.id);
    setDrag({ id: p.id, kind, dx: q.x - g.col * colWidth, dy: q.y - g.row * ROW_HEIGHT, g });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const q = at(e), g = drag.g;
    setDrag({
      ...drag,
      g: drag.kind === 'move'
        ? { ...g, col: Math.min(cols - g.colSpan, Math.max(0, Math.round((q.x - drag.dx) / colWidth))), row: Math.max(0, Math.round((q.y - drag.dy) / ROW_HEIGHT)) }
        : { ...g, colSpan: Math.min(cols - g.col, Math.max(1, Math.round(q.x / colWidth - g.col))), rowSpan: Math.max(1, Math.round(q.y / ROW_HEIGHT - g.row)) },
    });
  };
  const end = () => {
    if (!drag) return;
    const p = placements.find((x) => x.id === drag.id), was = p && resolvePlacement(p, tier);
    if (p && was) {
      const { col, row, colSpan, rowSpan } = drag.g;
      if (drag.kind === 'move' && (col !== was.col || row !== was.row)) setGeom(pid, path, p.id, tier, { col, row });
      if (drag.kind === 'resize' && (colSpan !== was.colSpan || rowSpan !== was.rowSpan)) setGeom(pid, path, p.id, tier, { colSpan, rowSpan });
    }
    setDrag(null);
  };
  const btn = 'p-1 rounded text-neutral-300 hover:text-white hover:bg-neutral-700';

  return (
    <div
      ref={ref} className="absolute inset-0"
      style={{ cursor: placing ? 'copy' : undefined, pointerEvents: editing || placing ? 'auto' : 'none' }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if (placing) { e.stopPropagation(); place(placing, e); donePlacing(); }
        else if (editing) select(null);
      }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('text/plain')) e.preventDefault(); }}
      onDrop={(e) => {
        let id: string | undefined;
        try { id = JSON.parse(e.dataTransfer.getData('text/plain')).componentId; } catch { return; }
        if (!id || !components?.[id]) return;
        e.preventDefault(); place(id, e);
      }}
    >
      {placements.map((p) => {
        const g0 = resolvePlacement(p, tier), g = drag?.id === p.id ? drag.g : g0;
        const comp = components?.[p.componentId], color = p.color ?? '#818cf8', custom = isOverridden(p, tier), on = selected === p.id;
        return (
          <div
            key={p.id} className="absolute p-1 touch-none"
            style={{
              left: g.col * colWidth, top: g.row * ROW_HEIGHT, width: g.colSpan * colWidth, height: g.rowSpan * ROW_HEIGHT,
              opacity: g0.hidden ? 0.35 : 1, zIndex: drag?.id === p.id ? 3 : on ? 2 : 1, cursor: editing ? 'grab' : undefined,
            }}
            onPointerDown={(e) => start(e, p, 'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={() => setDrag(null)}
          >
            <div
              className={`relative w-full h-full rounded-md border-2 flex items-start gap-1.5 p-2 overflow-hidden ${g0.hidden ? 'border-dashed' : ''}`}
              style={{ borderColor: on ? '#f59e0b' : color, background: `${color}26` }}
            >
              {numbers.has(p.id) && <span className="text-[11px] font-mono font-bold rounded px-1 shrink-0" style={{ background: color, color: '#0a0a0a' }}>{numbers.get(p.id)}</span>}
              <span className={`text-[12px] font-sans truncate ${comp ? 'text-neutral-800' : 'text-rose-700'}`}>{p.name ?? comp?.recipe.name ?? `missing: ${p.componentId}`}</span>
              <span className="ml-auto text-[10px] font-mono text-neutral-500 shrink-0">{g0.hidden ? `hidden on ${tierLabel}` : `${g.col + 1}–${g.col + g.colSpan}`}</span>
              {custom && <span className="absolute bottom-1 left-2 text-[9px] font-mono uppercase tracking-widest text-indigo-600" title={`Placed for ${tierLabel} only`}>● {tierLabel}</span>}
            </div>
            {on && editing && (
              <>
                {/* corner: resize */}
                <div
                  className="absolute right-0 bottom-0 bg-amber-500 rounded-sm cursor-nwse-resize"
                  style={{ width: 12 / scale, height: 12 / scale }}
                  onPointerDown={(e) => start(e, p, 'resize')} onPointerMove={move} onPointerUp={end}
                />
                {/* this block on this tier: hide, back to inherited, delete */}
                <div
                  className="absolute right-0 flex items-center gap-0.5 bg-neutral-900/95 border border-neutral-700 rounded-md px-0.5"
                  style={{ top: 0, transform: `translateY(-100%) scale(${1 / scale})`, transformOrigin: '100% 100%' }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button className={btn} title={g0.hidden ? `Show on ${tierLabel}` : `Hide on ${tierLabel}`} onClick={() => setGeom(pid, path, p.id, tier, { hidden: !g0.hidden })}>
                    {g0.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  {custom && tier !== 'mobile' && (
                    <button className={btn} title={`Undo the ${tierLabel} placement: inherit it again`} onClick={() => resetTier(pid, path, p.id, tier)}><RotateCcw size={13} /></button>
                  )}
                  <button className={`${btn} hover:text-red-400`} title="Delete (Del)" onClick={() => { removePlacement(pid, path, p.id); select(null); }}><Trash2 size={13} /></button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// The project's components, in the box under the minimap: pick one, then click the page to place it (or drag it
// there). Ones on this page come first with their numbers.
export function ComponentsBox({ components, placements, tier, placing, setPlacing }: {
  components: Record<string, ProjectComponent> | undefined; placements: PagePlacement[]; tier: Tier;
  placing: Placing; setPlacing: (id: Placing) => void;
}) {
  const numbers = readingOrder(placements, tier), numbersOf = new Map<string, number[]>();
  placements.forEach((p) => { const n = numbers.get(p.id); if (n) numbersOf.set(p.componentId, [...(numbersOf.get(p.componentId) ?? []), n].sort((a, b) => a - b)); });
  const all = Object.values(components ?? {});
  const onPage = all.filter((c) => numbersOf.has(c.id)).sort((a, b) => numbersOf.get(a.id)![0] - numbersOf.get(b.id)![0]);
  const rest = all.filter((c) => !numbersOf.has(c.id));
  const row = (c: ProjectComponent) => (
    <button
      key={c.id} draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'project-component', componentId: c.id })); e.dataTransfer.effectAllowed = 'copy'; }}
      onClick={() => setPlacing(placing === c.id ? null : c.id)}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border text-left ${placing === c.id ? 'border-amber-500/70 bg-amber-500/10' : 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-500'} ${numbersOf.has(c.id) ? '' : 'opacity-60 hover:opacity-100'}`}
      title={`${c.recipe.name}: click, then click the page to place it (or drag it there)`}
    >
      <span className="text-[12px] text-neutral-200 truncate flex-1">{c.recipe.name}</span>
      <span className="text-[10px] text-neutral-500 font-mono">{c.recipe.category}</span>
      {numbersOf.get(c.id)?.map((n) => <span key={n} className="min-w-[16px] h-4 px-1 rounded-full bg-indigo-500/80 text-white text-[9px] font-mono leading-4 text-center">{n}</span>)}
    </button>
  );
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Components</span>
      {!all.length && <span className="text-[11px] text-neutral-500 italic py-3 text-center">None yet: make them on Fab → Components.</span>}
      {onPage.map(row)}
      {onPage.length > 0 && rest.length > 0 && <span className="text-[9px] uppercase tracking-widest text-neutral-600 mt-2">Not on this page</span>}
      {rest.map(row)}
    </div>
  );
}

// Alternative layouts of one page: only the active one shows and ships. Add, switch, delete.
export function VariantsBox({ pid, path, layout }: { pid: string; path: string; layout: PageLayout | undefined }) {
  const addLayer       = useWorkbenchStore((s) => s.addLayer);
  const removeLayer    = useWorkbenchStore((s) => s.removeLayer);
  const setActiveLayer = useWorkbenchStore((s) => s.setActiveLayer);
  const layers = layout ? getEffectiveLayers(layout) : [];
  const activeId = layout?.activeLayerId ?? layers[0]?.id;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Layout variants</span>
      {!layout && <span className="text-[11px] text-neutral-500 italic">Place a component first.</span>}
      {layers.map((l) => (
        <div key={l.id} className={`group flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer ${l.id === activeId ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-neutral-700 hover:border-neutral-500'}`} onClick={() => setActiveLayer(pid, path, l.id)}>
          <span className="text-[12px] text-neutral-200 flex-1 truncate">{l.name}</span>
          <span className="text-[10px] font-mono text-neutral-500">{l.placements.length}</span>
          {layers.length > 1 && (
            <button onClick={async (e) => { e.stopPropagation(); if (await askConfirm(`Delete layout "${l.name}" and its ${l.placements.length} blocks?`, { ok: 'Delete', danger: true })) removeLayer(pid, path, l.id); }} className="text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100" title="Delete this variant"><X size={12} /></button>
          )}
        </div>
      ))}
      {layout && (
        <button onClick={() => addLayer(pid, path, `Layout ${layers.length + 1}`)} className="flex items-center justify-center gap-1 py-1.5 rounded border border-dashed border-neutral-700 text-[11px] text-neutral-400 hover:text-neutral-100">
          <Plus size={12} /> New variant
        </button>
      )}
      <span className="text-[10px] text-neutral-500 leading-snug mt-1">Only the active variant shows on the page and goes into the code.</span>
    </div>
  );
}
