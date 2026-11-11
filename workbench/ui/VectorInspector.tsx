"use client";

import { ClipboardCopy, Link2, Unlink2, X } from 'lucide-react';
import { useWorkbenchStore } from '@/lib/store';
import { getSlideDir } from '@/lib/scenes';
import { layerOf, layersOf, untouchable, type VLayer } from '@/lib/design/layers';
import { ElementIcon, elementLabel } from './LayersPanel';
import { putClip } from './vector/clipboard';
import { useRowMenu } from './SheetMenu';
import { useVaultAsset } from '@/workbench/hooks/useVault';
import { TextInput } from './TextInput';
import { Toggle } from './Toggle';
import { FxFields } from './FxFields';
import { actionsFor } from '@/lib/design/actions';
import { actionCtx, actionIcon, runAction } from './vector/actions';
import { BorderFields, Field, NumberField, Seg, SELECT_CLASS as SEL, SliderField, Swatches, Transparency } from './StyleFields';
import { PLANE_OPTIONS, RoofFields, TEXT_SIZES, TEXT_WEIGHTS } from './ToolMenu';
import { setPageField } from '@/lib/design/ops';
import { copyElements, GRID_CELLS, LOBE_DEPTH, groupElements, ungroupElements, PLANAR, planeOf, ROOF_LIFT, ROTATABLE, updateElement, type VAsset, type VElement, type VLine, type VText, type VZone } from '@/lib/design/vector';
import { pageSize, type Bible, type DesignPage } from '@/lib/design/types';

// Vector page editor side panel: properties of the selected element(s). Changes go through lib/design/vector.ts ops.

const BTN = 'text-[11px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30';
const AREA = 'w-full bg-neutral-800 text-neutral-200 text-xs px-2 py-1.5 rounded border border-neutral-700 focus:outline-none focus:border-amber-700 resize-y font-sans leading-snug disabled:opacity-50';
const PAGE_SIZES = [
  { label: 'Standard, 1920 × 1080', width: 1920, height: 1080 },
  { label: 'Large, 3840 × 2160', width: 3840, height: 2160 },
  { label: 'Wide map, 5760 × 1920', width: 5760, height: 1920 },
];

interface Props {
  page:     DesignPage;
  bible:    Bible | null;
  pages:    { id: string; title: string }[];
  selected: string[];
  apply:    (next: DesignPage, key?: string) => void;
  select:   (ids: string[]) => void;
}

export function VectorInspector(props: Props) {
  const { page, selected } = props;
  const picked = (page.elements ?? []).filter((e) => selected.includes(e.id));
  return (
    <div className="p-3 flex flex-col gap-4 text-xs text-neutral-300">
      {picked.length === 0 && <PagePanel {...props} />}
      {picked.length > 0 && <Actions {...props} label={picked.length === 1 ? picked[0].type : `${picked.length} selected`} />}
      {picked.length > 1 && <SelectionList {...props} picked={picked} />}
      {picked.length === 1 && <ElementPanel {...props} el={picked[0]} />}
    </div>
  );
}

function PagePanel({ page, apply }: Props) {
  const size = pageSize(page);
  const sizes = PAGE_SIZES.some((s) => s.width === size.width && s.height === size.height)
    ? PAGE_SIZES : [...PAGE_SIZES, { label: `${size.width} × ${size.height}`, ...size }];
  return (
    <>
      <Field label="Page title"><TextInput className="w-full" value={page.title} onChange={(v) => apply(setPageField(page, { title: v }), 'page:title')} /></Field>
      <Field label="Background"><Swatches value={page.background} onChange={(background) => apply({ ...page, background }, 'page:bg')} /></Field>
      <Field label="Page size">
        <select
          className={SEL} value={`${size.width}x${size.height}`}
          onChange={(e) => { const s = sizes.find((x) => `${x.width}x${x.height}` === e.target.value)!; apply({ ...page, size: { width: s.width, height: s.height } }); }}
        >
          {sizes.map((s) => <option key={s.label} value={`${s.width}x${s.height}`}>{s.label}</option>)}
        </select>
      </Field>
      <div className="text-[10px] text-neutral-500 leading-relaxed flex flex-col gap-1">
        <p><b>Tools:</b> V select · S shapes (R rect, O ellipse, L line, A arrow) · T text · Z floor · X place from vault · P pen · E eraser · H read · G show grid</p>
        <p>Click the current tool again to hide its menu.</p>
        <p>Drag with Z to lay a floor, or tap for a 4 × 4. Select it and pull a handle to extend it. Images and shapes dropped on a floor click into its tiles and move with it.</p>
        <p>Wheel zooms. Space-drag or middle-drag pans. Ctrl+0 fits the page, Ctrl+1 is 100%.</p>
        <p>Drag an arrow from one shape to another and it stays attached when they move. Double-click text to type.</p>
        <p>Shift-click or drag a box to select several. Arrows nudge, Ctrl+D duplicates, Del deletes.</p>
      </div>
    </>
  );
}

