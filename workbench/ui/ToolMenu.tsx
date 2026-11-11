"use client";

import { useState, type ReactNode } from 'react';
import { Crosshair } from 'lucide-react';
import { Toggle } from './Toggle';
import { FxFields } from './FxFields';
import { BorderFields, Field, Seg, SELECT_CLASS as SEL, SliderField, Swatches, Transparency } from './StyleFields';
import { PEN_SOURCES, type PenSource, type PenStatus } from '@/workbench/hooks/usePenBridge';
import type { PenTurn } from '@/lib/penCalibration';
import { AuxBar, AuxButton, Docked } from './AuxDock';
import { capsulePath, ellipsePath, GRID_CELLS, ROOF_LIFT, SLOPE_MAX, type Lattice, type Plane, type TextBackground, type VBrush } from '@/lib/design/vector';
import {
  isFilled, isLineKind, sameStyle, shapeType, SELECT_FILTERS, type EraseTool, type Favorite, type Favorites, type PenTool, type SelectTool, type ShapeKind, type ShapeTool, type TextTool, type ToolStyles, type ZoneTool,
} from '@/lib/design/toolStyles';

// The panel beside the tool rail, for the tool in hand: title, a bar of favorites ending in "…", then parameters.
// Changing anything sets only what the tool makes next; something already drawn changes in its properties. The one
// exception is a favorite: it also restyles the selection (its look only, see favoritePatch).

export const SHAPE_KINDS: { kind: ShapeKind; icon: string; filled?: string; label: string }[] = [
  { kind: 'rect',    icon: '▭', filled: '■', label: 'Rectangle' },
  { kind: 'rounded', icon: '▢', filled: '■', label: 'Rounded rectangle' },
  { kind: 'ellipse', icon: '◯', filled: '●', label: 'Ellipse' },
  { kind: 'bush',    icon: '✿', filled: '✿', label: 'Bush: an ellipse with a bumpy edge (a bush, a cloud, a tree top). Bumps and depth in its properties' },
  { kind: 'capsule', icon: '⬭', filled: '⬬', label: 'Capsule (C): two circles joined, one end can taper' },
  { kind: 'poly',    icon: '⬠', filled: '⬟', label: 'Polygon: click each corner; click the first, double-click or press Enter to finish' },
  { kind: 'line',    icon: '╱', label: 'Line' },
  { kind: 'arrow',   icon: '→', label: 'Arrow' },
  { kind: 'double',  icon: '↔', label: 'Double arrow' },
  { kind: 'curve',   icon: '⤴', label: 'Curved arrow' },
];

// A shape's icon shows whether it's filled
export const shapeIcon = (kind: ShapeKind, s: Pick<ShapeTool, 'fill' | 'hollow'>) => {
  const k = SHAPE_KINDS.find((x) => x.kind === kind);
  return (isFilled(s) && k?.filled) || k?.icon;
};

export const TEXT_SIZES: [number, string][] = [[16, 'label'], [24, 'body'], [36, 'heading'], [64, 'title']];
export const TEXT_WEIGHTS: [number, string][] = [[400, 'regular'], [500, 'medium'], [600, 'semibold'], [700, 'bold']];

type MenuTool = 'select' | 'shape' | 'text' | 'zone' | 'asset' | 'pen' | 'erase';
const TITLES: Record<MenuTool, string> = { select: 'Select', shape: 'Shapes', text: 'Text', zone: 'Floor zone', asset: 'Vault', pen: 'Pen', erase: 'Eraser' };

interface PenControls {
  source: PenSource; setSource: (s: PenSource) => void; live: boolean; setLive: (on: boolean) => void;
  turn: PenTurn; setTurn: (t: PenTurn) => void; status: PenStatus; name?: string; grabbed?: boolean;
  calibrated: boolean; calibrating: boolean; toggleCalibrate: () => void; clearCalibration: () => void;
}

