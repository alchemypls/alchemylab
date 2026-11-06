import { block, C } from './kit';

// An open steel box. 9 × 2.5 × 1.5" estimated; the footprint rounds to 9 × 3
export default block('trough', 'Ball trough', { cols: 9, rows: 3 },
  { in: [9, 2.5, 1.5], estimated: true, note: 'Depends on ball capacity and maker. Visual estimate only.' },
  ({ box }) => [
    box('box', 0, 0.25, 9, 2.5, C.chrome, { h: 1.5 }),
    box('well', 0.2, 0.45, 8.6, 2.1, C.well, { up: 1.5 }),
  ]);
