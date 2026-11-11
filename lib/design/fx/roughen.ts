// Roughen: the outline walked in short steps, each point pushed in or out at random. Grass, rock, torn paper.
// Random the same way every time for an element (its id + `seed`), so it doesn't shimmer as you edit.

import type { FxDef } from './types';
import type { Pt } from '../vector';

export const roughen: FxDef<{ amount: number; size: number; seed: number }> = {
  kind: 'roughen', label: 'Roughen', stage: 'lab',
  hint: 'Jagged, uneven edges: grass, rocks, torn paper',
  on: ['rect', 'ellipse', 'capsule', 'poly'],
  params: {
    amount: { label: 'Amount', min: 0, max: 40, step: 1, default: 6, unit: 'px' },
    size: { label: 'Detail', min: 3, max: 80, step: 1, default: 12, unit: 'px', hint: 'Distance between the jags: small is fine grit, large is lumpy' },
    seed: { label: 'Variation', min: 0, max: 99, step: 1, default: 0, hint: 'Another roll of the same roughness' },
  },
  shape(pts, p, seed, closed) {
    if (pts.length < 2 || !p.amount) return pts;
    // The outline in steps of about `size`, keeping its own corners
    const step = Math.max(p.size, 1), out: Pt[] = [], n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], len = Math.hypot(b.x - a.x, b.y - a.y), k = Math.max(1, Math.round(len / step));
      for (let j = 0; j < k; j++) out.push({ x: a.x + ((b.x - a.x) * j) / k, y: a.y + ((b.y - a.y) * j) / k });
      if (out.length > 4000) break;
    }
    if (!closed) out.push(pts[pts.length - 1]);
    const rnd = mulberry(seed + p.seed * 7919);
    return out.map((q, i) => {
      const prev = out[closed ? (i - 1 + out.length) % out.length : Math.max(i - 1, 0)], next = out[closed ? (i + 1) % out.length : Math.min(i + 1, out.length - 1)];
      const tx = next.x - prev.x, ty = next.y - prev.y, l = Math.hypot(tx, ty) || 1, push = (rnd() * 2 - 1) * p.amount;
      return { x: q.x - (ty / l) * push, y: q.y + (tx / l) * push };
    });
  },
};

function mulberry(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