function AssetFields({ el, set }: { el: VAsset; set: (p: Record<string, unknown>) => void }) {
  const asset = useVaultAsset(el.asset);
  const activeScene = useWorkbenchStore((s) => s.activeScene);
  const setActiveScene = useWorkbenchStore((s) => s.setActiveScene);
  const setFabEditor = useWorkbenchStore((s) => s.setFabEditor);
  const setFabAsset = useWorkbenchStore((s) => s.setFabAsset);
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">{asset ? asset.title : `Missing: ${el.asset}`}</span>
        {asset && (
          <button
            className={BTN} title="Opens it on the Fab canvas. Edits change it everywhere it's placed."
            onClick={() => { setFabEditor(asset.kind === 'block' ? 'blocks' : 'identity'); setFabAsset(el.asset); setActiveScene('fab', getSlideDir(activeScene, 'fab')); }}
          >Edit in Fab</button>
        )}
      </div>
      <label className="flex items-center justify-between gap-2 text-xs" title={asset?.kind === 'block' ? 'Swaps its floor columns and rows: a left flipper from a right one' : 'Flipped sideways'}>
        Mirror
        <Toggle size="sm" on={!!el.mirror} onToggle={() => set({ mirror: el.mirror ? undefined : true })} />
      </label>
      <Field label="Tint, this placement only"><Swatches value={el.tint} onChange={(tint) => set({ tint })} /></Field>
      {asset && asset.layers && asset.layers.length > 1 && <PlacedLayers el={el} layers={asset.layers} set={set} />}
    </>
  );
}

// Which of the asset's layers this placement shows. Until picked, it follows the asset's own hidden flags.
function PlacedLayers({ el, layers, set }: { el: VAsset; layers: VLayer[]; set: (p: Record<string, unknown>) => void }) {
  const shown = el.layers ?? layers.filter((l) => !l.hidden).map((l) => l.id);
  const flip = (id: string) => set({ layers: layers.map((l) => l.id).filter((x) => (x === id ? !shown.includes(x) : shown.includes(x))) });
  return (
    <Field label="Layers, this placement only">
      <div className="flex flex-col gap-0.5">
        {[...layers].reverse().map((l) => (
          <label key={l.id} className="flex items-center gap-2 text-[11px] cursor-pointer">
            <input type="checkbox" checked={shown.includes(l.id)} onChange={() => flip(l.id)} />{l.name}
          </label>
        ))}
        {el.layers && <button className={`${BTN} self-start mt-1`} onClick={() => set({ layers: undefined })} title="Show what the asset shows, and follow it when it changes">Follow the asset</button>}
      </div>
    </Field>
  );
}

// The header's quick actions, from the registry (lib/design/actions.ts); the rest are on the right-click menu and the selection bar
const HEADER_ACTIONS = ['front', 'back', 'duplicate', 'delete'];
function Actions({ page, selected, apply, select, label }: Props & { label: string }) {
  const ctx = actionCtx(page, selected);
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-[10px] uppercase tracking-widest text-amber-500 truncate">{label}</span>
      <div className="flex gap-1 shrink-0">
        {actionsFor('selection', ctx).filter((a) => HEADER_ACTIONS.includes(a.id)).map((a) => (
          <button key={a.id} className={`${BTN} ${a.group === 'remove' ? 'hover:!text-red-300' : ''}`} title={`${a.label}${a.keys ? ` (${a.keys})` : ''}`} aria-label={a.label} onClick={() => runAction(a, ctx, { apply, select })}>{actionIcon(a)}</button>
        ))}
      </div>
    </div>
  );
}

