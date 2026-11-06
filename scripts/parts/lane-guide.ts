import { block, C } from './kit';

// Lane guide: a thin plastic strip with round ends, splitting two lanes. Runs along v
export default block('lane-guide', 'Lane guide', { cols: 1, rows: 2 },
  { in: [0.3, 1.6, 0.6], estimated: true, note: 'Top lane divider; length varies by game.' },
  ({ poly, ring, disc }) => [
    poly('guide', ring([[0.5, 0.35], [0.5, 1.65]], 0.15), C.white, { h: 0.6 }),
    disc('screw-a', 0.5, 0.35, 0.14, C.chrome, { up: 0.6 }),
    disc('screw-b', 0.5, 1.65, 0.14, C.chrome, { up: 0.6 }),
  ]);
