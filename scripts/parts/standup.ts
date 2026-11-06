import { block, C } from './kit';

// Standup target: a face on a steel bracket. The face looks down the table (toward +v)
export default block('standup', 'Standup target', { cols: 1, rows: 1 },
  { in: [0.75, 0.5, 1.1], estimated: true, note: 'Rectangular face about 3/4" wide; switch and bracket behind it.' },
  ({ box }) => [
    box('bracket', 0.3, 0.3, 0.4, 0.3, C.steel, { h: 0.8 }),
    box('face', 0.125, 0.6, 0.75, 0.12, C.yellow, { h: 1.1 }),
  ]);
