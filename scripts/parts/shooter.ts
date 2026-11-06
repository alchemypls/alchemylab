import { block, C } from './kit';

// A chrome rod along the lane (a raised capsule slab), its spring, and the knob standing across the lane at the end
const D = 0.375, KNOB = 1.1, AXIS = 0.6, LEN = 8.625;   // AXIS: the rod's center height

export default block('shooter', 'Shooter plunger', { cols: 9, rows: 1 },
  { in: [8.625, 0.375], mm: [219, 9.5], note: 'Williams/Bally-compatible assembly, 8-5/8" overall, 3/8" rod.' },
  ({ capsule, wall }) => [
    capsule('rod', 0, 0.5 - D / 2, LEN - 0.1, D, 1, C.chrome, { up: AXIS - D / 2, h: D }),
    capsule('spring', 5.8, 0.25, 2, 0.5, 1, C.copper, { up: AXIS - 0.25, h: 0.5, extra: { opacity: 0.85 } }),
    wall('knob', 'right', LEN - 0.05, 0.5 + KNOB / 2, KNOB, KNOB, 'ellipse', C.black, { base: AXIS - KNOB / 2 }),
  ]);
