"use client";

import { PickList } from './PickList';
import { useMemo, useState } from 'react';
import { Plus, Copy, Trash2, RotateCcw, X } from 'lucide-react';
import { useWorkbenchStore } from '@/lib/store';
import { projectTheme, type ProjectData } from '@/lib/project';
import {
  LIBRARY, SETS, Recipe, RecipeCategory, Style, Theme, PropValues, OptionPicks,
  Layer, STATE_NAMES, STYLE_KEYS, layerKey, layerStyle, setLayerStyle, partIds,
  addOption, removeOption, parseStyleValue, PROPERTY_SPECS, tokensFor, validateStyleValue,
} from '@/lib/library';
import { RecipeView, RecipeStyles, themeScope, libScope } from './RecipeView';
import { InstanceControls } from './InstanceControls';
import { usePaletteInUse } from './StyleFields';
import { askConfirm } from '@/workbench/ui/Ask';

// The parts of the Fabricator: the Library and this Project's own copies, a live preview with the real
// generated CSS, and styling one layer at a time (base / a variant option / a state) or the theme tokens.
// The Fab canvas and the widget lay these parts out differently.
//
// Copy, don't link: "Add to project" copies a recipe into the project. Editing a project
// component never touches the library or other projects.

const CATEGORY_LABEL: Record<RecipeCategory, string> = {
  basics: 'Basics', forms: 'Forms', containers: 'Containers', feedback: 'Feedback', overlays: 'Overlays',
};

export type FabSelection = { from: 'library' | 'project'; id: string } | null;

const SECTION = 'text-[8px] uppercase tracking-widest text-neutral-500 font-mono';
const INPUT   = 'bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-[10px] text-neutral-200 font-mono outline-none focus:border-indigo-500/60 min-w-0';

export function useFabricator(pid: string, project: ProjectData) {
  const addFromRecipe = useWorkbenchStore((s) => s.addComponentFromRecipe);
  const theme      = projectTheme(project);
  const components = useMemo(() => Object.values(project.components ?? {}), [project.components]);
  const recipes    = useMemo(() => components.map((c) => c.recipe), [components]);

  const [listTab, setListTab] = useState<'library' | 'project'>('library');
  const [sideTab, setSideTab] = useState<'component' | 'theme'>('component');
  const [sel, setSel]         = useState<FabSelection>({ from: 'library', id: LIBRARY[0].key });
  const [picks, setPicks]     = useState<OptionPicks>({});
  const [values, setValues]   = useState<PropValues>({});

  const select = (s: FabSelection) => { setSel(s); setPicks({}); setValues({}); };
  const selComponent = sel?.from === 'project' ? project.components?.[sel.id] : undefined;
  const recipe: Recipe | undefined = sel?.from === 'library' ? LIBRARY.find((r) => r.key === sel.id) : selComponent?.recipe;
  const addToProject = (key: string) => {
    const newId = addFromRecipe(pid, key);
    if (newId) { setListTab('project'); select({ from: 'project', id: newId }); }
  };

  return { pid, project, theme, components, recipes, listTab, setListTab, sideTab, setSideTab, sel, select, picks, setPicks, values, setValues, selComponent, recipe, addToProject };
}
export type Fabricator = ReturnType<typeof useFabricator>;

// Generated CSS: library recipes (under this project's theme) + the project's own copies
export function FabricatorStyles({ f }: { f: Fabricator }) {
  return (
    <>
      <RecipeStyles scope={libScope(f.pid)} theme={f.theme} recipes={LIBRARY} />
      <RecipeStyles scope={themeScope(f.pid)} theme={f.theme} recipes={f.recipes} />
    </>
  );
}

