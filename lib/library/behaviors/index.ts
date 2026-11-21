import { alchemyCarousel } from './carousel';
import { alchemyTabs } from './tabs';
import { alchemyBurst } from './burst';
import { alchemyAlive } from './alive';
import { alchemyLeader } from './leader';
import { alchemyOrb } from './orb';
import { alchemyBackdrop } from './backdrop';
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
  shapes?: true;            // changes the part's layout (reveals controls, hides panels): the workbench's invisible
                            // sizing copies run it so heights match Live; the rest only change looks and stay off there
}

export const BEHAVIORS: Record<string, BehaviorDef> = {
  carousel: {
    key: 'carousel', name: 'Carousel controls',
    attach: alchemyCarousel, shapes: true,
    support: 'Baseline widely available — querySelector, addEventListener, requestAnimationFrame, Element.scrollTo, matchMedia',
  },
  tabs: {
    key: 'tabs', name: 'Tabs',
    attach: alchemyTabs, shapes: true,
    support: 'Baseline widely available — querySelector, addEventListener, focus(), ARIA roles',
  },
  burst: {
    key: 'burst', name: 'Press burst',
    attach: alchemyBurst,
    support: 'Baseline widely available — Element.animate, getBoundingClientRect, matchMedia',
  },
  alive: {
    key: 'alive', name: 'Alive (glow without a hover)',
    attach: alchemyAlive,
    support: 'Baseline widely available — closest, :scope, hashchange, focusin/focusout',
  },
  leader: {
    key: 'leader', name: 'Leader line',
    attach: alchemyLeader,
    support: 'Baseline widely available — ResizeObserver, MutationObserver, SVGPathElement.getTotalLength, Element.animate',
  },
  orb: {
    key: 'orb', name: 'Orb stick',
    attach: alchemyOrb,
    support: 'Baseline widely available — Pointer Events + pointer capture, CustomEvent, Element.scrollBy; navigator.vibrate where supported',
  },
  backdrop: {
    key: 'backdrop', name: 'Live backdrop (sky, video)',
    attach: alchemyBackdrop,
    support: 'Baseline widely available — WebGL 1, requestAnimationFrame, matchMedia, visibilitychange, HTMLMediaElement.play',
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