export function ToolMenu({ tool, top, styles, favorites, change, applyFavorite, saveFavorite, removeFavorite, grid, setGrid, pen, eraseAll }: {
  tool: MenuTool; top: number;
  styles: ToolStyles; favorites: Favorites;
  change: <K extends keyof ToolStyles>(tool: K, patch: Partial<ToolStyles[K]>) => void;
  applyFavorite: (tool: keyof Favorites, style: object) => void;
  saveFavorite: (tool: keyof Favorites) => void;
  removeFavorite: (tool: keyof Favorites, id: string) => void;
  grid: Lattice; setGrid: (patch: Partial<Lattice>) => void;
  pen: PenControls;
  eraseAll?: boolean;   // the eraser rubs out everything (Fab), not just ink (Ideation)
}) {
  const barTool = tool === 'shape' || tool === 'text' || tool === 'zone' ? tool : null;
  const current = barTool === 'zone' ? { ...styles.zone, cell: grid.cell, flat: grid.flat } : barTool ? styles[barTool] : null;

  // Favorites float on the menu's right edge (an aux bar); the top row is the tool's own picks (Shapes: which shape)
  const favBar = barTool && current && (
    <FavoriteBar
      tool={barTool} favorites={favorites[barTool] as Favorite<object>[]} current={current}
      onPick={(s) => applyFavorite(barTool, s)} onSave={() => saveFavorite(barTool)} onRemove={(id) => removeFavorite(barTool, id)}
    />
  );
  return (
    <Docked side="right" aux={favBar} className="absolute left-[61px] z-30" style={{ top }}>
    <div
      className="w-[208px] overflow-y-auto overflow-x-hidden bg-neutral-900/95 border border-neutral-700/60 rounded-xl backdrop-blur-sm text-xs text-neutral-300"
      style={{ maxHeight: `calc(100vh - ${top + 16}px)` }}
    >
      <div className="px-3 pt-2 pb-1.5 text-[10px] uppercase tracking-widest text-amber-500">{tool === 'erase' && !eraseAll ? 'Ink eraser' : TITLES[tool]}</div>
      {tool === 'shape' && (
        <div className="grid grid-cols-10 gap-0.5 px-2 pb-2 border-b border-neutral-800">
          {SHAPE_KINDS.map((k) => (
            <button
              key={k.kind} title={k.label} aria-label={k.label} aria-pressed={styles.shape.kind === k.kind} onClick={() => change('shape', { kind: k.kind })}
              className={`h-7 rounded text-sm ${styles.shape.kind === k.kind ? 'bg-amber-500/20 text-amber-400' : 'text-neutral-400 hover:bg-neutral-800'}`}
            >{shapeIcon(k.kind, styles.shape)}</button>
          ))}
        </div>
      )}
      {tool === 'pen' && <PenBar pen={pen} />}
      <div className="p-3 pt-2 flex flex-col gap-3">
        {(tool === 'select' || tool === 'shape' || tool === 'text') && <SnapToggle free={!!styles.select.free} set={(free) => change('select', { free: free || undefined })} />}
        {tool === 'select' && (
          <label className="flex items-center justify-between gap-2" title="A selected block gets a turn knob. On an isometric floor it turns by quarters; on a flat floor any angle (Shift: 15° steps).">
            Turn blocks
            <Toggle size="sm" on={!!styles.select.turnBlocks} onToggle={() => change('select', { turnBlocks: !styles.select.turnBlocks || undefined })} />
          </label>
        )}
        {tool === 'select' && <SelectParams s={styles.select} set={(p) => change('select', p)} />}
        {tool === 'shape' && <ShapeParams s={styles.shape} set={(p) => change('shape', p)} />}
        {tool === 'text' && <TextParams s={styles.text} set={(p) => change('text', p)} />}
        {tool === 'zone' && <ZoneParams s={styles.zone} set={(p) => change('zone', p)} grid={grid} setGrid={setGrid} />}
        {tool === 'pen' && <PenParams s={styles.pen} set={(p) => change('pen', p)} pen={pen} />}
        {tool === 'erase' && <EraseParams s={styles.erase} set={(p) => change('erase', p)} all={eraseAll} />}
      </div>
    </div>
    </Docked>
  );
}

// ── Bar ──

