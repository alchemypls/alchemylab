"use client";

import { useMemo, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Trash2, Plus, X } from 'lucide-react';
import { useWorkbenchStore } from '@/lib/store';
import { GROUP, ROW_HEIGHT, componentOf, nest, getEffectiveLayers, isGroup, isOverridden, geometryAt, readingOrder, type Insets, type PageLayout, type PagePlacement } from '@/lib/project';
import { themeScope } from '@/workbench/ui/RecipeView';
import { PageGrid, cellBox, planCellStyle, rowOf } from './PageGrid';
import { DIRS, useLayoutDrag } from './useLayoutDrag';
import { LayoutMenu, useBlockActions, type LayoutMenuAt } from './LayoutMenu';
import { Sizer } from './WebLayers';
import { TIERS, TIER_COLUMNS, type Tier } from '@/lib/devices';
import type { ProjectComponent } from '@/lib/library';
import { askConfirm } from '@/workbench/ui/Ask';

// The Web canvas's layout layer, editable: the page's placements on the tier's grid, drawn as the export lays it out
// (PageGrid: rows grow with their content, real gutters), so a block is as big as it will be in Live. Drag a block to
// move it, any edge or corner to resize: it follows the pointer, a ghost shows where it lands, and blocks in the way
// move down (layoutEdit; the pointer work is useLayoutDrag). A group is a grid of its own inside its box: click inside it to place there, drag a block
// into one or out onto the page (the ghost lands in whatever group is under the pointer). Arrow keys nudge the
// selected block, Shift + arrows resize it (WebCanvas). Edits on a wider tier are that tier's own (mobile-first:
// mobile is the base). A component picked in the Components box (or dragged from it) lands where you click.

export type Placing = string | null;   // a component id being placed (GROUP: a group)

