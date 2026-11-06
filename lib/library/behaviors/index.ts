import { alchemyCarousel } from './carousel';
import { alchemyTabs } from './tabs';
import type { Recipe } from '../recipe';

// ── Behavior catalog ──────────────────────────────────────────────
// A recipe names behaviors (recipe.behaviors[].type); this catalog is the only place that holds
// their code. Each runtime is a self-contained function: the Workbench preview calls it on the
// rendered element, and page generators copy its source into the output — so the preview runs
// exactly what ships. Keep runtimes to long-established ("Baseline widely available") browser APIs.

export interface BehaviorDef {
  key:     string;
  name:    string;
  attach:  (root: HTMLElement) => () => void;
  support: string;          // browser-support note (for the future Assay checks)
}

export const BEHAVIORS: Record<string, BehaviorDef> = {
  carousel: {
    key: 'carousel', name: 'Carousel controls',
    attach: alchemyCarousel,
    support: 'Baseline widely available — querySelector, addEventListener, requestAnimationFrame, Element.scrollTo, matchMedia',
  },
  tabs: {
    key: 'tabs', name: 'Tabs',
    attach: alchemyTabs,
    support: 'Baseline widely available — querySelector, addEventListener, focus(), ARIA roles',
  },
};

// Every behavior a set of recipes uses
export const behaviorsUsed = (recipes: Recipe[]) =>
  Array.from(new Set(recipes.flatMap((r) => (r.behaviors ?? []).map((b) => b.type)))).filter((k) => BEHAVIORS[k]);

// Plain-JS source that defines each used runtime and attaches it to every matching element.
// Idempotent per element (each runtime cleans up a previous run on the same root).
export function behaviorScript(keys: string[]): string {
  if (!keys.length) return '';
  return keys.map((k) => {
    const fn = BEHAVIORS[k].attach;
    return [
      `(function () {`,
      `  var attach = ${fn.toString()};`,
      `  document.querySelectorAll('[data-behavior~="${k}"]').forEach(function (el) { attach(el); });`,
      `})();`,
    ].join('\n');
  }).join('\n');
}