// The tool's favorites, as an aux bar beside its menu: a click sets the tool (and restyles the selection: see
// favoritePatch). ★ saves the current settings; … opens the full list, where favorites can be removed.
const FAV_SHOWN = 8;
function FavoriteBar({ tool, favorites, current, onPick, onSave, onRemove }: {
  tool: keyof Favorites; favorites: Favorite<object>[]; current: object;
  onPick: (s: object) => void; onSave: () => void; onRemove: (id: string) => void;
}) {
  const [more, setMore] = useState(false);
  // A floor favorite without a tile size matches at any tile size
  const on = (f: Favorite<object>) => sameStyle(f.style, tool === 'zone' && !('cell' in f.style) ? { ...current, cell: undefined, flat: undefined } : current);
  return (
    <div className="relative">
      <AuxBar>
        {favorites.slice(0, FAV_SHOWN).map((f) => (
          <button
            key={f.id} title={f.name} aria-label={f.name} onClick={() => onPick(f.style)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center bg-neutral-100 overflow-hidden ${on(f) ? 'ring-2 ring-amber-500' : 'ring-1 ring-neutral-700 hover:ring-neutral-400'}`}
          ><Chip tool={tool} style={f.style} /></button>
        ))}
        <AuxButton title="Save the current settings as a favorite" onClick={onSave}>★</AuxButton>
        <AuxButton title="All favorites" on={more} onClick={() => setMore(!more)}>…</AuxButton>
      </AuxBar>
      {more && (
        <div className="absolute left-full top-0 ml-1.5 w-[200px] bg-neutral-900/95 border border-neutral-700/60 rounded-xl backdrop-blur-sm px-2 py-1.5 flex flex-col gap-0.5 text-xs text-neutral-300">
          {favorites.map((f) => (
            <div key={f.id} className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-neutral-800">
              <button onClick={() => onPick(f.style)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                <span className="w-5 h-5 shrink-0 rounded bg-neutral-100 flex items-center justify-center overflow-hidden"><Chip tool={tool} style={f.style} /></span>
                <span className={`truncate ${on(f) ? 'text-amber-400' : ''}`}>{f.name}</span>
              </button>
              <button title={`Remove ${f.name}`} aria-label={`Remove ${f.name}`} onClick={() => onRemove(f.id)} className="text-neutral-500 hover:text-white px-1">✕</button>
            </div>
          ))}
          {!favorites.length && <div className="px-1 py-0.5 text-neutral-500">No favorites yet.</div>}
        </div>
      )}
    </div>
  );
}

function Chip({ tool, style }: { tool: keyof Favorites; style: object }) {
  if (tool === 'text') {
    const t = style as TextTool;
    return <span style={{ fontWeight: t.weight, color: t.color, background: t.bg, fontFamily: t.font === 'serif' ? 'serif' : t.font === 'mono' ? 'monospace' : 'sans-serif', fontSize: 13, padding: t.bg ? '0 3px' : 0, borderRadius: 3 }}>Aa</span>;
  }
  const s = style as ShapeTool | ZoneTool;
  const paint = { fill: s.fill ?? 'none', stroke: s.stroke ?? 'none', strokeWidth: Math.min(s.strokeWidth, 2.5), strokeDasharray: s.dash === 'dot' ? '0.1 4' : s.dash ? '4 3' : undefined, strokeLinecap: 'round' as const, opacity: s.opacity };
  if (tool === 'zone') return <svg viewBox="0 0 24 24" className="w-full h-full"><polygon points="12,5 22,12 12,19 2,12" {...paint} /></svg>;
  const kind = (s as ShapeTool).kind;
  return (
    <svg viewBox="0 0 24 24" className="w-full h-full">
      {(kind === 'rect' || kind === 'rounded') && <rect x="4" y="6" width="16" height="12" rx={kind === 'rounded' ? 4 : 0} {...paint} />}
      {kind === 'ellipse' && <ellipse cx="12" cy="12" rx="8" ry="6" {...paint} />}
      {kind === 'bush' && <path d={ellipsePath({ x: 3, y: 5, w: 18, h: 14, lobes: 7 })} strokeLinejoin="round" {...paint} />}
      {kind === 'poly' && <polygon points="12,4 20,10 17,19 7,19 4,10" {...paint} />}
      {kind === 'capsule' && <path d={capsulePath({ x: 3, y: 7, w: 18, h: 10 }, 0.6)} {...paint} />}
      {isLineKind(kind) && <path d={kind === 'curve' ? 'M4,18 Q6,6 20,6' : 'M4,18 L20,6'} {...paint} fill="none" />}
      {(kind === 'arrow' || kind === 'double' || kind === 'curve') && <polygon points="20,6 13,6 17,12" fill={s.stroke} transform={kind === 'curve' ? 'rotate(-16 20 6)' : undefined} />}
      {kind === 'double' && <polygon points="4,18 11,18 7,12" fill={s.stroke} />}
    </svg>
  );
}

function PenBar({ pen }: { pen: PenControls }) {
  const btn = (on: boolean) => `flex-1 min-w-0 py-1 rounded text-[11px] truncate ${on ? 'bg-amber-500/20 text-amber-400' : 'text-neutral-400 hover:bg-neutral-800'}`;
  return (
    <div className="flex gap-1 px-3 pb-2 border-b border-neutral-800">
      <button className={btn(!pen.live)} title="Draw with the mouse or a screen stylus" onClick={() => pen.setLive(false)}>Default</button>
      {PEN_SOURCES.map((s) => (
        <button
          key={s.value} className={btn(pen.live && pen.source === s.value)} title={`Draw with: ${s.label}`}
          onClick={() => { pen.setSource(s.value); pen.setLive(true); }}
        >{s.label}</button>
      ))}
    </div>
  );
}

// ── Parameters ──

// One setting shared by every tool that places or moves things
function SnapToggle({ free, set }: { free: boolean; set: (free: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2" title="Off: things go exactly where the pointer is. Floors always snap.">
      Snap to grid
      <Toggle size="sm" on={!free} onToggle={() => set(!free)} />
    </label>
  );
}

function SelectParams({ s, set }: { s: SelectTool; set: (p: Partial<SelectTool>) => void }) {
  return (
    <Field label="Clickable">
      <div className="flex flex-col gap-1.5">
        {SELECT_FILTERS.map((f) => {
          const on = !f.types.some((t) => s.off.includes(t));
          return (
            <label key={f.label} className="flex items-center justify-between gap-2">
              {f.label}
              <Toggle size="sm" on={on} onToggle={() => set({ off: on ? [...s.off, ...f.types] : s.off.filter((t) => !f.types.includes(t)) })} />
            </label>
          );
        })}
      </div>
    </Field>
  );
}

// How high a roof sits (in grid cells it lines up with walls of the same height) and its pitch.
// Two roofs sloping toward each other's ridge make a gable.
export function RoofFields({ lift, slope, along, walls, set }: {
  lift: number; slope: number; along: 'w' | 'h'; walls: boolean;
  set: (p: { lift?: number; slope?: number; slopeAlong?: 'w' | 'h'; walls?: boolean }, key?: string) => void;
}) {
  return (
    <>
      <label className="flex items-center justify-between text-[11px] text-neutral-300" title="Walls drop from the roof's outline to the floor, following its shape">
        Walls down to the floor
        <Toggle size="sm" on={walls} onToggle={() => set({ walls: !walls || undefined })} />
      </label>
      <SliderField label="Roof height px" value={lift} min={0} max={512} step={8} notches={[[32, '½'], [64, '1'], [128, '2'], [192, '3'], [256, '4']]} onChange={(v) => set({ lift: v }, 'lift')} />
      <SliderField
        label="Pitch (rise per run)" value={slope} min={-SLOPE_MAX} max={SLOPE_MAX} step={0.05}
        notches={[[-0.5, 'falls'], [0, 'flat'], [0.25, 'low'], [0.5, 'steep']]} onChange={(v) => set({ slope: Math.round(v * 100) / 100 || undefined }, 'slope')}
      />
      {slope !== 0 && (
        <Field label="Rises along">
          <Seg options={[{ value: 'h', label: 'H (rows ↙)' }, { value: 'w', label: 'W (columns ↘)' }]} value={along} onChange={(v) => set({ slopeAlong: v === 'h' ? undefined : v })} />
        </Field>
      )}
    </>
  );
}

export const PLANE_OPTIONS: { value: 'none' | Plane; label: string }[] = [
  { value: 'none', label: 'Flat' }, { value: 'floor', label: 'Floor' }, { value: 'roof', label: 'Roof' }, { value: 'left', label: 'L' }, { value: 'right', label: 'R' },
];

function ShapeParams({ s, set }: { s: ShapeTool; set: (p: Partial<ShapeTool>) => void }) {
  return (
    <>
      {s.kind === 'poly' && <p className="text-[10px] text-neutral-500 leading-relaxed -mt-1">Click each corner. Click the first corner, double-click or press Enter to finish. Backspace takes back a corner, Esc drops it.</p>}
      {!isLineKind(s.kind) && (
        <Field label="Plane">
          <Seg options={PLANE_OPTIONS} value={s.plane ?? 'none'} onChange={(v) => set({ plane: v === 'none' ? undefined : v })} />
        </Field>
      )}
      {!isLineKind(s.kind) && s.plane === 'roof' && <RoofFields lift={s.lift ?? ROOF_LIFT} slope={s.slope ?? 0} along={s.slopeAlong ?? 'h'} walls={!!s.walls} set={(p) => set(p)} />}
      {!isLineKind(s.kind) && s.plane && <p className="text-[10px] text-neutral-500 leading-relaxed -mt-2">Drag along the plane: on the floor, corner to corner across the tiles. Shows best with the isometric grid on (G).</p>}
      {!isLineKind(s.kind) && (
        <Field label="Fill">
          <Seg
            options={[{ value: 'filled', label: '● Filled' }, { value: 'outline', label: '◯ Outline' }]} value={isFilled(s) ? 'filled' : 'outline'}
            onChange={(v) => set(v === 'outline' ? { hollow: true } : { hollow: undefined, fill: s.fill ?? s.stroke ?? '#1f1b16' })}
          />
        </Field>
      )}
      {!isLineKind(s.kind) && isFilled(s) && <Field label="Fill color"><Swatches value={s.fill} onChange={(fill) => set(fill ? { fill } : { hollow: true })} /></Field>}
      <BorderFields label={isLineKind(s.kind) ? 'Line' : 'Border'} color={s.stroke} width={s.strokeWidth} dash={s.dash} noNone={isLineKind(s.kind)} set={set} />
      <Transparency opacity={s.opacity} onChange={(opacity) => set({ opacity })} />
      <FxFields value={s.fx} types={[shapeType(s.kind)]} onChange={(fx) => set({ fx })} />
    </>
  );
}

function TextParams({ s, set }: { s: TextTool; set: (p: Partial<TextTool>) => void }) {
  const backgrounds: { value: TextBackground; label: string }[] = [
    { value: 'block', label: 'Block' }, { value: 'round', label: 'Round' }, { value: 'pill', label: 'Pill' }, { value: 'ellipse', label: 'Oval' },
  ];
  return (
    <>
      <Field label="Font">
        <Seg options={[{ value: 'sans', label: 'Sans' }, { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Mono' }]} value={s.font} onChange={(font) => set({ font })} />
      </Field>
      <SliderField label="Size" value={s.size} min={8} max={160} notches={TEXT_SIZES} onChange={(size) => set({ size })} />
      <SliderField label="Weight" value={s.weight} min={400} max={700} step={100} notches={TEXT_WEIGHTS} onChange={(weight) => set({ weight })} />
      <Field label="Align">
        <Seg options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} value={s.align} onChange={(align) => set({ align })} />
      </Field>
      <label className="flex items-center justify-between gap-2">Caps <Toggle size="sm" on={!!s.caps} onToggle={() => set({ caps: !s.caps })} /></label>
      <Field label="Color"><Swatches value={s.color} noNone onChange={(color) => color && set({ color })} /></Field>
      <Field label="Background"><Swatches value={s.bg} onChange={(bg) => set({ bg })} /></Field>
      {s.bg && <Field label="Background shape"><Seg options={backgrounds} value={s.bgShape ?? 'block'} onChange={(bgShape) => set({ bgShape })} /></Field>}
    </>
  );
}

function ZoneParams({ s, set, grid, setGrid }: { s: ZoneTool; set: (p: Partial<ZoneTool>) => void; grid: Lattice; setGrid: (p: Partial<Lattice>) => void }) {
  return (
    <>
      <Field label="Floor color"><Swatches value={s.fill} onChange={(fill) => set({ fill })} /></Field>
      <BorderFields label="Border" color={s.stroke} width={s.strokeWidth} dash={s.dash} set={set} />
      <Transparency opacity={s.opacity} onChange={(opacity) => set({ opacity })} />
      <SliderField label="Tile px" value={grid.cell} min={GRID_CELLS[0]} max={GRID_CELLS[GRID_CELLS.length - 1]} step={8} notches={GRID_CELLS} onChange={(cell) => setGrid({ cell })} />
      <Field label="View">
        <Seg options={[{ value: 'iso', label: 'Isometric' }, { value: 'flat', label: 'Flat' }]} value={grid.flat ? 'flat' : 'iso'} onChange={(v) => setGrid({ flat: v === 'flat' || undefined })} />
      </Field>
      <label className="flex items-center justify-between gap-2">Tile lines <Toggle size="sm" on={!s.noLines} onToggle={() => set({ noLines: !s.noLines })} /></label>
      <p className="text-[10px] text-neutral-500 leading-relaxed">Drag to lay a floor, or tap for 4 × 4. Pull its handles to extend it.</p>
    </>
  );
}

function PenParams({ s, set, pen }: { s: PenTool; set: (p: Partial<PenTool>) => void; pen: PenControls }) {
  return (
    <>
      <SliderField label="Size" value={s.size} min={1} max={60} notches={[[2, 'fine'], [4, 'normal'], [8, 'bold'], [16, 'marker'], [32, 'wide']]} onChange={(size) => set({ size })} />
      <Field label="Brush">
        <select className={SEL} value={s.brush} onChange={(e) => { set({ brush: e.target.value as VBrush }); e.target.blur(); }}>
          <option value="ink">Ink, follows pressure</option>
          <option value="marker">Marker, even width</option>
          <option value="highlighter">Highlighter, see-through</option>
        </select>
      </Field>
      <Field label="Color"><Swatches value={s.color} noNone onChange={(color) => color && set({ color })} /></Field>
      {pen.live && <TabletFields pen={pen} />}
    </>
  );
}

function TabletFields({ pen }: { pen: PenControls }): ReactNode {
  const statusText = pen.status === 'live' ? `${pen.name}${pen.grabbed ? ', locked to this canvas' : ', keeps inking on the tablet'}` : pen.status === 'connecting' ? 'Connecting…' : 'Not connected';
  return (
    <>
      <div className="flex items-center gap-1.5 text-[10px] leading-snug text-neutral-400" title={statusText}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pen.status === 'live' ? 'bg-emerald-400' : pen.status === 'error' ? 'bg-red-500' : 'bg-amber-400 animate-pulse'}`} />
        <span className="truncate">{statusText}</span>
      </div>
      <Field label="Hold">
        <div className="flex gap-1">
          <select
            className={SEL} value={pen.turn}
            title="How you hold the tablet. Pages are landscape, so upright only draws in a middle band; sideways uses the whole surface."
            onChange={(e) => { pen.setTurn(Number(e.target.value) as PenTurn); e.target.blur(); }}
          >
            <option value={0}>Upright</option>
            <option value={1}>Top to the right</option>
            <option value={-1}>Top to the left</option>
          </select>
          {pen.status === 'live' && (
            <button
              onClick={pen.toggleCalibrate} aria-label="Calibrate pen area"
              title={pen.calibrated ? 'Pen area calibrated. Click to trace it again.' : 'Trace the part of the tablet to draw in'}
              className={`p-1 rounded shrink-0 ${pen.calibrating ? 'bg-amber-500/20 text-amber-300' : pen.calibrated ? 'text-indigo-300 hover:text-white' : 'text-neutral-400 hover:text-white'}`}
            ><Crosshair className="w-3.5 h-3.5" /></button>
          )}
        </div>
      </Field>
      {pen.calibrating && (
        <div className="text-[10px] leading-snug text-amber-300">
          On the tablet, trace the area to draw in as one loop, then lift the pen. Nothing is drawn while you trace.
          {pen.calibrated && <button onClick={pen.clearCalibration} className="ml-1 underline text-neutral-400 hover:text-white">Use the whole tablet</button>}
        </div>
      )}
    </>
  );
}

function EraseParams({ s, set, all }: { s: EraseTool; set: (p: Partial<EraseTool>) => void; all?: boolean }) {
  return (
    <>
      <SliderField label="Size" value={s.size} min={4} max={240} notches={[[16, 'small'], [32, 'normal'], [64, 'large'], [120, 'huge']]} onChange={(size) => set({ size })} />
      <Field label="Shape">
        <Seg options={[{ value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }, { value: 'whole', label: 'Whole' }]} value={s.shape} onChange={(shape) => set({ shape })} />
      </Field>
      <p className="text-[10px] text-neutral-500 leading-relaxed">
        {s.shape === 'whole' ? 'Removes anything it touches.'
          : all ? 'Rubs out anything it passes over: pen strokes are cut, and shapes, lines, text and images get a hole that moves with them.'
          : 'Ink eraser: cuts pen strokes only, so the layout stays whole. Switch to Whole to remove shapes, text, floors and images.'}
      </p>
    </>
  );
}
