// Actions: one-shot things done to the selection (or the page). Each is one entry here, and every place that offers
// actions reads this list: the keys (useVectorTools), the right-click menu (SheetMenu) and the selection bar docked
// beside the properties box (SelectionBar). Pure: an action takes the page and ids and hands back what changed; the
// canvas applies it, selects, and keeps the clipboard.
//
// Adding one: an entry (stage 'lab'); a pure op behind it in lib/design. Retiring one: stage 'retired' (gone from
// keys and menus). An icon is optional: workbench/ui/vector/actionIcons.tsx, else its glyph shows.

import type { Stage } from './lifecycle';
import type { DesignPage } from './types';
import { copyElements, duplicateElements, groupElements, pasteElements, removeElements, reorderElements, ungroupElements, type VClip } from './vector';
import { canTransform, flipElements, quarterTurn } from './transform';

export interface ActionCtx { page: DesignPage; ids: string[]; clip?: VClip | null; selectable?: string[] }
export interface ActionResult { page?: DesignPage; ids?: string[]; clip?: VClip }

export interface Action {
  id: string; label: string; glyph: string; hint?: string; stage: Stage;
  keys?: string;          // 'Ctrl+D', 'Shift+H', ']', 'Del' (Delete or Backspace). Ctrl means Cmd on a Mac too
  on: 'selection' | 'page';   // offered with something selected, or on the page with nothing under the pointer
  group: 'edit' | 'arrange' | 'transform' | 'remove';   // menus list them in this order, with a rule before remove
  bar?: boolean;          // on the selection bar too
  when?: (c: ActionCtx) => boolean;
  run: (c: ActionCtx) => ActionResult;
}

const els = (c: ActionCtx) => (c.page.elements ?? []).filter((e) => c.ids.includes(e.id));
const welded = (c: ActionCtx) => { const e = els(c); return e.length > 1 && !!e[0].group && e.every((x) => x.group === e[0].group); };
const movable = (c: ActionCtx) => canTransform(c.page.elements ?? [], c.ids);

export const ACTIONS: Action[] = [
  { id: 'duplicate', label: 'Duplicate', glyph: '⧉', keys: 'Ctrl+D', on: 'selection', group: 'edit', stage: 'stable', bar: true,
    run: (c) => duplicateElements(c.page, c.ids) },
  { id: 'copy', label: 'Copy', glyph: '⎘', keys: 'Ctrl+C', on: 'selection', group: 'edit', stage: 'stable',
    run: (c) => ({ clip: copyElements(c.page, c.ids) }) },
  { id: 'cut', label: 'Cut', glyph: '✂', keys: 'Ctrl+X', on: 'selection', group: 'edit', stage: 'stable',
    run: (c) => ({ clip: copyElements(c.page, c.ids), page: removeElements(c.page, c.ids), ids: [] }) },
  { id: 'paste', label: 'Paste', glyph: '📋', keys: 'Ctrl+V', on: 'page', group: 'edit', stage: 'stable',
    when: (c) => !!c.clip, run: (c) => (c.clip ? pasteElements(c.page, c.clip) : {}) },
  { id: 'select-all', label: 'Select all', glyph: '⬚', on: 'page', group: 'edit', stage: 'stable',
    when: (c) => !!c.selectable?.length, run: (c) => ({ ids: c.selectable }) },
  { id: 'group', label: 'Group', glyph: '⊂', keys: 'Ctrl+G', on: 'selection', group: 'arrange', stage: 'stable',
    when: (c) => c.ids.length > 1 && !welded(c), run: (c) => ({ page: groupElements(c.page, c.ids) }) },
  { id: 'ungroup', label: 'Ungroup', glyph: '⊄', keys: 'Ctrl+Shift+G', on: 'selection', group: 'arrange', stage: 'stable',
    when: welded, run: (c) => ({ page: ungroupElements(c.page, c.ids) }) },
  { id: 'front', label: 'Bring to front', glyph: '▲', on: 'selection', group: 'arrange', stage: 'stable',
    run: (c) => ({ page: reorderElements(c.page, c.ids, 'front') }) },
  { id: 'back', label: 'Send to back', glyph: '▼', on: 'selection', group: 'arrange', stage: 'stable',
    run: (c) => ({ page: reorderElements(c.page, c.ids, 'back') }) },
  { id: 'flip-x', label: 'Flip left to right', glyph: '⇋', keys: 'Shift+H', on: 'selection', group: 'transform', stage: 'lab', bar: true,
    hint: 'Mirror across the middle of the selection. Text keeps reading the right way; pieces lying in a plane flip in place',
    when: movable, run: (c) => ({ page: flipElements(c.page, c.ids, 'x') }) },
  { id: 'flip-y', label: 'Flip upside down', glyph: '⥮', keys: 'Shift+V', on: 'selection', group: 'transform', stage: 'lab', bar: true,
    hint: 'Mirror top to bottom across the middle of the selection',
    when: movable, run: (c) => ({ page: flipElements(c.page, c.ids, 'y') }) },
  { id: 'turn-cw', label: 'Turn right 90°', glyph: '↻', keys: ']', on: 'selection', group: 'transform', stage: 'lab', bar: true,
    hint: 'A quarter turn clockwise about the middle of the selection. Lines and pen strokes turn too; pieces lying in a plane turn in place (a capsule there becomes a polygon)',
    when: movable, run: (c) => ({ page: quarterTurn(c.page, c.ids, 1) }) },
  { id: 'turn-ccw', label: 'Turn left 90°', glyph: '↺', keys: '[', on: 'selection', group: 'transform', stage: 'lab', bar: true,
    when: movable, run: (c) => ({ page: quarterTurn(c.page, c.ids, -1) }) },
  { id: 'delete', label: 'Delete', glyph: '🗑', keys: 'Del', on: 'selection', group: 'remove', stage: 'stable',
    run: (c) => ({ page: removeElements(c.page, c.ids), ids: [] }) },
];

const ORDER: Action['group'][] = ['edit', 'arrange', 'transform', 'remove'];
// What to offer here and now, in menu order. Retired actions are never offered
export const actionsFor = (on: Action['on'], c: ActionCtx) =>
  ACTIONS.filter((a) => a.stage !== 'retired' && a.on === on && (a.on === 'page' || c.ids.length > 0) && (!a.when || a.when(c)))
    .sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group));

// Does a key press match an action's keys?
export function matchKeys(keys: string, e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  const parts = keys.split('+'), key = parts[parts.length - 1].toLowerCase(), want = new Set(parts.slice(0, -1).map((s) => s.toLowerCase()));
  if ((e.ctrlKey || e.metaKey) !== want.has('ctrl') || e.shiftKey !== want.has('shift') || e.altKey !== want.has('alt')) return false;
  const k = e.key.toLowerCase();
  return key === 'del' ? k === 'delete' || k === 'backspace' : k === key;
}
// The action a key press runs right now, if any (stage and `when` checked)
export function actionForKey(e: Parameters<typeof matchKeys>[1], c: ActionCtx): Action | undefined {
  return ACTIONS.find((a) => a.keys && a.stage !== 'retired' && matchKeys(a.keys, e) && (a.on === 'page' || c.ids.length > 0) && (!a.when || a.when(c)));
}
// 'Ctrl+Shift+G' as a menu shows it
export const keysLabel = (keys?: string) => keys?.replace(/\+/g, ' ').replace('Shift', '⇧');
