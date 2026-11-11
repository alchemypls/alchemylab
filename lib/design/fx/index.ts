// Effects: a stack on an element (`fx: [{kind: 'roughen', amount: 6}, {kind: 'blur', radius: 3}]`), applied in order.
// Shape effects reshape the outline before it's drawn (and before a solid is swept up from it); filter effects paint
// over the drawn element. Each effect is one file here, listed in FX; its params drive the sliders and the checks.
//
// Adding one: a file exporting an FxDef (stage 'lab'), then a line in FX. Retiring one: stage 'retired'. Never delete
// one a file might still use; validation reports any element still using a retired effect.

import { offered } from '../lifecycle';
import type { Fx, Pt, VElement, VType } from '../vector';
import { blur } from './blur';
import { roughen } from './roughen';
import type { FilterStep, FxDef } from './types';

export type { FilterStep, FxDef, FxParam } from './types';

export const FX: FxDef[] = [roughen, blur] as unknown as FxDef[];
export const fxDef = (kind: string) => FX.find((d) => d.kind === kind);
// The effects a picker offers for these element types: not retired, and fitting all of them
export const fxFor = (types: VType[]) => FX.filter((d) => offered(d) && types.length > 0 && types.every((t) => d.on.includes(t)));

// A new effect at its defaults
export const newFx = (d: FxDef): Fx => ({ kind: d.kind, ...Object.fromEntries(Object.entries(d.params).map(([k, p]) => [k, p.default])) });
// Its settings, missing ones at their defaults and all kept in range
export function fxValues(d: FxDef, f: Fx): Record<string, number> {
  return Object.fromEntries(Object.entries(d.params).map(([k, p]) => {
    const v = f[k];
    return [k, typeof v === 'number' && Number.isFinite(v) ? Math.max(p.min, Math.min(p.max, v)) : p.default];
  }));
}

// The element's effects that are on and fit its type, with their defs
const live = (el: VElement) => (el.fx ?? []).flatMap((f) => { const d = fxDef(f.kind); return d && !f.off && d.on.includes(el.type) ? [{ d, f }] : []; });

export const reshapes = (el: VElement) => live(el).some(({ d }) => d.shape);
export function reshape(el: VElement, pts: Pt[], closed: boolean): Pt[] {
  let seed = 0; for (const c of el.id) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) | 0;
  return live(el).reduce((acc, { d, f }) => (d.shape ? d.shape(acc, fxValues(d, f), seed, closed) : acc), pts);
}
export const filterSteps = (el: VElement): FilterStep[] => live(el).flatMap(({ d, f }) => (d.filter ? [d.filter(fxValues(d, f))] : []));

// Checks a file's `fx` list: errors for what can't draw, a warning for a retired effect still in use
export function checkFx(type: string, raw: unknown, name: string, errors: string[], warnings: string[]) {
  if (!Array.isArray(raw)) { errors.push(`${name}.fx: a list of effects`); return; }
  raw.forEach((f, i) => {
    const at = `${name}.fx[${i}]`;
    if (typeof f !== 'object' || !f || typeof (f as Fx).kind !== 'string') return errors.push(`${at}: {kind, …settings}`);
    const fx = f as Fx, d = fxDef(fx.kind);
    if (!d) return errors.push(`${at}.kind: unknown effect "${fx.kind}" (${FX.map((x) => x.kind).join(', ')})`);
    if (!d.on.includes(type as VType)) errors.push(`${at}: ${d.label} doesn't go on a ${type}`);
    if (d.stage === 'retired') warnings.push(`${at}: ${d.label} is retired (still draws)`);
    if (fx.off !== undefined && typeof fx.off !== 'boolean') errors.push(`${at}.off: boolean`);
    for (const [k, v] of Object.entries(fx)) {
      if (k === 'kind' || k === 'off') continue;
      const p = (d.params as Record<string, { min: number; max: number }>)[k];
      if (!p) errors.push(`${at}.${k}: not a setting of ${d.label} (${Object.keys(d.params).join(', ')})`);
      else if (typeof v !== 'number' || v < p.min || v > p.max) errors.push(`${at}.${k}: number ${p.min}–${p.max}`);
    }
  });
}
