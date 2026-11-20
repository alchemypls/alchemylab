"use client";

import { InstanceControls } from '@/workbench/ui/InstanceControls';
import { PIN_SPOTS, PROJECT_ACCENTS, resolvePlacement, type PagePlacement, type Pin, type PinAt } from '@/lib/project';
import type { Tier } from '@/lib/devices';
import { Toggle } from '@/workbench/ui/Toggle';
import type { ProjectComponent } from '@/lib/library';

// One placed component's fields (Web canvas layout layer, Artboard): its planning label and color, then this
// use's own options and text. Restyling the component itself happens on Fab's Components editor.

const I_LABEL = 'text-[10px] text-neutral-500 uppercase tracking-widest';
const I_INPUT = 'bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-indigo-500/60 w-full';

// One placed block: its Artboard label + colour (planning), then this use's options and text.
export function BlockInspector({ placement, number, component, tier, onPatch, onPin, onDeselect }: {
  placement: PagePlacement;
  number?:   number;
  component: ProjectComponent | undefined;
  tier:      Tier;
  onPatch:   (patch: { name?: string; color?: string; options?: Record<string, string>; props?: PagePlacement['props']; bounded?: boolean }) => void;
  onPin:     (pin: Pin | null) => void;
  onDeselect: () => void;
}) {
  const pin = resolvePlacement(placement, tier).pin;
  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {number !== undefined && (
          <span className="min-w-[16px] h-4 px-1 rounded-full bg-indigo-500/80 text-white text-[9px] font-mono leading-4 text-center">{number}</span>
        )}
        <span className="text-[11px] text-neutral-200 truncate flex-1">{placement.name ?? component?.recipe.name ?? 'Missing component'}</span>
        <button onClick={onDeselect} className="text-[9px] text-neutral-600 hover:text-neutral-300" title="Deselect — show page details">✕</button>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={I_LABEL}>Block</span>
        <input
          key={`n-${placement.id}`}
          defaultValue={placement.name ?? ''}
          placeholder={component?.recipe.name ?? 'Block name'}
          onBlur={(e) => onPatch({ name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          className={I_INPUT}
          title="A label for this block — shown on the Artboard and as a comment in the generated code"
        />
        <div className="flex items-center gap-1 flex-wrap" title="Block colour — Artboard only, for planning">
          <button
            onClick={() => onPatch({ color: '' })}
            className={`w-4 h-4 rounded border text-[8px] leading-none text-neutral-500 ${!placement.color ? 'border-white' : 'border-neutral-700'}`}
          >
            ∅
          </button>
          {PROJECT_ACCENTS.map((c) => (
            <button
              key={c}
              onClick={() => onPatch({ color: c })}
              className={`w-4 h-4 rounded border-2 ${placement.color === c ? 'border-white' : 'border-transparent'}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={I_LABEL}>On the screen</span>
        <div className="flex items-center gap-1.5" title="Pinned: fixed to the screen on every device, outside the grid (its spot can differ per device)">
          <span className="text-[11px] text-neutral-400 w-14 shrink-0">Pinned</span>
          <select
            value={pin?.at ?? ''} className={I_INPUT}
            onChange={(e) => onPin(e.target.value ? { ...pin, at: e.target.value as PinAt } : null)}
          >
            <option value="">no, in the grid</option>
            {PIN_SPOTS.map((s) => <option key={s} value={s}>{s}{placement.pin && tier !== 'mobile' ? ` (${tier})` : ''}</option>)}
          </select>
        </div>
        {pin && (
          <label className="flex items-center gap-1.5" title="Keep this many px of its edge clear: the page's grid starts past it">
            <span className="text-[11px] text-neutral-400 w-14 shrink-0">Keep clear</span>
            <input
              key={`r-${placement.id}-${tier}-${pin.reserve ?? 0}`} type="number" min={0} step={8} defaultValue={pin.reserve ?? 0} className={I_INPUT}
              onBlur={(e) => { const r = Math.max(0, Math.round(Number(e.target.value) || 0)); if (r !== (pin.reserve ?? 0)) onPin({ ...pin, reserve: r || undefined }); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <span className="text-[10px] text-neutral-500">px</span>
          </label>
        )}
        {!pin && (
          <div className="flex items-center justify-between" title="Scrolls inside itself, never taller than the screen between the pinned edges">
            <span className="text-[11px] text-neutral-400">Scrolls inside (fits the screen)</span>
            <Toggle size="sm" on={!!placement.bounded} onToggle={() => onPatch({ bounded: !placement.bounded })} />
          </div>
        )}
      </div>

      {component ? (
        <div className="flex flex-col gap-1.5">
          <span className={I_LABEL}>{component.recipe.name} · this use</span>
          <InstanceControls
            recipe={component.recipe}
            options={placement.options}
            props={placement.props}
            onOptions={(o) => onPatch({ options: o })}
            onProps={(v) => onPatch({ props: v })}
          />
          <span className="text-[8px] text-neutral-600 leading-relaxed">
            These only change this block. Restyle the component itself in the Fabricator.
          </span>
        </div>
      ) : (
        <span className="text-[9px] text-rose-400/80">This block&apos;s component was deleted from the project.</span>
      )}
    </div>
  );
}

