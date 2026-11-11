"use client";

// An element's effect stack (lib/design/fx), as controls: one card per effect with a slider per setting, all drawn
// from the effect's own params, so a new effect needs no UI of its own. Used for the selection (VectorInspector) and
// for what the Shapes tool makes next (ToolMenu).

import { ChevronUp, Eye, EyeOff, X } from 'lucide-react';
import { fxDef, fxFor, fxValues, newFx } from '@/lib/design/fx';
import { STAGE_NOTE } from '@/lib/design/lifecycle';
import type { Fx, VType } from '@/lib/design/vector';
import { Field, SliderField } from './StyleFields';

const ICON = 'p-0.5 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent';
const STAGE_TAG = { lab: 'text-sky-400/80', retired: 'text-neutral-500', stable: '' } as const;

export function FxFields({ value = [], types, onChange }: {
  value?: Fx[]; types: VType[];
  onChange: (fx: Fx[] | undefined, key?: string) => void;   // key: edits with the same key merge into one undo step
}) {
  const put = (list: Fx[], key?: string) => onChange(list.length ? list : undefined, key);
  const at = (i: number, f: Fx | null) => value.flatMap((x, j) => (j === i ? (f ? [f] : []) : [x]));
  const addable = fxFor(types);
  if (!addable.length && !value.length) return null;
  return (
    <Field label="Effects">
      {value.map((f, i) => {
        const d = fxDef(f.kind);
        if (!d) return <div key={i} className="text-[11px] text-red-300">Unknown effect “{f.kind}” <button className={ICON} onClick={() => put(at(i, null))}><X size={12} /></button></div>;
        const v = fxValues(d, f);
        return (
          <div key={i} className={`rounded-lg border border-neutral-700/60 p-1.5 flex flex-col gap-1.5 ${f.off ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-neutral-200" title={d.hint}>{d.label}</span>
              {d.stage !== 'stable' && <span className={`text-[8px] uppercase tracking-wider ${STAGE_TAG[d.stage]}`} title={STAGE_NOTE[d.stage]}>{d.stage}</span>}
              <span className="flex-1" />
              <button className={ICON} title="Move up: effects apply top to bottom" disabled={i === 0} onClick={() => { const l = [...value]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; put(l); }}><ChevronUp size={12} /></button>
              <button className={ICON} title={f.off ? 'Turn on' : 'Turn off (kept, not drawn)'} onClick={() => put(at(i, { ...f, off: f.off ? undefined : true }))}>{f.off ? <EyeOff size={12} /> : <Eye size={12} />}</button>
              <button className={ICON} title="Remove" onClick={() => put(at(i, null))}><X size={12} /></button>
            </div>
            {Object.entries(d.params).map(([k, p]) => (
              <SliderField
                key={k} label={`${p.label}${p.unit ? ` (${p.unit})` : ''}`} value={v[k]} min={p.min} max={p.max} step={p.step}
                notches={[[p.default, 'default']]}
                onChange={(n) => put(at(i, { ...f, [k]: Math.round(n / p.step) * p.step }), `fx:${i}:${k}`)}
              />
            ))}
          </div>
        );
      })}
      {addable.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {addable.map((d) => (
            <button
              key={d.kind} title={`${d.hint}${d.stage === 'lab' ? `\n${STAGE_NOTE.lab}` : ''}`} onClick={() => put([...value, newFx(d)])}
              className="px-2 py-0.5 rounded-full border border-neutral-700 text-[11px] text-neutral-300 hover:bg-neutral-800 flex items-center gap-1"
            >+ {d.label}{d.stage === 'lab' && <span className="w-1 h-1 rounded-full bg-sky-400" />}</button>
          ))}
        </div>
      )}
    </Field>
  );
}
