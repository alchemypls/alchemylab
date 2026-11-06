import { block, C } from './kit';

// Saucer (eject hole): a chrome cup set into the playfield; the ball rests in it until the kicker throws it out
export default block('saucer', 'Saucer', { cols: 2, rows: 2 },
  { in: [1.6, 1.6], estimated: true, note: 'Cup about 1.6" across with a 1.1" hole.' },
  ({ disc }) => [
    disc('rim', 1, 1, 1.6, C.chrome),
    disc('well', 1, 1, 1.15, C.well),
    disc('hole', 1, 1, 0.7, C.ink),
  ]);
