"use client";

import { createElement, memo, useEffect, useMemo, useRef, ReactNode } from 'react';
import {
  Recipe, Part, Theme, ListItem, themeToCss, recipeToCss, partClass,
  NATIVE, VOID, bind, rootAttrs, partAttrs, shown, renderItems, PropValues, OptionPicks, BEHAVIORS,
} from '@/lib/library';

// ── Live recipe rendering ────────────────────────────────────────
// Renders a recipe as the same native elements + classes the exported code uses (shared helpers
// in lib/library/markup.ts), styled by the generated CSS — so hover/focus/disabled are the real
// browser states, not simulations.
//
// CSS is scoped per project: wrap previews in <div className={themeScope(pid)}> and mount one
// <RecipeStyles> for that scope. Library (not-yet-copied) recipes use libScope so their class
// names can't collide with the project's own copies.

const safe = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '');
export const themeScope = (pid: string) => `al-theme-${safe(pid)}`;
export const libScope   = (pid: string) => `al-lib-${safe(pid)}`;

export const RecipeStyles = memo(function RecipeStyles({ scope, theme, recipes }: {
  scope: string; theme: Theme; recipes: Recipe[];
}) {
  const css = useMemo(
    () => [themeToCss(theme, `.${scope}`), ...recipes.map((r) => recipeToCss(r, `.${scope}`))].join('\n\n'),
    [scope, theme, recipes],
  );
  return <style>{css}</style>;
});

export function RecipeView({ recipe, props, options, slotContent }: {
  recipe:   Recipe;
  props?:   PropValues;
  options?: OptionPicks;
  slotContent?: (slotPartId: string) => ReactNode;   // what fills each slot; default = labelled placeholder
}) {
  // Behaviors run the same runtime the exported page ships, on the rendered root. Re-attached
  // whenever the recipe or this use's props/options change (slides added, loop toggled…).
  const rootRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !recipe.behaviors?.length) return;
    const cleanups = recipe.behaviors.map((b) => BEHAVIORS[b.type]?.attach(el)).filter(Boolean) as (() => void)[];
    return () => cleanups.forEach((c) => c());
  }, [recipe, props, options]);

  const render = (p: Part, item?: ListItem): ReactNode => {
    // A repeating part renders once per list item; its children bind {item.*} to that item
    return renderItems(recipe, p, props, item)
      .map((it, i) => (shown(recipe, p, props, it) ? renderOne(p, it, p.repeat ? `${p.id}-${i}` : p.id) : null));
  };

  const renderOne = (p: Part, item: ListItem | undefined, key: string): ReactNode => {
    const tag    = NATIVE[p.kind];
    const isRoot = p.id === recipe.anatomy.id;
    const attrs: Record<string, unknown> = {
      key,
      className: partClass(recipe, p.id),
      ...(isRoot ? { ...rootAttrs(recipe, props, options), ref: rootRef } : {}),
      ...partAttrs(recipe, p, props, item),
    };
    // In the workbench a nav link must not navigate the editor away
    if (p.kind === 'link') attrs.onClick = (e: { preventDefault: () => void }) => e.preventDefault();

    if (p.kind === 'image' && !attrs.src) {
      // No image chosen yet — neutral placeholder block instead of a broken <img>
      return <div key={key} className={partClass(recipe, p.id)} style={{ background: 'rgba(128,128,128,0.25)', minHeight: 80 }} />;
    }
    if (VOID.has(tag)) return createElement(tag, attrs);
    if (p.kind === 'slot') {
      const filled = slotContent?.(p.id);
      return createElement(tag, attrs, filled ?? (
        <span style={{
          display: 'block', border: '1px dashed rgba(128,128,128,0.5)', borderRadius: 4, padding: '6px 8px',
          fontSize: 10, fontFamily: 'ui-monospace, monospace', opacity: 0.6, textAlign: 'center', width: '100%',
        }}>
          {p.slot?.label ?? p.id}
        </span>
      ));
    }
    const text = bind(recipe, props, p.text, item);
    const kids = (p.children ?? []).map((c) => render(c, item));
    return createElement(tag, attrs, text || null, ...kids);
  };
  return <>{render(recipe.anatomy)}</>;
}
