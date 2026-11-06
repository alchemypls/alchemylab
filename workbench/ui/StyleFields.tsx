"use client";

import { useState } from 'react';
import { NotchedSlider } from './Slider';
import { SectionLabel } from './SectionLabel';
import { useWorkbenchStore } from '@/lib/store';
import { usePalettes } from '@/workbench/hooks/useVault';
import { BASE_PALETTE, HEX, type Palette } from '@/lib/design/palette';
import type { LinePattern } from '@/lib/design/vector';

// The controls both Ideation menus are built from: the tool menu (what a tool makes next)
// and the properties panel (what's selected). A setting looks and works the same in either.


export const SELECT_CLASS = 'bg-neutral-800 text-neutral-200 text-xs px-1.5 py-1 rounded border border-neutral-700 focus:outline-none min-w-0 w-full';

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5 min-w-0"><SectionLabel size="sm" className="!mb-0">{label}</SectionLabel>{children}</div>;
}

// The palette every color picker shows: the one picked, else the vault's first, else the built-in base
export function usePaletteInUse(): { id?: string; palette: Palette; all: { id: string; asset: Palette }[] } {
  const { entries } = usePalettes();
  const picked = useWorkbenchStore((s) => s.swatchPalette);
  const e = entries.find((x) => x.id === picked) ?? entries[0];
  return { id: e?.id, palette: e?.asset ?? BASE_PALETTE, all: entries };
}

export function Swatches({ value, onChange, noNone }: { value?: string; onChange: (v: string | undefined) => void; noNone?: boolean }) {
  const { id, palette, all } = usePaletteInUse();
  const setPalette = useWorkbenchStore((s) => s.setSwatchPalette);
  const ring = (on: boolean) => (on ? 'ring-2 ring-amber-500' : 'ring-1 ring-neutral-700');
  const same = (c: string) => value?.toLowerCase() === c.toLowerCase();
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-8 gap-1">
        {!noNone && <button title="None" aria-label="No color" className={`aspect-square rounded text-[10px] text-neutral-400 ${ring(!value)}`} onClick={() => onChange(undefined)}>∅</button>}
        {palette.colors.map((c, i) => <button key={i} title={`${c.name} ${c.value}`} aria-label={c.name} className={`aspect-square rounded ${ring(same(c.value))}`} style={{ background: c.value }} onClick={() => onChange(c.value)} />)}
        <input type="color" title="Custom" aria-label="Custom color" className="w-full h-full bg-transparent cursor-pointer" value={HEX.test(value ?? '') ? value : '#1f1b16'} onChange={(e) => onChange(e.target.value)} />
      </div>
      {all.length > 1 && (
        <select
          value={id} title="Palette, for every color picker" onChange={(e) => setPalette(e.target.value)}
          className="self-start bg-transparent text-[9px] font-mono text-neutral-500 hover:text-neutral-300 outline-none cursor-pointer"
        >
          {all.map((p) => <option key={p.id} value={p.id} className="bg-neutral-900">{p.asset.title}</option>)}
        </select>
      )}
    </div>
  );
}

// Holds raw text while typing, so clearing the field to retype a number doesn't snap to 0.
// For values with no sensible range, like a position. Everything else is a SliderField.
export function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = useState<string | null>(null);
  return (
    <Field label={label}>
      <input
        className={SELECT_CLASS} inputMode="numeric" value={raw ?? String(Math.round(value))}
        onChange={(e) => { setRaw(e.target.value); const n = Number(e.target.value); if (e.target.value.trim() && Number.isFinite(n)) onChange(n); }}
        onBlur={() => setRaw(null)}
      />
    </Field>
  );
}

// A notched slider: drag, or click a pill to jump. Dragging near a notch snaps to it.
export function SliderField({ label, value, min, max, step = 1, notches, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  notches: (number | [number, string])[];   // a value, or a value and what it means
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <NotchedSlider
        compact min={min} max={max} step={step} value={value} onChange={onChange}
        notches={notches.map((n) => (Array.isArray(n) ? { value: n[0], label: n[1] } : { value: n, label: String(n) }))}
      />
    </Field>
  );
}

export function Seg<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded border border-neutral-700 overflow-hidden">
      {options.map((o) => (
        <button
          key={o.value} onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          className={`flex-1 min-w-0 py-1 text-[11px] truncate ${value === o.value ? 'bg-amber-500/20 text-amber-400' : 'text-neutral-400 hover:bg-neutral-800'}`}
        >{o.label}</button>
      ))}
    </div>
  );
}

const PATTERNS: { value: string; label: string }[] = [{ value: 'solid', label: 'Solid' }, { value: 'dash', label: 'Dashed' }, { value: 'dot', label: 'Dotted' }];

// Color, pattern and size of a border or line
export function BorderFields({ label, color, width, dash, set, noNone }: {
  label: string; color?: string; width: number; dash?: LinePattern; noNone?: boolean;
  set: (p: { stroke?: string; strokeWidth?: number; dash?: LinePattern }) => void;
}) {
  return (
    <>
      <Field label={`${label} color`}><Swatches value={color} noNone={noNone} onChange={(stroke) => set({ stroke })} /></Field>
      <Field label={`${label} style`}>
        <Seg
          options={PATTERNS} value={dash === 'dot' ? 'dot' : dash ? 'dash' : 'solid'}
          onChange={(v) => set({ dash: v === 'dot' ? 'dot' : v === 'dash' ? true : undefined })}
        />
      </Field>
      <SliderField label={`${label} size`} value={width} min={0} max={24} notches={[[1, 'hairline'], [2, 'thin'], [3, 'normal'], [6, 'thick'], [12, 'heavy']]} onChange={(strokeWidth) => set({ strokeWidth })} />
    </>
  );
}

// Shown as transparency, stored as opacity. Fully opaque comes back as 1.
export function Transparency({ opacity = 1, onChange }: { opacity?: number; onChange: (o: number) => void }) {
  return (
    <SliderField
      label="Transparent %" value={Math.round((1 - opacity) * 100)} min={0} max={100}
      notches={[[0, 'solid'], 25, 50, 75]} onChange={(pct) => onChange(Math.round(100 - pct) / 100)}
    />
  );
}
