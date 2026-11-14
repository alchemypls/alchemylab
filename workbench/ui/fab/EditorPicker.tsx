"use client";

import { useWorkbenchStore } from '@/lib/store';
import type { FabEditor } from '@/lib/scenes';
import type { ToolKey } from '@/workbench/ui/ToolRail';
import { PANEL_SELECT } from '@/workbench/ui/SheetPanel';

// Fab's editors, each with its rail: one at a time makes assets for the other canvases
export const EDITORS: { id: FabEditor; label: string; first: ToolKey; tools: ToolKey[] }[] = [
  { id: 'identity',   label: 'Visual Identity', first: 'select', tools: ['select', 'shape', 'text', 'pen', 'erase', 'read'] },
  { id: 'components', label: 'Components',      first: 'browse', tools: ['browse', 'options'] },
  { id: 'blocks',     label: 'Blocks',          first: 'shape',  tools: ['select', 'shape', 'text', 'pen', 'erase', 'read'] },
  { id: 'structures', label: 'Structures',      first: 'select', tools: ['select', 'tile', 'wall', 'roof', 'erase', 'read'] },
];

export function EditorPicker() {
  const editor = useWorkbenchStore((s) => s.fabEditor), setEditor = useWorkbenchStore((s) => s.setFabEditor);
  return (
    <select value={editor} className={PANEL_SELECT} title="Editor" onChange={(e) => { setEditor(e.target.value as FabEditor); e.target.blur(); }}>
      {EDITORS.map((x) => <option key={x.id} value={x.id} className="bg-neutral-900">{x.label}</option>)}
    </select>
  );
}
