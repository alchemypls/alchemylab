"use client";

import { useState } from 'react';
import { useWorkbenchStore } from '@/lib/store';
import { createPalette, deletePalette } from '@/workbench/hooks/useVault';
import { HEX, LABEL_H, paletteCell, paletteSize, SWATCH, type Palette } from '@/lib/design/palette';
import { Field } from './StyleFields';
import { TextInput } from './TextInput';

// A vault palette on the Fab canvas: the sheet shows the colors as big swatches, the panel edits them.

const SERIF = 'Georgia, "Times New Roman", serif', MONO = 'ui-monospace, Menlo, monospace';

export function PaletteSheet({ palette, selected, select, add }: {
  palette: Palette; selected: number | null; select: (i: number | null) => void; add: () => void;
}) {
  const size = paletteSize(palette), plus = paletteCell(palette.colors.length);
  return (
    <div style={{ width: size.width, height: size.height, background: '#2a2724', position: 'relative' }} onPointerDown={(e) => { if (e.target === e.currentTarget) select(null); }}>
      {palette.colors.map((c, i) => {
        const at = paletteCell(i);
        return (
          <button
            key={i} onClick={() => select(i)} aria-label={c.name} aria-pressed={selected === i}
            style={{ position: 'absolute', left: at.x, top: at.y, width: SWATCH, height: SWATCH + LABEL_H, textAlign: 'left', padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <div style={{ width: SWATCH, height: SWATCH, borderRadius: 16, background: c.value, boxShadow: selected === i ? '0 0 0 5px #f59e0b' : 'inset 0 0 0 1px rgba(255,255,255,0.12)' }} />
            <div style={{ fontFamily: SERIF, fontSize: 22, color: '#ece5d8', marginTop: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
            <div style={{ fontFamily: MONO, fontSize: 15, color: '#a59c8e', marginTop: 2 }}>{c.value}</div>
          </button>
        );
      })}
      <button
        onClick={add} aria-label="Add a color" title="Add a color"
        style={{ position: 'absolute', left: plus.x, top: plus.y, width: SWATCH, height: SWATCH, borderRadius: 16, border: '3px dashed #5a534b', background: 'none', color: '#8a8175', fontSize: 64, cursor: 'pointer' }}
      >+</button>
    </div>
  );
}

// Adds a copy of the selected color (or a neutral grey) at the end
export function addColor(p: Palette, selected: number | null): Palette {
  const from = selected !== null ? p.colors[selected] : undefined;
  return { ...p, colors: [...p.colors, { name: from ? `${from.name} 2` : `Color ${p.colors.length + 1}`, value: from?.value ?? '#888888' }] };
}
export const removeColor = (p: Palette, i: number): Palette => ({ ...p, colors: p.colors.filter((_, j) => j !== i) });

const BTN = 'text-[11px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30';

export function PaletteFields({ id, palette, selected, select, apply, open }: {
  id: string; palette: Palette; selected: number | null; select: (i: number | null) => void;
  apply: (p: Palette, key?: string) => void; open: (fabFile: string) => void;
}) {
  const inUse = useWorkbenchStore((s) => s.swatchPalette);
  const setInUse = useWorkbenchStore((s) => s.setSwatchPalette);
  const c = selected !== null ? palette.colors[selected] : undefined;
  const setColor = (patch: Partial<Palette['colors'][number]>, key: string) =>
    selected !== null && apply({ ...palette, colors: palette.colors.map((x, j) => (j === selected ? { ...x, ...patch } : x)) }, `${key}:${selected}`);
  const move = (d: number) => {
    if (selected === null) return;
    const to = selected + d, colors = [...palette.colors];
    if (to < 0 || to >= colors.length) return;
    [colors[selected], colors[to]] = [colors[to], colors[selected]];
    apply({ ...palette, colors });
    select(to);
  };
  const duplicate = async () => {
    const r = await createPalette(`${palette.title} copy`, palette);
    if ('id' in r) open(`palette:${r.id}`);
  };
  const remove = async () => {
    if (!window.confirm(`Delete the palette "${palette.title}"? Colors already picked from it stay as they are. This can't be undone.`)) return;
    if (inUse === id) setInUse(undefined);
    await deletePalette(id);
  };

  return (
    <div className="p-3 flex flex-col gap-4 text-xs text-neutral-300">
      {c ? (
        <>
          <Field label="Color name"><TextInput className="w-full" value={c.name} onChange={(name) => setColor({ name }, 'name')} /></Field>
          <Field label="Value">
            <div className="flex items-center gap-1.5">
              <input type="color" aria-label="Pick a color" className="w-8 h-7 bg-transparent cursor-pointer shrink-0" value={HEX.test(c.value) ? c.value : '#888888'} onChange={(e) => setColor({ value: e.target.value }, 'value')} />
              <HexInput value={c.value} onChange={(value) => setColor({ value }, 'value')} />
            </div>
          </Field>
          <div className="flex gap-1">
            <button className={BTN} disabled={selected === 0} onClick={() => move(-1)} title="Move earlier">←</button>
            <button className={BTN} disabled={selected === palette.colors.length - 1} onClick={() => move(1)} title="Move later">→</button>
            <button className={BTN} onClick={() => { apply(addColor(palette, selected)); select(palette.colors.length); }}>Duplicate</button>
            <span className="flex-1" />
            <button className={`${BTN} !border-red-900 !text-red-300`} onClick={() => { apply(removeColor(palette, selected!)); select(null); }}>Remove</button>
          </div>
          <div className="border-t border-neutral-800" />
        </>
      ) : (
        <p className="text-[10px] text-neutral-500 leading-relaxed -mb-1">Click a swatch to edit it, or + to add one.</p>
      )}
      <Field label="Palette name"><TextInput className="w-full" value={palette.title} onChange={(title) => apply({ ...palette, title }, 'title')} /></Field>
      <label className="flex items-center gap-2 text-[11px] cursor-pointer">
        <input type="checkbox" checked={inUse === id} onChange={(e) => setInUse(e.target.checked ? id : undefined)} />
        Show in every color picker
      </label>
      <p className="text-[10px] text-neutral-500 leading-relaxed -mt-2">Picking a color copies it. Changing the palette later doesn&apos;t recolor what you already made.</p>
      <div className="flex gap-1">
        <button className={BTN} onClick={duplicate}>Duplicate palette</button>
        <span className="flex-1" />
        <button className={`${BTN} !border-red-900 !text-red-300`} onClick={remove}>Delete</button>
      </div>
    </div>
  );
}

// Takes #rrggbb (or rrggbb), and only commits a whole color
function HexInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [raw, setRaw] = useState<string | null>(null);
  return (
    <input
      value={raw ?? value} spellCheck={false} aria-label="Hex value" onBlur={() => setRaw(null)}
      className="bg-neutral-800 text-neutral-200 text-xs font-mono px-1.5 py-1 rounded border border-neutral-700 focus:outline-none min-w-0 w-full"
      onChange={(e) => { setRaw(e.target.value); const v = e.target.value.trim().replace(/^(?!#)/, '#'); if (HEX.test(v)) onChange(v.toLowerCase()); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}
