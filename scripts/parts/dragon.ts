import { block, C } from './kit';

// The lair's boss: a dragon coiled on its hoard, wings up, head toward the flippers. A moving target in play; this is
// its resting pose. 5 × 5 footprint, about 3.4" tall
const SCALE = '#9e2a22', DARK = '#6e1b16', BELLY = '#d9774a', HORN = C.paper, GOLD = C.yellow;

export default block('dragon', 'Dragon', { cols: 5, rows: 5 },
  { in: [5, 5, 3.4], estimated: true, note: 'Boss toy on its hoard: a moving, evading target. Size is a guess.' },
  ({ disc, capsule, upright, wall }) => [
    disc('hoard', 2.5, 2.5, 4.6, GOLD, { h: 0.2, extra: { n: 2.6 } }),
    ...[[1.1, 1.6], [3.8, 1.3], [1.4, 3.9], [3.9, 3.6], [2.6, 4.3]].map(([u, v], i) => disc(`coin-${i}`, u, v, 0.45, '#ffd95a', { up: 0.2, h: 0.08 })),
    capsule('tail', 0.5, 0.7, 2.4, 0.7, 0.25, DARK, { up: 0.2, h: 0.45 }),
    disc('body', 2.4, 2.4, 2.3, SCALE, { up: 0.2, h: 0.8 }),
    disc('back', 2.4, 2.4, 1.5, BELLY, { up: 1.0 }),
    wall('wing-l', 'right', 1.5, 3.3, 2.0, 2.0, 'ellipse', DARK, { base: 0.8 }),
    wall('wing-r', 'left', 1.3, 1.5, 2.0, 2.0, 'ellipse', DARK, { base: 0.8 }),
    upright('neck', 3.1, 3.1, 0.7, 2.0, 'rect', SCALE, { base: 0.8 }),
    upright('head', 3.3, 3.3, 1.3, 0.95, 'ellipse', SCALE, { base: 2.6 }),
    upright('snout', 3.4, 3.5, 0.75, 0.45, 'ellipse', BELLY, { base: 2.62 }),
    upright('horn-l', 3.0, 3.2, 0.16, 0.6, 'ellipse', HORN, { base: 3.3 }),
    upright('horn-r', 3.6, 3.2, 0.16, 0.6, 'ellipse', HORN, { base: 3.3 }),
    upright('eye-l', 3.05, 3.5, 0.2, 0.2, 'ellipse', GOLD, { base: 3.15 }),
    upright('eye-r', 3.55, 3.5, 0.2, 0.2, 'ellipse', GOLD, { base: 3.15 }),
  ]);
