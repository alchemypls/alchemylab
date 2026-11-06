import { block, C } from './kit';

// Drop target standing up out of its slot in the playfield. Looks down the table (toward +v)
export default block('drop-target', 'Drop target', { cols: 1, rows: 1 },
  { in: [0.875, 0.2, 1.0], estimated: true, note: 'Face about 7/8" wide, 1" above the playfield when up.' },
  ({ box }) => [
    box('slot', 0.05, 0.35, 0.9, 0.3, C.black),
    box('face', 0.075, 0.425, 0.85, 0.15, C.red, { h: 1.0 }),
  ]);
