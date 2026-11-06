"use client";

import { LIBRARY, SETS } from '@/lib/library';
import { PANEL_SELECT } from '@/workbench/ui/SheetPanel';
import type { Fabricator } from '@/workbench/ui/Fabricator';

// The current file: any library recipe, or a copy in the project
export function ComponentFilePicker({ f }: { f: Fabricator }) {
  const value = f.sel ? `${f.sel.from}:${f.sel.id}` : '';
  return (
    <select
      value={value} className={PANEL_SELECT} title="File"
      onChange={(e) => {
        const [from, ...id] = e.target.value.split(':');
        f.select({ from: from as 'library' | 'project', id: id.join(':') });
        f.setListTab(from as 'library' | 'project');
        e.target.blur();
      }}
    >
      {!f.sel && <option value="">—</option>}
      {SETS.map((set) => (
        <optgroup key={set.key} label={set.name}>
          {set.recipes.map((r) => <option key={r.key} value={`library:${r.key}`}>{r.name}</option>)}
        </optgroup>
      ))}
      {f.components.length > 0 && (
        <optgroup label={f.project.meta.name}>
          {f.components.map((c) => <option key={c.id} value={`project:${c.id}`}>{c.recipe.name}</option>)}
        </optgroup>
      )}
      {!LIBRARY.length && !f.components.length && <option value="">No components</option>}
    </select>
  );
}
