import { block, C } from './kit';

// Spinner: a flat blade hung across a lane between two brackets. Runs along u
export default block('spinner', 'Spinner', { cols: 2, rows: 1 },
  { in: [1.75, 0.3, 1.2], estimated: true, note: 'Blade about 1.3" wide, hung about 0.2" off the playfield.' },
  ({ box, wall }) => [
    box('bracket-a', 0.1, 0.4, 0.2, 0.2, C.steel, { h: 1.2 }),
    wall('blade', 'left', 0.35, 0.5, 1.3, 1.0, 'rect', C.chrome),
    box('bracket-b', 1.7, 0.4, 0.2, 0.2, C.steel, { h: 1.2 }),
  ]);
