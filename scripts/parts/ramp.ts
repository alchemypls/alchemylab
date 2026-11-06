import { block, C, IN } from './kit';

// Ramp: a clear plastic bed rising from the playfield at its mouth (v = 10) to 3" at its back (v = 0), with side rails
const LEN = 10, TOP = 3, LIP = 0.1, RAIL = 0.75, U0 = 0.3, U1 = 2.7;
const slope = -(TOP - LIP) / LEN, tall = TOP + RAIL;
const rail = (id: string, u: number, wall: (...a: never[]) => unknown) => (wall as unknown as (...a: unknown[]) => Record<string, unknown>)(
  id, 'right', u, LEN, LEN, tall, 'rect', '#cfe3ea',
  { extra: { type: 'poly', opacity: 0.9, pts: [[0, 1 - LIP / tall], [0, 1 - (LIP + RAIL) / tall], [1, 0], [1, RAIL / tall]] } },
);

export default block('ramp', 'Ramp', { cols: 3, rows: 10 },
  { in: [2.4, 10, 3.75], estimated: true, note: 'Ramp mouth about 2.4" wide; 3" rise over 10" for the test bench.' },
  ({ box, wall }) => [
    rail('rail-far', U1, wall as never),
    box('bed', U0, 0, U1 - U0, LEN, '#cfe3ea', { up: TOP, extra: { slope: Math.round(slope * 1000) / 1000, opacity: 0.9 } }),
    box('lip', U0, LEN - 0.35, U1 - U0, 0.35, C.chrome),
    rail('rail-near', U0, wall as never),
  ]);
void IN;
