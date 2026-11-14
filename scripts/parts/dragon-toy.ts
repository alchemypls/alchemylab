import { block, C } from './kit';

// The dragon perched on the boss cave (cave-dungeon is 1" tall): every dungeon's return rail comes up through the cave's
// top, and the toy lunges to "bite" at the ball as it leaves for the flippers. Built 1" up so it sits on the cave
const SCALE = '#9e2a22', DARK = '#6e1b16', BELLY = '#d9774a', UP = 1;

export default block('dragon-toy', 'Dragon toy (on the boss cave)', { cols: 2, rows: 2 },
  { in: [2, 2, 2.2], estimated: true, note: 'Sits on the boss cave; the jaw snaps at the ball coming out of the return rail.' },
  ({ disc, upright, wall }) => [
    disc('body', 1, 0.9, 1.3, SCALE, { up: UP, h: 0.45 }),
    disc('back', 1, 0.9, 0.8, BELLY, { up: UP + 0.45 }),
    wall('wing-l', 'right', 0.5, 1.4, 1.2, 1.2, 'ellipse', DARK, { base: UP + 0.3 }),
    wall('wing-r', 'left', 0.4, 0.5, 1.2, 1.2, 'ellipse', DARK, { base: UP + 0.3 }),
    upright('neck', 1.3, 1.3, 0.4, 1.1, 'rect', SCALE, { base: UP + 0.3 }),
    upright('head', 1.45, 1.45, 0.8, 0.5, 'ellipse', SCALE, { base: UP + 1.3 }),
    upright('jaw', 1.55, 1.6, 0.6, 0.22, 'ellipse', BELLY, { base: UP + 1.1 }),
    upright('mouth', 1.5, 1.55, 0.45, 0.14, 'ellipse', C.ink, { base: UP + 1.3 }),
    upright('horn-l', 1.25, 1.35, 0.1, 0.35, 'ellipse', C.paper, { base: UP + 1.7 }),
    upright('horn-r', 1.65, 1.35, 0.1, 0.35, 'ellipse', C.paper, { base: UP + 1.7 }),
    upright('eye-l', 1.32, 1.5, 0.12, 0.12, 'ellipse', C.yellow, { base: UP + 1.58 }),
    upright('eye-r', 1.62, 1.5, 0.12, 0.12, 'ellipse', C.yellow, { base: UP + 1.58 }),
  ]);
