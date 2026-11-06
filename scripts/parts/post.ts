import { block, C } from './kit';

// Rubber post: a white plastic post with a black rubber ring round its middle and a chrome screw on top
export default block('post', 'Rubber post', { cols: 1, rows: 1 },
  { in: [0.75, 0.75, 1.1], estimated: true, note: 'Post about 7/16" across, rubber ring about 3/4" across; height estimated.' },
  ({ disc }) => [
    disc('post-low', 0.5, 0.5, 0.45, C.white, { h: 0.35 }),
    disc('rubber', 0.5, 0.5, 0.75, C.black, { up: 0.35, h: 0.3 }),
    disc('post-high', 0.5, 0.5, 0.45, C.white, { up: 0.65, h: 0.45 }),
    disc('screw', 0.5, 0.5, 0.2, C.chrome, { up: 1.1 }),
  ]);