export function LayoutEditor({ pid, path, placements, tier, ins, width, components, selected, select, placing, donePlacing, scale, editing, onHeight }: {
  pid: string; path: string; placements: PagePlacement[]; tier: Tier; ins: Insets; width: number;
  components: Record<string, ProjectComponent> | undefined;
  selected: string | null; select: (id: string | null) => void;
  placing: Placing; donePlacing: () => void;
  scale: number;      // screen px per page px: keeps the block's buttons a steady size on screen
  editing: boolean;   // the select tool is in hand (otherwise the hand pans and blocks only show)
  onHeight?: (h: number) => void;
}) {
  const removePlacement = useWorkbenchStore((s) => s.removePlacement);
  const setGeom         = useWorkbenchStore((s) => s.setPlacementGeom);
  const resetTier       = useWorkbenchStore((s) => s.resetPlacementTier);
  const { grid, groupEls, drag, cancel, place, start, move, end } = useLayoutDrag({ pid, path, placements, tier, select, editing, placing });
  const actions = useBlockActions({ pid, path, placements, tier, select });
  const [menu, setMenu] = useState<LayoutMenuAt | null>(null);
  const openMenu = (e: React.MouseEvent, id: string | null) => { e.preventDefault(); e.stopPropagation(); if (drag) return; select(id); setMenu({ x: e.clientX, y: e.clientY, id }); };
  const tierLabel = TIERS.find((t) => t.id === tier)!.label;
  const numbers = useMemo(() => readingOrder(placements, tier), [placements, tier]);   // once per edit, not per drag frame
  const geo = useMemo(() => geometryAt(placements, tier), [placements, tier]);
  const btn = 'p-1 rounded text-neutral-300 hover:text-white hover:bg-neutral-700';
  const t = drag?.tracks, ghost = t && drag ? cellBox(t, drag.to) : null;
  const handle = 12 / scale;   // a steady 12px on screen

  // One block, and a group's blocks inside it (its cell is their grid)
  const cell = (p: PagePlacement, inner: React.ReactNode[]): React.ReactNode => {
    const { g, top } = geo.get(p.id)!, group = isGroup(p);
    const comp = componentOf(components, p), color = p.color ?? (group ? '#64748b' : '#818cf8'), custom = isOverridden(p, tier), on = selected === p.id, moving = drag?.id === p.id;
    const name = p.name ?? (group ? 'Group' : comp?.recipe.name) ?? `missing: ${p.componentId}`;
    return (
      <div
        key={p.id} className="touch-none"
        ref={group ? (el) => { if (el) groupEls.current.set(p.id, el); else groupEls.current.delete(p.id); } : undefined}
        style={{
          ...planCellStyle(p, g, ins, top), opacity: g.hidden ? 0.35 : moving ? 0.25 : 1, zIndex: on ? 2 : 1, cursor: editing ? 'grab' : undefined, minHeight: ROW_HEIGHT,
          ...(drag && drag.kind === 'move' && group && drag.into === p.id && { outline: '2px solid #f59e0b', outlineOffset: 2 }),
        }}
        onPointerDown={(e) => start(e, p, 'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={() => cancel()}
        onContextMenu={editing ? (e) => openMenu(e, p.id) : undefined}
      >
        {!g.hidden && !group && <Sizer placement={p} component={comp} here={path} />}
        {group ? (
          // a group: a dashed frame under its blocks, its name on the top edge
          <div className={`absolute inset-0 rounded-md border-2 border-dashed pointer-events-none`} style={{ borderColor: on ? '#f59e0b' : color, background: `${color}14` }}>
            <span className="absolute -top-2.5 left-2 flex items-center gap-1 text-[10px] font-mono rounded px-1 whitespace-nowrap" style={{ background: on ? '#f59e0b' : color, color: '#fff' }}>
              {numbers.get(p.id)} · {name} · {g.colSpan} cols{custom ? ` · ● ${tierLabel}` : ''}{g.hidden ? ` · hidden on ${tierLabel}` : ''}
            </span>
          </div>
        ) : (
          <div
            className={`absolute inset-0 rounded-md border-2 flex items-start gap-1.5 p-2 overflow-hidden ${g.hidden ? 'border-dashed' : ''}`}
            style={{ borderColor: on ? '#f59e0b' : color, background: `${color}26` }}
          >
            {numbers.has(p.id) && <span className="text-[11px] font-mono font-bold rounded px-1 shrink-0" style={{ background: color, color: '#0a0a0a' }}>{numbers.get(p.id)}</span>}
            <span className={`text-[12px] font-sans truncate ${comp ? 'text-neutral-800' : 'text-rose-700'}`}>{name}</span>
            <span className="ml-auto text-[10px] font-mono text-neutral-500 shrink-0">{g.hidden ? `hidden on ${tierLabel}` : `${g.col + 1}–${g.col + g.colSpan}`}</span>
            {custom && <span className="absolute bottom-1 left-2 text-[9px] font-mono uppercase tracking-widest text-indigo-600" title={`Placed its own way on ${tierLabel}`}>● {tierLabel}</span>}
          </div>
        )}
        {!g.hidden && inner}
        {on && editing && (
          <>
            {/* every edge and corner resizes: a square on each, and the whole edge grabbable. They stay mounted through the
                drag (hidden): the pointer is captured by the one grabbed, and unmounting it would drop the drag once the
                pointer leaves the block, so a block could shrink but never grow back */}
            {(['n', 's', 'e', 'w'] as const).map((d) => (
              <div
                key={`edge-${d}`} className="absolute"
                style={{
                  cursor: `${d}-resize`, zIndex: 3,
                  // mostly outside the edge (a quarter in): on a short block, edges half inside would cover the whole
                  // block, and a press meant to move it would resize it instead
                  ...(d === 'n' || d === 's' ? { left: 0, right: 0, height: handle, [d === 'n' ? 'top' : 'bottom']: -handle * 0.75 } : { top: 0, bottom: 0, width: handle, [d === 'w' ? 'left' : 'right']: -handle * 0.75 }),
                }}
                onPointerDown={(e) => start(e, p, d)} onPointerMove={move} onPointerUp={end} onPointerCancel={() => cancel()}
              />
            ))}
            {DIRS.map((d) => (
              <div
                key={d} className="absolute bg-amber-500 rounded-sm"
                style={{
                  width: handle, height: handle, cursor: `${d}-resize`, zIndex: 4, opacity: drag ? 0 : 1,
                  left: d.includes('w') ? -handle / 2 : d.includes('e') ? `calc(100% - ${handle / 2}px)` : `calc(50% - ${handle / 2}px)`,
                  top: d.includes('n') ? -handle / 2 : d.includes('s') ? `calc(100% - ${handle / 2}px)` : `calc(50% - ${handle / 2}px)`,
                }}
                onPointerDown={(e) => start(e, p, d)} onPointerMove={move} onPointerUp={end} onPointerCancel={() => cancel()}
              />
            ))}
          </>
        )}
        {on && editing && !drag && (
          <>
            {/* this block on this tier: hide, back to inherited, delete */}
            <div
              className="absolute right-0 flex items-center gap-0.5 bg-neutral-900/95 border border-neutral-700 rounded-md px-0.5"
              style={{ top: -handle, transform: `translateY(-100%) scale(${1 / scale})`, transformOrigin: '100% 100%', zIndex: 3 }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button className={btn} title={g.hidden ? `Show on ${tierLabel}` : `Hide on ${tierLabel}`} onClick={() => setGeom(pid, path, p.id, tier, { hidden: !g.hidden })}>
                {g.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              {custom && tier !== 'mobile' && (
                <button className={btn} title={`Undo the ${tierLabel} placement: inherit it again`} onClick={() => resetTier(pid, path, p.id, tier)}><RotateCcw size={13} /></button>
              )}
              <button className={`${btn} hover:text-red-400`} title={group ? 'Delete the group and what is in it (Del)' : 'Delete (Del)'} onClick={() => { removePlacement(pid, path, p.id); select(null); }}><Trash2 size={13} /></button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div
      className="absolute inset-0"
      // nothing on the layout is text to select (labels, the invisible sizing copies): a selection would hijack the next drag
      style={{ cursor: placing ? 'copy' : undefined, pointerEvents: editing || placing ? 'auto' : 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if (placing) { e.stopPropagation(); place(placing, e); donePlacing(); }
        else if (editing) select(null);
      }}
      onContextMenu={editing && !placing ? (e) => openMenu(e, null) : undefined}   // empty grid: place something here
      onDragStart={(e) => e.preventDefault()}   // nothing inside drags natively (an image, leftover text); the components box's drags start outside
      onDragOver={(e) => { if (e.dataTransfer.types.includes('text/plain')) e.preventDefault(); }}
      onDrop={(e) => {
        let id: string | undefined;
        try { id = JSON.parse(e.dataTransfer.getData('text/plain')).componentId; } catch { return; }
        if (!id || (id !== GROUP && !components?.[id])) return;
        e.preventDefault(); place(id, e);
      }}
    >
      <PageGrid ref={grid} cols={TIER_COLUMNS[tier]} ins={ins} width={width} scope={themeScope(pid)} bands onHeight={onHeight}>
        {nest(placements, cell)}

        {/* While dragging: the container's rows, where it lands (the ghost, with its size), and the block itself following the pointer */}
        {drag && t && ghost && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
            {Array.from({ length: Math.max(t.rows.length, drag.to.row + drag.to.rowSpan) + 2 }, (_, i) => rowOf(t, i)).map((r, i) => (
              <div key={i} className="absolute border-t border-dashed border-indigo-400/40" style={{ top: r.y, left: t.cols[0]?.x ?? 0, width: (t.cols[t.cols.length - 1]?.x ?? 0) + (t.cols[t.cols.length - 1]?.w ?? 0) - (t.cols[0]?.x ?? 0) }} />
            ))}
            <div className="absolute rounded-md border-2 border-dashed border-amber-500 bg-amber-400/15 flex items-end justify-end p-1" style={{ left: ghost.x, top: ghost.y, width: ghost.w, height: ghost.h }}>
              <span className="font-mono text-amber-700 bg-amber-100/90 rounded px-1 whitespace-nowrap" style={{ fontSize: 11 / scale }}>
                {drag.into ? `in ${placements.find((x) => x.id === drag.into)?.name ?? 'group'} · ` : ''}cols {drag.to.col + 1}–{drag.to.col + drag.to.colSpan} · {drag.to.colSpan} × {drag.to.rowSpan}
              </span>
            </div>
            {drag.kind === 'move' && (
              <div className="absolute rounded-md border-2 border-amber-500 bg-indigo-400/20 shadow-lg" style={{ left: drag.at.x - drag.grab.x, top: drag.at.y - drag.grab.y, width: drag.size.w, height: drag.size.h }} />
            )}
          </div>
        )}
      </PageGrid>
      {menu && (
        <LayoutMenu
          at={menu} placements={placements} tier={tier} components={components} actions={actions}
          placeHere={(id) => place(id, { clientX: menu.x, clientY: menu.y })} close={() => setMenu(null)}
        />
      )}
    </div>
  );
}

export function ComponentsBox({ components, placements, tier, placing, setPlacing }: {
  components: Record<string, ProjectComponent> | undefined; placements: PagePlacement[]; tier: Tier;
  placing: Placing; setPlacing: (id: Placing) => void;
}) {
  const numbers = readingOrder(placements, tier), numbersOf = new Map<string, number[]>();
  placements.forEach((p) => { const n = numbers.get(p.id); if (n && !isGroup(p)) numbersOf.set(p.componentId, [...(numbersOf.get(p.componentId) ?? []), n].sort((a, b) => a - b)); });
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
      <span className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Layout</span>
      <button
        draggable
        onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'group', componentId: GROUP })); e.dataTransfer.effectAllowed = 'copy'; }}
        onClick={() => setPlacing(placing === GROUP ? null : GROUP)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border border-dashed text-left ${placing === GROUP ? 'border-amber-500/70 bg-amber-500/10' : 'border-neutral-600 hover:border-neutral-400'}`}
        title="A box with its own grid, to split a part of the page finer: click, then click the page (or inside another group)"
      >
        <span className="text-[12px] text-neutral-200 flex-1">Group</span>
        <span className="text-[10px] text-neutral-500 font-mono">boxes within boxes</span>
      </button>
      <span className="text-[10px] uppercase tracking-widest text-neutral-500 mt-2 mb-1">Components</span>
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