// More than one thing selected: weld or copy them, and the list of what's in it, by layer. A row picks just that one,
// × drops it; a layer's "+ rest" adds what's left on it (a floor too big to box in, say).
function SelectionList({ page, selected, apply, select, picked }: Props & { picked: VElement[] }) {
  const all = page.elements ?? [], layers = layersOf(page), blocked = untouchable(page);
  const groups = new Set(picked.map((e) => e.group).filter(Boolean));
  const welded = groups.size === 1 && picked.every((e) => e.group);
  const rowMenu = useRowMenu(page, apply, selected, select);
  return (
    <>
      {rowMenu.menu}
      <div className="flex flex-wrap gap-1">
        {welded
          ? <button className={`${BTN} flex items-center gap-1`} title="Take the group apart (Ctrl+Shift+G)" onClick={() => apply(ungroupElements(page, selected))}><Unlink2 size={13} />Ungroup</button>
          : <button className={`${BTN} flex items-center gap-1`} title="Weld into one group: a click on any of it picks it all, and it moves as one (Ctrl+G)" onClick={() => apply(groupElements(page, selected))}><Link2 size={13} />Group</button>}
        {!welded && groups.size > 0 && <button className={`${BTN} flex items-center gap-1`} title="Take every group in the selection apart (Ctrl+Shift+G)" onClick={() => apply(ungroupElements(page, selected))}><Unlink2 size={13} />Ungroup</button>}
        <button className={`${BTN} flex items-center gap-1`} title="Copy, to paste on any page (Ctrl+C, then Ctrl+V there)" onClick={() => putClip(copyElements(page, selected))}><ClipboardCopy size={13} />Copy</button>
      </div>
      <div className="flex flex-col max-h-72 overflow-y-auto -mx-1 px-1">
        {[...layers].reverse().map((l) => {
          const mine = picked.filter((e) => layerOf(layers, e).id === l.id);
          if (!mine.length) return null;
          const rest = all.filter((e) => layerOf(layers, e).id === l.id && !selected.includes(e.id) && !blocked.has(e.id));
          return (
            <div key={l.id} className="flex flex-col mb-1.5">
              <div className="flex items-center gap-1 text-[10px] text-neutral-500 uppercase tracking-wider py-0.5 sticky top-0 bg-neutral-900">
                <span className="flex-1 truncate">{l.name}</span>
                <span className="font-mono">{mine.length}</span>
                {rest.length > 0 && <button className="normal-case tracking-normal text-amber-500/80 hover:text-amber-400 px-1" title={`Add the ${rest.length} other thing${rest.length > 1 ? 's' : ''} on this layer`} onClick={() => select([...selected, ...rest.map((e) => e.id)])}>+ rest {rest.length}</button>}
              </div>
              {[...mine].reverse().map((e) => (
                <div key={e.id} className="group/row flex items-center gap-1 rounded hover:bg-neutral-800 pl-1" onContextMenu={rowMenu.open(e.id)}>
                  <ElementIcon el={e} />
                  <button className="flex-1 min-w-0 text-left text-[11px] truncate px-1 text-neutral-300 hover:text-white" title="Pick just this one" onClick={() => select([e.id])}>{elementLabel(e)}</button>
                  {e.group && <Link2 size={11} className="shrink-0 text-neutral-500" aria-label="In a group" />}
                  <button className="shrink-0 w-4 h-4 rounded text-neutral-600 hover:text-red-300 opacity-0 group-hover/row:opacity-100" aria-label="Drop from the selection" title="Drop from the selection" onClick={() => select(selected.filter((i) => i !== e.id))}><X size={11} className="mx-auto" /></button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

function ElementPanel({ page, bible, pages, el, apply }: Props & { el: VElement }) {
  const set = (patch: Record<string, unknown>, key?: string) => apply(updateElement(page, el.id, patch as Partial<VElement>), key && `${el.id}:${key}`);
  const topics = bible?.topics ?? [];
  const block = useVaultAsset(el.type === 'asset' ? el.asset : undefined)?.kind === 'block';   // its size and turn come from Fab
  return (
    <>
      {el.type !== 'text' && el.type !== 'status' && (
        <Field label="Name"><TextInput className="w-full" value={el.name ?? ''} placeholder={elementLabel({ ...el, name: undefined })} onChange={(v) => set({ name: v || undefined }, 'name')} /></Field>
      )}
      {'w' in el && (
        <div className="grid grid-cols-4 gap-1">
          {(block ? ['x', 'y'] as const : ['x', 'y', 'w', 'h'] as const).map((k) => <NumberField key={k} label={k} value={el[k]} onChange={(v) => set({ [k]: v }, k)} />)}
        </div>
      )}
      {block && <p className="text-[10px] text-neutral-500 leading-relaxed">A block&apos;s size comes from Fab. Edit it there to change it on every page.</p>}
      {PLANAR.includes(el.type) && !planeOf(el) && 'w' in el && (
        <label className="flex items-center justify-between gap-2 text-xs" title="In a block: it stands up (a ball, a post, a sign). Seen from above it keeps its shape, over the floor under its bottom edge, instead of slanting.">
          Upright
          <Toggle size="sm" on={!!el.upright} onToggle={() => set({ upright: el.upright ? undefined : true, base: undefined })} />
        </label>
      )}
      {el.upright && !planeOf(el) && (
        <SliderField label="Bottom above the floor px" value={el.base ?? 0} min={0} max={256} step={2} notches={[[0, 'on it'], [32, '½"'], [64, '1"']]} onChange={(v) => set({ base: v || undefined }, 'base')} />
      )}
      {PLANAR.includes(el.type) && (
        <Field label="Plane">
          <Seg options={PLANE_OPTIONS} value={('plane' in el && el.plane) || 'none'} onChange={(v) => set({ plane: v === 'none' ? undefined : v, rotate: undefined, lift: undefined, slope: undefined, slopeAlong: undefined })} />
        </Field>
      )}
      {(el.type === 'rect' || el.type === 'ellipse' || el.type === 'capsule' || el.type === 'poly') && (el.plane === 'floor' || el.plane === 'roof') && (
        <SliderField
          label="Height (extrude) px" value={el.height ?? 0} min={0} max={512} step={2}
          notches={[[0, 'flat'], [16, '¼"'], [32, '½"'], [64, '1"'], [128, '2"']]} onChange={(v) => set({ height: v || undefined }, 'height')}
        />
      )}
      {'plane' in el && el.plane === 'roof' && <RoofFields lift={el.lift ?? ROOF_LIFT} slope={el.slope ?? 0} along={el.slopeAlong ?? 'h'} set={(p, key) => set(p, key)} />}
      {ROTATABLE.includes(el.type) && !block && !planeOf(el) && (
        <SliderField
          label="Rotate °" value={el.rotate ?? 0} min={0} max={359} notches={[[0, 'none'], 45, 90, 180, 270]}
          onChange={(v) => set({ rotate: v % 360 || undefined }, 'rotate')}
        />
      )}

      {el.type === 'text' && <TextFields el={el} set={set} topics={topics} />}
      {el.type === 'zone' && <ZoneFields el={el} set={set} />}

      {el.type === 'poly' && (
        <label className="flex items-center justify-between gap-2 text-xs" title="Open: a path along the corners, not filled">
          Closed shape
          <Toggle size="sm" on={!el.open} onToggle={() => set({ open: el.open ? undefined : true })} />
        </label>
      )}
      {(el.type === 'rect' || el.type === 'ellipse' || el.type === 'capsule' || el.type === 'poly') && (
        <>
          <Field label="Fill">
            <Seg
              options={[{ value: 'filled', label: '● Filled' }, { value: 'outline', label: '◯ Outline' }]} value={el.fill ? 'filled' : 'outline'}
              onChange={(v) => set(v === 'outline' ? { fill: undefined, stroke: el.stroke ?? el.fill } : { fill: el.stroke ?? '#1f1b16' })}
            />
          </Field>
          {el.fill && <Field label="Fill color"><Swatches value={el.fill} onChange={(fill) => set({ fill })} /></Field>}
          <BorderFields label="Border" color={el.stroke} width={el.strokeWidth ?? 2} dash={el.dash} set={(p) => set(p, 'border')} />
          {el.type === 'ellipse' && (
            <SliderField
              label="Roundness (superellipse n)" value={el.n ?? 2} min={0.3} max={12} step={0.1}
              notches={[[0.5, 'star'], [1, 'diamond'], [2, 'ellipse'], [4, 'squircle'], [10, 'box']]}
              onChange={(v) => set({ n: v === 2 ? undefined : Math.round(v * 10) / 10 }, 'n')}
            />
          )}
          {el.type === 'ellipse' && (
            <SliderField
              label="Bumps (a bush, a cloud)" value={el.lobes ?? 0} min={0} max={24} step={1}
              notches={[[0, 'smooth'], [6, 'cloud'], [9, 'bush'], [16, 'shrub']]}
              onChange={(v) => set({ lobes: v < 3 ? undefined : v, lobeDepth: v < 3 ? undefined : el.lobeDepth }, 'lobes')}
            />
          )}
          {el.type === 'ellipse' && el.lobes && (
            <SliderField
              label="Bump depth" value={el.lobeDepth ?? LOBE_DEPTH} min={0.05} max={0.8} step={0.05}
              notches={[[0.15, 'soft'], [LOBE_DEPTH, 'leafy'], [0.6, 'spiky']]}
              onChange={(v) => set({ lobeDepth: v === LOBE_DEPTH ? undefined : Math.round(v * 100) / 100 }, 'lobeDepth')}
            />
          )}
          {el.type === 'capsule' && (
            <SliderField
              label="Taper (right end ÷ left end)" value={el.taper ?? 1} min={0.05} max={1} step={0.05}
              notches={[[0.25, 'sharp'], [0.6, 'flipper'], [1, 'even']]}
              onChange={(v) => set({ taper: v >= 1 ? undefined : Math.round(v * 100) / 100 }, 'taper')}
            />
          )}
          {el.type === 'rect' && <SliderField label="Corner radius" value={el.radius ?? 0} min={0} max={120} notches={[[0, 'square'], 8, 24, 48]} onChange={(v) => set({ radius: v || undefined }, 'radius')} />}
        </>
      )}

      {el.type === 'line' && <LineFields el={el} set={set} />}
      {el.type === 'stroke' && (
        <>
          <Field label="Color"><Swatches value={el.color} noNone onChange={(color) => set({ color })} /></Field>
          <SliderField label="Size" value={el.width ?? 4} min={1} max={60} notches={[[2, 'fine'], [4, 'normal'], [8, 'bold'], [16, 'marker'], [32, 'wide']]} onChange={(v) => set({ width: v }, 'width')} />
          <Field label="Brush">
            <Seg
              options={[{ value: 'ink', label: 'Ink' }, { value: 'marker', label: 'Marker' }, { value: 'highlighter', label: 'Highlighter' }]} value={el.brush ?? 'ink'}
              onChange={(b) => set({ brush: b === 'ink' ? undefined : b, opacity: b === 'highlighter' ? 0.4 : undefined })}
            />
          </Field>
        </>
      )}

      {el.type === 'image' && (
        <>
          <Field label="File in assets/"><TextInput className="w-full" value={el.src} onChange={(v) => set({ src: v }, 'src')} /></Field>
          <Field label="Fit">
            <Seg options={[{ value: 'contain', label: 'Contain' }, { value: 'cover', label: 'Cover' }]} value={el.fit ?? 'contain'} onChange={(fit) => set({ fit })} />
          </Field>
        </>
      )}

      {el.type === 'asset' && <AssetFields el={el} set={set} />}

      {el.type === 'status' && (
        <>
          <Field label="Shows status of topic">
            <select className={SEL} value={el.topic} onChange={(e) => set({ topic: e.target.value })}>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </Field>
          <SliderField label="Size" value={el.size ?? 20} min={8} max={80} notches={[12, 20, 32, 48]} onChange={(v) => set({ size: v }, 'size')} />
        </>
      )}

      <Field label="Link — click opens this page">
        <LinkPicker value={el.link} pages={pages} topics={topics.map((t) => ({ id: t.id, title: t.title }))} onChange={(link) => set({ link })} />
      </Field>
      <Transparency opacity={el.opacity} onChange={(o) => set({ opacity: o >= 1 ? undefined : o }, 'opacity')} />
      <FxFields value={el.fx} types={[el.type]} onChange={(fx, key) => set({ fx }, key)} />
    </>
  );
}

function TextFields({ el, set, topics }: { el: VText; set: (p: Record<string, unknown>, k?: string) => void; topics: { id: string; title: string }[] }) {
  return (
    <>
      <Field label={el.bind ? 'Text (live from the bible)' : 'Text'}>
        <textarea className={AREA} rows={4} disabled={!!el.bind} value={el.text} onChange={(e) => set({ text: e.target.value }, 'text')} />
      </Field>
      <Field label="Live from topic">
        <div className="flex gap-1">
          <select className={`${SEL} flex-1`} value={el.bind?.topic ?? ''} onChange={(e) => set({ bind: e.target.value ? { topic: e.target.value, field: el.bind?.field ?? 'summary' } : undefined })}>
            <option value="">— not bound —</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          {el.bind && (
            <select className={SEL} value={el.bind.field} onChange={(e) => set({ bind: { ...el.bind, field: e.target.value } })}>
              <option>summary</option><option>title</option>
            </select>
          )}
        </div>
      </Field>
      <Field label="Font">
        <Seg options={[{ value: 'sans', label: 'Sans' }, { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Mono' }]} value={el.font ?? 'sans'} onChange={(font) => set({ font })} />
      </Field>
      <SliderField label="Size" value={el.size ?? 24} min={8} max={160} notches={TEXT_SIZES} onChange={(v) => set({ size: v }, 'size')} />
      <SliderField label="Weight" value={el.weight ?? 400} min={400} max={700} step={100} notches={TEXT_WEIGHTS} onChange={(weight) => set({ weight }, 'weight')} />
      <Field label="Align">
        <Seg options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} value={el.align ?? 'left'} onChange={(align) => set({ align })} />
      </Field>
      <Field label="Vertical">
        <Seg options={[{ value: 'top', label: 'Top' }, { value: 'middle', label: 'Middle' }, { value: 'bottom', label: 'Bottom' }]} value={el.valign ?? 'top'} onChange={(valign) => set({ valign })} />
      </Field>
      <label className="flex items-center justify-between gap-2">Caps <Toggle size="sm" on={!!el.caps} onToggle={() => set({ caps: !el.caps || undefined })} /></label>
      <Field label="Color"><Swatches value={el.color} noNone onChange={(color) => set({ color })} /></Field>
      <Field label="Background"><Swatches value={el.bg} onChange={(bg) => set({ bg })} /></Field>
      {el.bg && (
        <Field label="Background shape">
          <Seg options={[{ value: 'block', label: 'Block' }, { value: 'round', label: 'Round' }, { value: 'pill', label: 'Pill' }, { value: 'ellipse', label: 'Oval' }]} value={el.bgShape ?? 'block'} onChange={(bgShape) => set({ bgShape })} />
        </Field>
      )}
    </>
  );
}

function ZoneFields({ el, set }: { el: VZone; set: (p: Record<string, unknown>, k?: string) => void }) {
  const TILES = [4, 8, 16, 32];
  return (
    <>
      <SliderField label="Tiles →" value={el.cols} min={1} max={100} notches={TILES} onChange={(cols) => set({ cols }, 'cols')} />
      <SliderField label="Tiles ↓" value={el.rows} min={1} max={100} notches={TILES} onChange={(rows) => set({ rows }, 'rows')} />
      <SliderField label="Tile px" value={el.cell} min={GRID_CELLS[0]} max={GRID_CELLS[GRID_CELLS.length - 1]} step={8} notches={GRID_CELLS} onChange={(cell) => set({ cell }, 'cell')} />
      <Field label="Floor color"><Swatches value={el.fill} onChange={(fill) => set({ fill })} /></Field>
      <BorderFields label="Border" color={el.stroke} width={el.strokeWidth ?? 3} dash={el.dash} set={(p) => set(p, 'border')} />
      <label className="flex items-center justify-between gap-2">Tile lines <Toggle size="sm" on={!el.noLines} onToggle={() => set({ noLines: !el.noLines || undefined })} /></label>
    </>
  );
}

function LineFields({ el, set }: { el: VLine; set: (p: Record<string, unknown>, k?: string) => void }) {
  return (
    <>
      <Field label="Arrowheads">
        <Seg options={[{ value: 'none', label: 'None' }, { value: 'end', label: 'End' }, { value: 'both', label: 'Both' }]} value={el.arrow ?? 'end'} onChange={(arrow) => set({ arrow })} />
      </Field>
      <SliderField label="Curve" value={el.bend ?? 0} min={-300} max={300} step={4} notches={[-120, -60, [0, 'straight'], 60, 120]} onChange={(v) => set({ bend: v || undefined }, 'bend')} />
      <BorderFields label="Line" color={el.stroke} width={el.strokeWidth ?? 3} dash={el.dash} noNone set={(p) => set(p, 'border')} />
    </>
  );
}

function LinkPicker({ value, pages, topics, onChange }: { value?: string; pages: { id: string; title: string }[]; topics: { id: string; title: string }[]; onChange: (v: string | undefined) => void }) {
  const unbuilt = topics.filter((t) => !pages.some((p) => p.id === t.id));
  return (
    <select className={SEL} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">— no link —</option>
      <optgroup label="Pages">{pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</optgroup>
      <optgroup label="Topics, not built yet">{unbuilt.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</optgroup>
    </select>
  );
}