export function FabricatorList({ f }: { f: Fabricator }) {
  const { listTab, setListTab, components, sel, select, addToProject, project } = f;
  return (
    <>
      <div className="flex shrink-0 border-b border-neutral-800">
        {(['library', 'project'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setListTab(t)}
            className={`flex-1 py-2 text-[9px] uppercase tracking-widest font-mono transition-colors ${
              listTab === t ? 'text-white bg-neutral-800/60' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t === 'library' ? `Library · ${LIBRARY.length}` : `Project · ${components.length}`}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {listTab === 'library' ? (
          SETS.map((set) => {
            const items = set.recipes;
            return (
              <div key={set.key} className="mb-1">
                <div className={`${SECTION} px-3 py-1 flex items-baseline gap-1.5`} title={set.description}>
                  <span>{set.name}</span>
                  <span className="text-neutral-700 normal-case tracking-normal">set · {items.length}</span>
                </div>
                {items.map((r, i) => {
                  const active = sel?.from === 'library' && sel.id === r.key;
                  return (
                    <div
                      key={r.key}
                      onClick={() => select({ from: 'library', id: r.key })}
                      className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-[11px] ${active ? 'bg-indigo-500/15 text-white' : 'hover:bg-neutral-800/60'}`}
                    >
                      <span className="flex-1 truncate">{r.name}</span>
                      <span className="text-[8px] font-mono text-neutral-600">{i === 0 && items.length > 1 ? 'box art' : CATEGORY_LABEL[r.category]}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); addToProject(r.key); }}
                        className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-emerald-400"
                        title={`Copy ${r.name} into ${project.meta.name}`}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })
        ) : components.length === 0 ? (
          <div className="px-3 py-6 text-[10px] text-neutral-600 text-center leading-relaxed">
            No components in this project yet.<br />Add one from the Library.
          </div>
        ) : (
          components.map((c) => {
            const active = sel?.from === 'project' && sel.id === c.id;
            return (
              <div
                key={c.id}
                onClick={() => select({ from: 'project', id: c.id })}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-[11px] ${active ? 'bg-indigo-500/15 text-white' : 'hover:bg-neutral-800/60'}`}
              >
                <span className="flex-1 truncate">{c.recipe.name}</span>
                <span className="text-[8px] font-mono text-neutral-600">{c.origin.recipe}</span>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

export function FabricatorHeader({ f }: { f: Fabricator }) {
  const { recipe, sel, addToProject } = f;
  if (!recipe) return null;
  return (
    <div className="px-3 py-2 border-b border-neutral-800 shrink-0 flex items-center gap-2">
      <span className="text-[12px] text-white font-medium truncate">{recipe.name}</span>
      <span className="text-[9px] text-neutral-500 truncate">{recipe.description}</span>
      {sel?.from === 'library' && (
        <button
          onClick={() => addToProject(recipe.key)}
          className="ml-auto shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border border-emerald-600/60 text-emerald-400 hover:bg-emerald-500/15"
        >
          <Plus size={11} /> Add to project
        </button>
      )}
    </div>
  );
}

// The component on its themed background. The stage is the container: responsive components see its width.
export function FabricatorStage({ f, className = '' }: { f: Fabricator; className?: string }) {
  const { recipe, sel, pid, values, picks } = f;
  if (!recipe) return <div className={`flex items-center justify-center text-[11px] text-neutral-600 ${className}`}>Pick a component</div>;
  return (
    <div
      className={`overflow-auto flex items-center justify-center p-8 ${sel?.from === 'library' ? libScope(pid) : themeScope(pid)} ${className}`}
      style={{ background: 'var(--color-bg)' }}
    >
      <div style={{ width: '100%', containerType: 'inline-size', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: recipe.anatomy.style?.width === 'fill' ? '100%' : undefined, maxWidth: '100%' }}>
          <RecipeView recipe={recipe} props={values} options={picks} />
        </div>
      </div>
    </div>
  );
}

// This preview's own variant picks and props
export function FabricatorOptions({ f, compact }: { f: Fabricator; compact?: boolean }) {
  if (!f.recipe) return null;
  return (
    <InstanceControls
      compact={compact}
      recipe={f.recipe}
      options={f.picks}
      props={f.values}
      onOptions={(p) => f.setPicks((prev) => ({ ...prev, ...p }))}
      onProps={(p) => f.setValues((prev) => ({ ...prev, ...p }))}
    />
  );
}

// Component styling / theme
export function FabricatorSide({ f }: { f: Fabricator }) {
  const updateRecipe = useWorkbenchStore((s) => s.updateComponentRecipe);
  const duplicate    = useWorkbenchStore((s) => s.duplicateComponent);
  const remove       = useWorkbenchStore((s) => s.removeProjectComponent);
  const { sideTab, setSideTab, selComponent, recipe, theme, pid, picks, select } = f;
  return (
    <>
      <div className="flex shrink-0 border-b border-neutral-800">
        {(['component', 'theme'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSideTab(t)}
            className={`flex-1 py-2 text-[9px] uppercase tracking-widest font-mono transition-colors ${
              sideTab === t ? 'text-white bg-neutral-800/60' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t === 'component' ? 'Component' : 'Theme'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {sideTab === 'theme' ? (
          <ThemeEditor pid={pid} theme={theme} />
        ) : selComponent ? (
          <ComponentEditor
            key={selComponent.id}
            recipe={selComponent.recipe}
            originLabel={`${selComponent.origin.recipe} v${selComponent.origin.version}`}
            theme={theme}
            picks={picks}
            onChange={(fn) => updateRecipe(pid, selComponent.id, fn)}
            onDuplicate={() => { const n = duplicate(pid, selComponent.id); if (n) select({ from: 'project', id: n }); }}
            onDelete={() => { remove(pid, selComponent.id); select(null); }}
          />
        ) : (
          <div className="p-4 text-[10px] text-neutral-500 leading-relaxed">
            {recipe
              ? <>Library recipes are read-only. <span className="text-neutral-300">Add to project</span> to get your own copy — then you can restyle it, add options, or duplicate it.</>
              : 'Nothing selected.'}
          </div>
        )}
      </div>
    </>
  );
}

// ── Component editor — one styling layer at a time ────────────────

function ComponentEditor({ recipe, originLabel, theme, picks, onChange, onDuplicate, onDelete }: {
  recipe: Recipe; originLabel: string; theme: Theme; picks: OptionPicks;
  onChange: (fn: (r: Recipe) => Recipe) => void;
  onDuplicate: () => void; onDelete: () => void;
}) {
  const [layer, setLayer] = useState<Layer>({ kind: 'base' });
  const [newOpt, setNewOpt] = useState<{ axis: string; name: string } | null>(null);

  const layers: { label: string; layer: Layer; group: string }[] = [
    { label: 'Base', layer: { kind: 'base' }, group: 'Base' },
    ...recipe.variants.flatMap((a) => Object.keys(a.options).map((o) => ({
      label: `${a.name}: ${o}`, layer: { kind: 'variant', axis: a.name, option: o } as Layer, group: 'Options',
    }))),
    ...STATE_NAMES.map((s) => ({ label: s, layer: { kind: 'state', state: s } as Layer, group: 'States' })),
    ...STATE_NAMES.map((s) => ({ label: `each part: ${s}`, layer: { kind: 'partState', state: s } as Layer, group: 'Part states' })),
    ...(['tablet', 'desktop'] as const).map((t) => ({
      label: `${t} and up`, layer: { kind: 'responsive', tier: t } as Layer, group: 'Responsive',
    })),
  ];
  const currentKey = layers.some((l) => layerKey(l.layer) === layerKey(layer)) ? layerKey(layer) : 'base';
  const current    = layers.find((l) => layerKey(l.layer) === currentKey)!.layer;

  const commitOption = () => {
    if (!newOpt) return;
    const name = newOpt.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (name) {
      onChange((r) => addOption(r, newOpt.axis, name, picks[newOpt.axis]));
      setLayer({ kind: 'variant', axis: newOpt.axis, option: name });
    }
    setNewOpt(null);
  };

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          value={recipe.name}
          onChange={(e) => onChange((r) => ({ ...r, name: e.target.value }))}
          className={`${INPUT} flex-1 font-sans text-[12px]`}
          title="Component name"
        />
        <button onClick={onDuplicate} className="text-neutral-500 hover:text-neutral-200" title="Duplicate as a new, independent component"><Copy size={13} /></button>
        <button onClick={onDelete} className="text-neutral-500 hover:text-rose-400" title="Delete from this project"><Trash2 size={13} /></button>
      </div>
      <span className="text-[8px] font-mono text-neutral-600 -mt-2">copied from {originLabel} · class .al-{recipe.key}</span>

      {/* Layer picker */}
      <div className="flex flex-col gap-1">
        <span className={SECTION}>Editing</span>
        <PickList
          value={currentKey} className={INPUT}
          options={['Base', 'Options', 'States', 'Part states', 'Responsive'].flatMap((g) => layers.filter((l) => l.group === g).map((l) => ({ value: layerKey(l.layer), label: l.label, group: g })))}
          onPick={(v) => setLayer(layers.find((l) => layerKey(l.layer) === v)!.layer)}
        />
        <div className="flex items-center gap-2 flex-wrap">
          {recipe.variants.map((a) => (
            <button
              key={a.name}
              onClick={() => setNewOpt({ axis: a.name, name: '' })}
              className="text-[9px] text-indigo-300 hover:text-indigo-200 font-mono"
              title={`Add a new ${a.name} option (starts as a copy of the one previewed)`}
            >
              + {a.name} option
            </button>
          ))}
          {current.kind === 'variant' && recipe.variants.find((a) => a.name === current.axis)?.default !== current.option && (
            <button
              onClick={() => { onChange((r) => removeOption(r, current.axis, current.option)); setLayer({ kind: 'base' }); }}
              className="text-[9px] text-neutral-500 hover:text-rose-400 font-mono ml-auto"
            >
              remove this option
            </button>
          )}
        </div>
        {newOpt && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-neutral-500">{newOpt.axis}:</span>
            <input
              autoFocus
              value={newOpt.name}
              onChange={(e) => setNewOpt({ ...newOpt, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') commitOption(); if (e.key === 'Escape') setNewOpt(null); }}
              placeholder="name, e.g. hero"
              className={`${INPUT} flex-1`}
            />
            <button onClick={commitOption} className="text-[9px] text-emerald-400 font-mono">add</button>
          </div>
        )}
      </div>

      {/* Per-part style rows for the chosen layer */}
      {partIds(recipe).map((pidPart) => (
        <StyleRows
          key={`${currentKey}:${pidPart}`}
          title={pidPart}
          style={layerStyle(recipe, current, pidPart)}
          theme={theme}
          onChange={(st) => onChange((r) => setLayerStyle(r, current, pidPart, st))}
        />
      ))}
    </div>
  );
}

// Key/value rows for one part's style in one layer. Each property only offers what it accepts
// (PROPERTY_SPECS): a dropdown for closed choices, otherwise a text box suggesting just the
// matching token group. Invalid input is rejected with a message, never saved.
function StyleRows({ title, style, theme, onChange }: {
  title: string; style: Style; theme: Theme; onChange: (s: Style) => void;
}) {
  const [errors, setErrors] = useState<Partial<Record<keyof Style, string>>>({});
  const [nonce, setNonce]   = useState(0);   // bumps to reset a rejected input to its saved value
  const tokenNames = useMemo(() => Object.keys(theme.tokens), [theme.tokens]);
  const entries = Object.entries(style) as [keyof Style, string | number][];
  const unused  = STYLE_KEYS.filter((k) => style[k] === undefined);

  const commit = (k: keyof Style, raw: string) => {
    const err = validateStyleValue(k, raw, tokenNames);
    if (err) { setErrors((e) => ({ ...e, [k]: err })); setNonce((n) => n + 1); return; }
    setErrors((e) => ({ ...e, [k]: undefined }));
    onChange({ ...style, [k]: parseStyleValue(raw) } as Style);
  };

  // A new property starts at a valid value: its first choice, first matching token, or 0
  const addProperty = (k: keyof Style) => {
    const spec = PROPERTY_SPECS[k];
    const first = spec.choices && !spec.numeric ? spec.choices[0]
      : tokensFor(k, tokenNames)[0] ? `{${tokensFor(k, tokenNames)[0]}}`
      : spec.numeric ? 0 : spec.choices?.[0] ?? '';
    onChange({ ...style, [k]: first } as Style);
  };

  return (
    <div className="flex flex-col gap-1 border-t border-neutral-800 pt-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-neutral-300 font-mono">{title}</span>
        <div className="w-28">
          <PickList value="" options={unused.map((k) => ({ value: k, label: k }))} onPick={(k) => addProperty(k as keyof Style)} className="justify-end text-[9px] text-neutral-500 hover:text-neutral-300 font-mono">+ property</PickList>
        </div>
      </div>
      {entries.length === 0 && <span className="text-[9px] text-neutral-700 font-mono">no changes in this layer</span>}
      {entries.map(([k, v]) => {
        const spec    = PROPERTY_SPECS[k];
        const listId  = `vals-${title}-${k}`;
        const closed  = spec?.choices && !spec.numeric && !spec.free;
        return (
          <div key={k} className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-neutral-500 font-mono w-20 shrink-0 truncate" title={k}>{k}</span>
              {closed ? (
                <div className="flex-1 min-w-0">
                  <PickList value={String(v)} options={spec!.choices!.map((c) => ({ value: c, label: c }))} onPick={(c) => commit(k, c)} className={INPUT} />
                </div>
              ) : (
                <>
                  <input
                    key={`${String(v)}:${nonce}`}
                    defaultValue={String(v)}
                    list={listId}
                    onBlur={(e) => commit(k, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    className={`${INPUT} flex-1 ${errors[k] ? 'border-rose-500/70' : ''}`}
                  />
                  <datalist id={listId}>
                    {spec?.choices?.map((c) => <option key={c} value={c} />)}
                    {tokensFor(k, tokenNames).map((t) => <option key={t} value={`{${t}}`}>{theme.tokens[t]}</option>)}
                  </datalist>
                </>
              )}
              <button
                onClick={() => { const next = { ...style }; delete next[k]; onChange(next); }}
                className="text-neutral-700 hover:text-rose-400"
              >
                <X size={10} />
              </button>
            </div>
            {errors[k] && <span className="text-[8px] text-rose-400 font-mono pl-[86px]">{errors[k]}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Theme editor — this project's own token values ────────────────

function ThemeEditor({ pid, theme }: { pid: string; theme: Theme }) {
  const setToken = useWorkbenchStore((s) => s.setThemeToken);
  const reset    = useWorkbenchStore((s) => s.resetProjectTheme);
  const { palette } = usePaletteInUse();
  const [picking, setPicking] = useState<string | null>(null);   // the color token showing palette picks
  const groups = useMemo(() => {
    const g: Record<string, [string, string][]> = {};
    for (const [k, v] of Object.entries(theme.tokens)) (g[k.split('.')[0]] ??= []).push([k, v]);
    return g;
  }, [theme.tokens]);

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-neutral-400">{theme.name}</span>
        <button
          onClick={async () => { if (await askConfirm('Reset this project\'s theme to the global base?', { ok: 'Reset' })) reset(pid); }}
          className="flex items-center gap-1 text-[9px] text-neutral-500 hover:text-neutral-200 font-mono"
        >
          <RotateCcw size={10} /> reset to global
        </button>
      </div>
      <p className="text-[9px] text-neutral-600 leading-relaxed -mt-1">
        This project&apos;s own copy. Changing a token restyles every component in this project — other projects are unaffected.
      </p>
      {Object.entries(groups).map(([group, tokens]) => (
        <div key={group} className="flex flex-col gap-1">
          <span className={SECTION}>{group}</span>
          {tokens.map(([name, value]) => (
            <div key={name} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {group === 'color' && (
                <button
                  title={`Pick from the ${palette.title} palette`} aria-label={`Pick ${name} from the palette`} aria-expanded={picking === name}
                  onClick={() => setPicking(picking === name ? null : name)}
                  className={`w-3.5 h-3.5 rounded-sm shrink-0 ${picking === name ? 'ring-1 ring-amber-500' : 'border border-neutral-700'}`} style={{ background: value }}
                />
              )}
              <span className="text-[9px] text-neutral-500 font-mono w-24 shrink-0 truncate" title={name}>{name.slice(group.length + 1)}</span>
              <input
                key={value}
                defaultValue={value}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== value) setToken(pid, name, v); }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                className={`${INPUT} flex-1`}
              />
            </div>
            {picking === name && (
              <div className="flex flex-wrap gap-1 pl-5">
                {palette.colors.map((c, i) => (
                  <button
                    key={i} title={`${c.name} ${c.value}`} aria-label={c.name}
                    onClick={() => { setToken(pid, name, c.value); setPicking(null); }}
                    className={`w-4 h-4 rounded-sm ${c.value.toLowerCase() === value.toLowerCase() ? 'ring-1 ring-amber-500' : 'border border-neutral-700'}`} style={{ background: c.value }}
                  />
                ))}
              </div>
            )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
