// Blur: softens the whole element, edges and all. Shadows, haze, glows, things out of focus.

import type { FxDef } from './types';

export const blur: FxDef<{ radius: number }> = {
  kind: 'blur', label: 'Blur', stage: 'lab',
  hint: 'Soft, out-of-focus edges: haze, glows, shadows',
  on: ['rect', 'ellipse', 'capsule', 'poly', 'line', 'text', 'image', 'stroke', 'asset'],
  params: { radius: { label: 'Radius', min: 0.5, max: 40, step: 0.5, default: 4, unit: 'px' } },
  filter: (p) => ({ tag: 'feGaussianBlur', attrs: { stdDeviation: p.radius } }),
};
