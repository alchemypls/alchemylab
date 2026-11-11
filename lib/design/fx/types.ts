import type { Stage } from '../lifecycle';
import type { Pt, VType } from '../vector';

// One setting of an effect: a number in a range. The inspector and the toolbar draw a slider from this, and
// validation checks files against it, so an effect never needs its own controls or checks.
export interface FxParam { label: string; min: number; max: number; step: number; default: number; unit?: string; hint?: string }

// One SVG filter primitive, as data (lib stays free of React). Effects with filters chain in list order.
export interface FilterStep { tag: 'feGaussianBlur' | 'feDropShadow' | 'feMorphology' | 'feTurbulence' | 'feDisplacementMap' | 'feOffset' | 'feColorMatrix'; attrs: Record<string, string | number> }

export interface FxDef<P extends Record<string, number> = Record<string, number>> {
  kind: string; label: string; hint: string; stage: Stage;
  on: VType[];   // the element types it can go on
  params: { [K in keyof P]: FxParam };
  // Reshapes the outline (the shape's own flat box, so planes, turns and solids follow). seed: stable per element
  shape?: (pts: Pt[], p: P, seed: number, closed: boolean) => Pt[];
  // Or paints over the drawn element with a filter
  filter?: (p: P) => FilterStep;
}
