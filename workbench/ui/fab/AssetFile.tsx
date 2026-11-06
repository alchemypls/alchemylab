"use client";

import { useState } from 'react';
import type { DesignPage } from '@/lib/design/types';
import type { Footprint } from '@/lib/design/vector';
import { FOOTPRINT_MAX, type AssetKind, type VaultAsset } from '@/lib/design/vault';
import { assetUses, deleteAsset } from '@/workbench/hooks/useVault';
import { Field, Seg, Swatches } from '@/workbench/ui/StyleFields';
import { TextInput } from '@/workbench/ui/TextInput';

// The open asset's own settings. Deleting warns where it's used, because those pages lose the drawing.
// Changing the kind to or from block moves the file to the other editor.
export function AssetFile({ id, asset, apply, moved }: { id: string; asset: VaultAsset; apply: (next: DesignPage, key?: string) => void; moved: (kind: AssetKind) => void }) {
  const remove = async () => {
    const uses = await assetUses(id);
    const where = uses.length ? `It's placed on:\n${uses.join('\n')}\n\nThose pages will show a red box instead. ` : '';
    if (window.confirm(`Delete "${asset.title}" from the vault? ${where}This can't be undone.`)) await deleteAsset(id);
  };
  return (
    <div className="p-3 flex flex-col gap-4 text-xs text-neutral-300">
      <Field label="Name"><TextInput className="w-full" value={asset.title} onChange={(title) => apply({ ...asset, title }, 'file:title')} /></Field>
      <Field label="Kind">
        <Seg
          options={[{ value: 'shape', label: 'Shape' }, { value: 'icon', label: 'Icon' }, { value: 'block', label: 'Block' }]} value={asset.kind}
          onChange={(kind) => { apply({ ...asset, kind } as VaultAsset); if ((kind === 'block') !== (asset.kind === 'block')) moved(kind); }}
        />
      </Field>
      {asset.kind === 'block' && <Field label="Footprint on a floor, in tiles">
        <FootprintPicker
          value={asset.footprint ?? { cols: 1, rows: 1 }}
          onChange={(fp) => apply({ ...asset, footprint: fp.cols === 1 && fp.rows === 1 ? undefined : fp } as VaultAsset, 'file:footprint')}   // 1×1 is the default, so it isn't written
        />
      </Field>}
      <p className="text-[10px] text-neutral-500 leading-relaxed">
        A shape is placed trimmed to its drawing. An icon is placed with its whole sheet, so a set lines up.
        A block stands on its footprint (the tiles under the drawing) and lands at the size of the floor&apos;s tiles.
        Edits change it everywhere it&apos;s placed.
      </p>
      <Field label="Real size (l × w × h)">
        <div className="flex flex-col gap-1">
          {(['in', 'mm'] as const).map((u) => (
            <label key={u} className="flex items-center gap-2">
              <DimsInput
                unit={u} value={asset.dims?.[u]}
                set={(nums) => { const next = { ...(asset.dims ?? { in: [] }), [u]: nums }; apply({ ...asset, dims: next.in?.length ? next : undefined } as VaultAsset, `file:dims:${u}`); }}
              />
              <span className="w-6 text-neutral-500">{u}</span>
            </label>
          ))}
          {asset.dims && (
            <label className="flex items-center gap-2 text-[11px] text-neutral-400">
              <input type="checkbox" checked={!!asset.dims.estimated} onChange={(e) => apply({ ...asset, dims: { ...asset.dims!, estimated: e.target.checked || undefined } } as VaultAsset)} />
              Estimated, not a verified spec
            </label>
          )}
          {asset.dims?.note && <p className="text-[10px] text-neutral-500 leading-relaxed">{asset.dims.note}</p>}
        </div>
      </Field>
      <Field label="Sheet color, not placed"><Swatches value={asset.background} onChange={(background) => apply({ ...asset, background }, 'file:bg')} /></Field>
      <button onClick={remove} className="self-start text-[11px] px-2 py-0.5 rounded border border-red-900 text-red-300 hover:bg-red-950">Delete from vault</button>
    </div>
  );
}

// Paint a footprint: press a tile and drag, and the footprint runs from the top tile to it. The inputs reach past the grid.
function FootprintPicker({ value, onChange }: { value: Footprint; onChange: (fp: Footprint) => void }) {
  const n = Math.min(Math.max(8, value.cols + 1, value.rows + 1), FOOTPRINT_MAX);
  const pt = (a: number, b: number) => `${n + a - b},${(a + b) / 2}`;   // isometric, one unit per tile
  const set = (k: keyof Footprint, v: number) => onChange({ ...value, [k]: Math.max(1, Math.min(FOOTPRINT_MAX, Math.round(v) || 1)) });
  const tiles = [];
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const on = a < value.cols && b < value.rows;
    tiles.push(
      <polygon
        key={`${a}:${b}`} points={[pt(a, b), pt(a + 1, b), pt(a + 1, b + 1), pt(a, b + 1)].join(' ')}
        fill={on ? 'rgba(245,158,11,0.45)' : 'transparent'} stroke={on ? '#f59e0b' : '#404040'} strokeWidth={0.04} strokeLinejoin="round"
        onPointerDown={(e) => { e.preventDefault(); onChange({ cols: a + 1, rows: b + 1 }); }}
        onPointerEnter={(e) => { if (e.buttons === 1) onChange({ cols: a + 1, rows: b + 1 }); }}
        style={{ cursor: 'crosshair' }}
      />,
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${2 * n} ${n}`} className="w-full touch-none select-none" style={{ aspectRatio: '2 / 1' }}>{tiles}</svg>
      <div className="flex items-center gap-1.5">
        {(['cols', 'rows'] as const).map((k, i) => (
          <span key={k} className="contents">
            {i > 0 && <span className="text-neutral-500">×</span>}
            <input
              type="number" min={1} max={FOOTPRINT_MAX} step={1} title={k === 'cols' ? "Tiles along the floor's columns" : 'Tiles along its rows'}
              value={value[k]} onChange={(e) => set(k, Number(e.target.value))}
              className="w-12 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-neutral-200"
            />
          </span>
        ))}
      </div>
    </div>
  );
}

// Up to three sizes typed as "3 × 0.65 × 0.4" (x, *, commas or spaces work too). Kept as typed while focused; saved on leaving.
function DimsInput({ unit, value, set }: { unit: 'in' | 'mm'; value?: number[]; set: (nums: number[] | undefined) => void }) {
  const shown = value?.join(' × ') ?? '';
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const nums = draft.split(/[×x*,\s]+/).map(Number).filter((n) => n > 0).slice(0, 3);
    set(nums.length ? nums : undefined);
    setDraft(null);
  };
  return (
    <input
      type="text" value={draft ?? shown} placeholder={unit === 'in' ? '3 × 0.65 × 0.4' : '76 × 17 × 10'}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className="flex-1 min-w-0 bg-neutral-800 text-neutral-200 text-xs px-2 py-1 rounded border border-neutral-700 focus:outline-none placeholder:text-neutral-600"
    />
  );
}
