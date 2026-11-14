"use client";

import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, CopyPlus, Crosshair, Palette as PaletteIcon, PenLine, Trash2 } from 'lucide-react';
import { useWorkbenchStore } from '@/lib/store';
import { getSlideDir } from '@/lib/scenes';
import { dimsText, fabEditorFor, isStructure, type AssetKind, type VaultAsset } from '@/lib/design/vault';
import type { Palette } from '@/lib/design/palette';
import { assetUses, copyAsset, createPalette, deleteAsset, deletePalette, usePalettes, useVault, type VaultFile } from '@/workbench/hooks/useVault';
import { MENU_ROW as ROW, MenuRule, PopMenu } from '@/workbench/ui/PopMenu';
import { AssetThumb } from '@/workbench/ui/AssetPicker';
import { FlyoutChoice, GhostSlot, VaultEmpty, VaultSearch, VaultTabs, VaultWindow, gridStyle, packSlots, useSlotGrid } from '@/workbench/ui/vault/VaultParts';
import { askConfirm, tell } from '@/workbench/ui/Ask';

// The file vault (vault/ on disk) on Ideation and Fab, in the vault window: search, sort, a tab per kind, items
// packed into slots (a long block takes two). On Ideation a pick arms placing: each click on the page puts one down
// (a palette becomes the one every color picker shows). On Fab a pick opens the file in its editor. Hover for details;
// drag to reorder (kept per browser), or out onto an Ideation page to place it there. Right-click: place or open, edit
// in Fab, duplicate, copy as another kind (a new file: the original and its placements stay), delete.

type Tab = 'all' | AssetKind | 'palette';
type Sort = 'custom' | 'name' | 'newest' | 'kind';
// An asset dragged out of the vault carries its id under this type; a sheet that takes it places the asset where it lands
export const VAULT_DRAG = 'application/x-alchemy-vault-asset';

type Item = { key: string; title: string; mtime: string | null } & ({ type: 'asset'; file: VaultFile<VaultAsset> } | { type: 'palette'; file: VaultFile<Palette> });

const TABS: { key: Tab; glyph: string; label: string }[] = [
  { key: 'all',     glyph: '◈', label: 'All' },
  { key: 'shape',   glyph: '⬡', label: 'Shapes' },
  { key: 'icon',    glyph: '✦', label: 'Icons' },
  { key: 'block',   glyph: '▣', label: 'Blocks' },
  { key: 'palette', glyph: '◐', label: 'Palettes' },
];
const SORTS: { key: Sort; label: string }[] = [{ key: 'custom', label: 'Mine' }, { key: 'name', label: 'Name' }, { key: 'newest', label: 'Newest' }, { key: 'kind', label: 'Kind' }];
const KIND_ORDER = ['shape', 'icon', 'block', 'palette'];
const ORDER_KEY = 'vault:order';

