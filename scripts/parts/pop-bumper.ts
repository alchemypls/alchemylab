import { block, C } from './kit';

// Skirt, body, cap, decal with a star. Centered on a 3×3 footprint
export default block('pop-bumper', 'Pop bumper', { cols: 3, rows: 3 },
  { in: [2.4, 2.4, 1.9], estimated: true, note: 'Cap 2.4" dia × 0.65"; skirt 2.0" dia. Overall height estimated.' },
  ({ disc }) => [
    disc('skirt', 1.5, 1.5, 2.0, C.white, { h: 0.25 }),
    disc('body', 1.5, 1.5, 1.4, C.white, { up: 0.25, h: 1.0, extra: { opacity: 0.9 } }),
    disc('cap', 1.5, 1.5, 2.4, C.red, { up: 1.25, h: 0.65 }),
    disc('decal', 1.5, 1.5, 1.5, C.white, { up: 1.9 }),
    disc('star', 1.5, 1.5, 0.9, C.yellow, { up: 1.9, extra: { n: 0.55 } }),
  ]);
