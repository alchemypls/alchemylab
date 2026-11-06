"use client";

import { Recipe, ListItem, PropValues, OptionPicks, pickedOption, propValue } from '@/lib/library';
import { Toggle } from './Toggle';

// Pickers for ONE use of a component: which option on each variant axis, and its prop values
// (label text, disabled, …). Used for the Fabricator's preview and for a placement on the
// Artboard — these never edit the shared component itself.
export function InstanceControls({ recipe, options, props, onOptions, onProps, compact = false }: {
  recipe:    Recipe;
  options?:  OptionPicks;
  props?:    PropValues;
  onOptions: (patch: OptionPicks) => void;
  onProps:   (patch: PropValues) => void;
  compact?:  boolean;
}) {
  const label = 'text-[8px] uppercase tracking-widest text-neutral-500 font-mono shrink-0';
  const field = 'bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-[10px] text-neutral-200 outline-none focus:border-indigo-500/60 min-w-0';

  return (
    <div className={`flex ${compact ? 'flex-row flex-wrap items-center gap-x-4 gap-y-1.5' : 'flex-col gap-2'}`}>
      {recipe.variants.map((axis) => {
        const picked = pickedOption(recipe, options, axis.name);
        return (
          <div key={axis.name} className="flex items-center gap-1.5">
            <span className={label}>{axis.name}</span>
            <div className="flex gap-0.5 flex-wrap">
              {Object.keys(axis.options).map((opt) => (
                <button
                  key={opt}
                  onClick={() => onOptions({ [axis.name]: opt })}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
                    picked === opt ? 'bg-indigo-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {recipe.props.map((p) => {
        const v = propValue(recipe, props, p.name);
        return (
          <div key={p.name} className="flex items-center gap-1.5">
            <span className={label}>{p.name}</span>
            {p.type === 'list' ? (
              <ListEditor
                items={Array.isArray(v) ? v : []}
                fields={p.fields ?? ['label']}
                onChange={(items) => onProps({ [p.name]: items })}
              />
            ) : p.type === 'boolean' ? (
              <Toggle size="sm" on={v === true} onToggle={() => onProps({ [p.name]: v !== true })} />
            ) : p.type === 'choice' ? (
              <select value={String(v)} onChange={(e) => onProps({ [p.name]: e.target.value })} className={field}>
                {p.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                value={String(v)}
                onChange={(e) => onProps({ [p.name]: e.target.value })}
                className={`${field} ${compact ? 'w-28' : 'flex-1'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Rows of a 'list' prop — e.g. nav links as label + href. Add, edit, remove.
function ListEditor({ items, fields, onChange }: {
  items: ListItem[]; fields: string[]; onChange: (items: ListItem[]) => void;
}) {
  const field = 'bg-neutral-800 border border-neutral-700 rounded px-1 py-0.5 text-[9px] text-neutral-200 outline-none focus:border-indigo-500/60 w-20';
  const set = (i: number, f: string, v: string) => onChange(items.map((it, j) => (j === i ? { ...it, [f]: v } : it)));
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1">
          {fields.map((f) => (
            <input key={f} value={it[f] ?? ''} placeholder={f} onChange={(e) => set(i, f, e.target.value)} className={field} />
          ))}
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-[9px] text-neutral-600 hover:text-rose-400">✕</button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, Object.fromEntries(fields.map((f) => [f, f === 'href' ? '/' : 'New']))])}
        className="self-start text-[9px] text-indigo-300 hover:text-indigo-200 font-mono"
      >
        + add
      </button>
    </div>
  );
}