const readOrder = (): string[] => { try { return JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]'); } catch { return []; } };
const writeOrder = (o: string[]) => { try { localStorage.setItem(ORDER_KEY, JSON.stringify(o)); } catch { /* per-browser convenience only */ } };
const kindOf = (i: Item) => (i.type === 'palette' ? 'palette' : i.file.asset.kind);
// How many slots an item takes: a block twice as long as it is wide takes two
const slotsOf = (i: Item): [number, number] => {
  if (i.type === 'palette') return [2, 1];
  const fp = i.file.asset.kind === 'block' ? i.file.asset.footprint : undefined;
  return fp ? [fp.cols >= 2 * fp.rows ? 2 : 1, fp.rows >= 2 * fp.cols ? 2 : 1] : [1, 1];
};
const anchorBy = (r: DOMRect) => ({ x: r.right + 8 + 240 <= window.innerWidth ? r.right + 8 : r.left - 248, y: Math.min(r.top, window.innerHeight - 260) });

export function FileVault() {
  const scene    = useWorkbenchStore((s) => s.activeScene);
  const open     = useWorkbenchStore((s) => s.fileVaultOpen) && (scene === 'ideation' || scene === 'fab');
  const close    = useWorkbenchStore((s) => s.toggleFileVault);
  const armed    = useWorkbenchStore((s) => s.vaultArmed);
  const arm      = useWorkbenchStore((s) => s.setVaultArmed);
  const setEditor = useWorkbenchStore((s) => s.setFabEditor);
  const building = useWorkbenchStore((s) => s.activeScene === 'fab' && s.fabEditor === 'structures');   // picks are what to build with
  const opened   = useWorkbenchStore((s) => s.fabAsset);
  const setOpened = useWorkbenchStore((s) => s.setFabAsset);
  const swatch   = useWorkbenchStore((s) => s.swatchPalette);
  const setSwatch = useWorkbenchStore((s) => s.setSwatchPalette);
  const setScene    = useWorkbenchStore((s) => s.setActiveScene);
  const assets = useVault(), palettes = usePalettes();
  const fab = scene === 'fab';

  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('custom');
  const [filterOpen, setFilterOpen] = useState(false);
  const [order, setOrderState] = useState<string[]>(readOrder);
  const setOrder = (o: string[]) => { setOrderState(o); writeOrder(o); };
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [card, setCard] = useState<{ item: Item; at: { x: number; y: number } } | null>(null);
  const [menu, setMenu] = useState<{ item: Item; x: number; y: number } | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { cols, rowsFit, areaRef } = useSlotGrid();

  const all: Item[] = useMemo(() => [
    ...assets.entries.map((f): Item => ({ key: f.id, title: f.asset.title || f.id, mtime: f.mtime, type: 'asset', file: f })),
    ...palettes.entries.map((f): Item => ({ key: `palette:${f.id}`, title: f.asset.title || f.id, mtime: f.mtime, type: 'palette', file: f })),
  ], [assets.entries, palettes.entries]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = all.filter((i) => (tab === 'all' || kindOf(i) === tab) && (!q || i.title.toLowerCase().includes(q) || i.key.toLowerCase().includes(q)));
    const byName = (a: Item, b: Item) => a.title.localeCompare(b.title);
    if (sort === 'name') out = [...out].sort(byName);
    else if (sort === 'newest') out = [...out].sort((a, b) => (Date.parse(b.mtime ?? '') || 0) - (Date.parse(a.mtime ?? '') || 0));
    else if (sort === 'kind') out = [...out].sort((a, b) => KIND_ORDER.indexOf(kindOf(a)) - KIND_ORDER.indexOf(kindOf(b)) || byName(a, b));
    else {   // yours: the order you dragged them into; new files after, by kind then name
      const at = (i: Item) => { const n = order.indexOf(i.key); return n < 0 ? Infinity : n; };
      out = [...out].sort((a, b) => at(a) - at(b) || KIND_ORDER.indexOf(kindOf(a)) - KIND_ORDER.indexOf(kindOf(b)) || byName(a, b));
    }
    return out;
  }, [all, tab, search, sort, order]);

  const packed = useMemo(() => packSlots(shown, cols, slotsOf), [shown, cols]);
  const rows = Math.max(packed.reduce((m, p) => Math.max(m, p.row + p.h - 1), 0) + 2, rowsFit);
  const grid = gridStyle(cols, rows);

  // Moving one item before another (or to the end) switches to your own order, starting from what's shown
  const moveTo = (target: string | null) => {
    if (!dragging || dragging === target) return;
    const base = shown.map((i) => i.key).concat(order.filter((k) => !shown.some((i) => i.key === k)));
    const without = base.filter((k) => k !== dragging), at = target ? without.indexOf(target) : without.length;
    without.splice(at < 0 ? without.length : at, 0, dragging);
    setOrder(without); setSort('custom');
  };

  // On Structures, a floor, wall or object is picked to build with (armed), not opened
  const builds = (i: Item) => building && i.type === 'asset' && i.file.asset.kind === 'block' && !isStructure(i.file.asset);
  const lit = (i: Item) => (i.type === 'palette' ? (fab ? opened === i.key : swatch === i.file.id) : fab && !builds(i) ? opened === i.key : armed === i.key);
  const pick = (i: Item) => {
    if (i.type === 'palette') {
      if (fab) { setEditor('identity'); setOpened(i.key); } else setSwatch(swatch === i.file.id ? undefined : i.file.id);
    } else if (fab && !builds(i)) { setEditor(fabEditorFor(i.file.asset)); setOpened(i.key); }
    else arm(armed === i.key ? null : i.key);
  };
  // Opens a vault file on Fab, in its editor, from wherever you are
  const toFab = (key: string, kind: AssetKind | 'palette', part?: VaultAsset['part']) => {
    setEditor(kind === 'palette' ? 'identity' : fabEditorFor({ kind, part })); setOpened(key);
    if (!fab) setScene('fab', getSlideDir(scene, 'fab'));
  };
  const duplicate = async (i: Item, kind?: AssetKind) => {
    if (i.type === 'asset') {
      const r = await copyAsset(i.file.asset, kind);
      if ('error' in r) void tell(`Couldn't copy it: ${r.error}`); else toFab(r.id, kind ?? i.file.asset.kind, kind ? undefined : i.file.asset.part);
      return;
    }
    const root = i.title.replace(/\s+\d+$/, '');
    let n = 2;
    while (palettes.entries.some((p) => p.asset.title === `${root} ${n}`)) n++;
    const r = await createPalette(`${root} ${n}`, i.file.asset);
    if ('error' in r) void tell(`Couldn't copy it: ${r.error}`); else toFab(`palette:${r.id}`, 'palette');
  };
  const remove = async (i: Item) => {
    setCard(null);
    if (i.type === 'palette') { if (await askConfirm(`Delete palette "${i.title}"? Colors already copied into pages stay.`, { ok: 'Delete', danger: true })) await deletePalette(i.file.id); return; }
    const uses = await assetUses(i.file.id);
    const msg = uses.length ? `"${i.title}" is placed on ${uses.length} page${uses.length > 1 ? 's' : ''} (${uses.slice(0, 3).join(', ')}${uses.length > 3 ? '…' : ''}). Delete it anyway? Those placements will show as missing.` : `Delete "${i.title}"?`;
    if (await askConfirm(msg, { ok: 'Delete', danger: true })) { await deleteAsset(i.file.id); if (armed === i.key) arm(null); }
  };

  const error = assets.error ?? palettes.error;
  const hint = fab ? 'Pick one to open it here. New files: the file menu above.'
    : armed ? 'Click the page to place it; on a floor it stands on its tiles. Esc or another tool stops.'
    : 'Pick one, then click the page to place it. A palette becomes the one color pickers show.';

  return (
    <>
      <VaultWindow open={open} onClose={close} footer={error ? <span className="text-red-300">{error}</span> : hint}>
        <VaultSearch
          value={search} onChange={setSearch}
          filtering={sort !== 'custom'} filterOpen={filterOpen} toggleFilter={() => setFilterOpen((v) => !v)}
          flyout={<FlyoutChoice label="Sort" options={SORTS} value={sort} onChange={setSort} />}
        />
        <div className="flex-1 flex overflow-hidden">
          <VaultTabs tabs={TABS} value={tab} onChange={setTab} />
          <div ref={areaRef} className="flex-1 overflow-y-auto p-2">
            {!shown.length ? (
              <VaultEmpty>
                {!assets.loaded ? 'Loading…' : search ? `No matches for "${search}"` : tab === 'palette' ? 'No palettes yet: make one on Fab → Visual Identity.' : 'Empty. Make shapes, icons and blocks on Fab.'}
              </VaultEmpty>
            ) : (
              <div className="relative">
                <div style={grid}>
                  {Array.from({ length: cols * rows }).map((_, n) => <GhostSlot key={n} dragging={!!dragging} onDrop={() => { moveTo(null); setDragging(null); setOver(null); }} />)}
                </div>
                <div style={{ ...grid, position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  {packed.map(({ item: i, col, row, w, h }) => (
                    <div
                      key={i.key} draggable
                      style={{ gridColumn: `${col} / span ${w}`, gridRow: `${row} / span ${h}`, pointerEvents: 'auto', cursor: dragging === i.key ? 'grabbing' : 'pointer' }}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'vault-file', id: i.key })); if (i.type === 'asset') e.dataTransfer.setData(VAULT_DRAG, i.key); e.dataTransfer.effectAllowed = 'copyMove'; setDragging(i.key); setCard(null); }}
                      onDragOver={(e) => { if (dragging && dragging !== i.key) { e.preventDefault(); setOver(i.key); } }}
                      onDragEnd={() => { setDragging(null); setOver(null); }}
                      onDrop={(e) => { e.preventDefault(); moveTo(i.key); setDragging(null); setOver(null); }}
                      onClick={() => { if (!dragging) pick(i); }}
                      onContextMenu={(e) => { e.preventDefault(); setCard(null); setMenu({ item: i, x: e.clientX, y: e.clientY }); }}
                      onMouseEnter={(e) => { if (dragging || menu) return; if (hide.current) clearTimeout(hide.current); setCard({ item: i, at: anchorBy(e.currentTarget.getBoundingClientRect()) }); }}
                      onMouseLeave={() => { hide.current = setTimeout(() => setCard(null), 180); }}
                    >
                      <Cell item={i} lit={lit(i)} dim={dragging === i.key} target={over === i.key && dragging !== i.key} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </VaultWindow>

      {open && menu && (
        <VaultMenu
          item={menu.item} x={menu.x} y={menu.y} fab={fab} lit={lit(menu.item)} close={() => setMenu(null)}
          onPick={() => pick(menu.item)} onFab={() => toFab(menu.item.key, kindOf(menu.item), menu.item.type === 'asset' ? menu.item.file.asset.part : undefined)}
          onDuplicate={(kind) => duplicate(menu.item, kind)} onDelete={() => remove(menu.item)}
        />
      )}

      <AnimatePresence>
        {open && card && (
          <motion.div key={card.item.key} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.12 }}>
            <FileCard
              item={card.item} at={card.at} fab={fab} lit={lit(card.item)}
              onEnter={() => { if (hide.current) clearTimeout(hide.current); }} onLeave={() => setCard(null)}
              onPick={() => pick(card.item)} onDelete={() => remove(card.item)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// One item in its slot: the drawing on paper (or a palette's colors), its name along the bottom
function Cell({ item, lit, dim, target }: { item: Item; lit: boolean; dim: boolean; target: boolean }) {
  const ring = lit ? 'ring-2 ring-amber-500' : target ? 'ring-2 ring-indigo-400/60' : 'ring-1 ring-neutral-800 hover:ring-neutral-500';
  return (
    <div className={`relative w-full h-full rounded-lg overflow-hidden transition-all duration-100 ${ring} ${dim ? 'opacity-40' : ''}`}>
      {item.type === 'palette' ? (
        <div className="w-full h-full flex flex-col bg-neutral-900">
          <div className="flex-1 flex">{item.file.asset.colors.slice(0, 12).map((c, n) => <span key={n} className="flex-1" style={{ background: c.value }} />)}</div>
        </div>
      ) : (
        <div className="w-full h-full bg-[#f4efe6] p-1 pb-3"><AssetThumb id={item.file.id} /></div>
      )}
      <span className="absolute left-0 right-0 bottom-0 px-1 py-px text-[8px] font-mono truncate text-neutral-300 bg-neutral-950/75 leading-tight">{item.title}</span>
    </div>
  );
}

// The hover card: what it is, its size, and what you can do with it
function FileCard({ item, at, fab, lit, onEnter, onLeave, onPick, onDelete }: {
  item: Item; at: { x: number; y: number }; fab: boolean; lit: boolean;
  onEnter: () => void; onLeave: () => void; onPick: () => void; onDelete: () => void;
}) {
  const a = item.type === 'asset' ? item.file.asset : null, fp = a?.kind === 'block' ? a.footprint : undefined;
  const action = fab ? (lit ? 'Open' : 'Open here') : item.type === 'palette' ? (lit ? 'In use · stop' : 'Use in color pickers') : lit ? 'Placing · stop' : 'Place';
  return (
    <div
      style={{ position: 'fixed', left: at.x, top: at.y, zIndex: 200, width: 240 }}
      className="bg-neutral-900 border border-neutral-700 rounded-lg p-3 shadow-xl flex flex-col gap-2"
      onMouseEnter={onEnter} onMouseLeave={onLeave}
    >
      {item.type === 'asset'
        ? <div className="h-28 rounded bg-[#f4efe6] p-2"><AssetThumb id={item.file.id} /></div>
        : <div className="h-8 rounded overflow-hidden flex">{item.file.asset.colors.map((c, n) => <span key={n} className="flex-1" style={{ background: c.value }} title={`${c.name} ${c.value}`} />)}</div>}
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-medium text-neutral-200 truncate flex-1">{item.title}</span>
        <span className="text-[8px] uppercase tracking-widest text-neutral-500">{item.type === 'palette' ? 'palette' : a!.kind === 'block' && a!.part && a!.part !== 'object' ? a!.part : a!.kind}</span>
      </div>
      <div className="font-mono text-[9px] text-neutral-500 flex flex-col gap-0.5">
        <span>{item.type === 'palette' ? `palettes/${item.file.id}.json · ${item.file.asset.colors.length} colors` : `assets/${item.file.id}.json`}</span>
        {fp && <span>footprint {fp.cols} × {fp.rows} tiles</span>}
        {a?.dims && <span>{dimsText(a.dims)}{a.dims.mm ? ` · ${dimsText(a.dims, 'mm')}` : ''}{a.dims.estimated ? ' · estimated' : ''}</span>}
        {a?.dims?.note && <span className="font-sans text-neutral-400 leading-snug">{a.dims.note}</span>}
      </div>
      <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-2">
        <button onClick={onPick} className={`px-2 py-0.5 rounded text-[9px] font-medium border ${lit ? 'border-amber-500/50 text-amber-300 bg-amber-500/10' : 'border-neutral-600 text-neutral-200 hover:bg-neutral-800'}`}>{action}</button>
        <button onClick={onDelete} className="px-2 py-0.5 rounded text-[9px] font-medium border border-red-500/30 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50">Delete</button>
      </div>
    </div>
  );
}

// The right-click menu on a vault item. Every copy is a new file, opened on Fab; the original is left as it was.
const KINDS: AssetKind[] = ['shape', 'icon', 'block'];
function VaultMenu({ item, x, y, fab, lit, close, onPick, onFab, onDuplicate, onDelete }: {
  item: Item; x: number; y: number; fab: boolean; lit: boolean; close: () => void;
  onPick: () => void; onFab: () => void; onDuplicate: (kind?: AssetKind) => void; onDelete: () => void;
}) {
  const run = (f: () => void) => () => { close(); f(); };
  const kind = kindOf(item);
  return (
    <PopMenu x={x} y={y} close={close}>
      <div className="px-2.5 pt-1 pb-1.5 text-[9px] uppercase tracking-widest text-amber-500 truncate max-w-[220px]">{item.title} · {kind}</div>
      {fab
        ? <button className={ROW} onClick={run(onPick)}><PenLine size={14} />Open</button>
        : <>
            <button className={ROW} onClick={run(onPick)}>
              {item.type === 'palette' ? <><PaletteIcon size={14} />{lit ? 'Stop using in color pickers' : 'Use in color pickers'}</> : <><Crosshair size={14} />{lit ? 'Stop placing' : 'Place'}</>}
            </button>
            <button className={ROW} title="Every placement of it changes" onClick={run(onFab)}><PenLine size={14} />Edit in Fab</button>
          </>}
      <MenuRule />
      <button className={ROW} title="A new file with the same drawing, opened on Fab" onClick={run(() => onDuplicate())}><Copy size={14} />Duplicate</button>
      {item.type === 'asset' && KINDS.filter((k) => k !== kind).map((k) => (
        <button key={k} className={ROW} title={`A new ${k} with the same drawing, opened on Fab. This one and its placements stay as they are.`} onClick={run(() => onDuplicate(k))}>
          <CopyPlus size={14} />Copy as {k}
        </button>
      ))}
      <MenuRule />
      <button className={`${ROW} text-red-300`} onClick={run(onDelete)}><Trash2 size={14} />Delete…</button>
    </PopMenu>
  );
}
