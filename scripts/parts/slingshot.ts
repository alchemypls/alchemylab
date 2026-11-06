import { block, C } from './kit';

// A rubber ring round three posts, a plastic cover on top with a red insert, screws in the posts
const TRI: [number, number][] = [[0.6, 0.5], [0.6, 3.5], [2.4, 3.2]];
const POST = 0.4, TALL = 0.6;
const cx = TRI.reduce((s, p) => s + p[0], 0) / 3, cy = TRI.reduce((s, p) => s + p[1], 0) / 3;
const shrink = (f: number): [number, number][] => TRI.map(([u, v]) => [cx + (u - cx) * f, cy + (v - cy) * f]);

export default block('slingshot', 'Slingshot', { cols: 3, rows: 4 },
  { in: [4, 4, 0.7], estimated: true, note: 'Triangle of posts with a rubber ring and a plastic cover; 4 × 4" estimated.' },
  ({ poly, disc, ring }) => [
    poly('rubber', ring(TRI, POST / 2 + 0.07), C.black, { up: 0.22, h: 0.14 }),
    ...TRI.map(([u, v], i) => disc(`post-${i}`, u, v, POST, C.white, { h: TALL })),
    poly('cover', TRI, C.white, { up: TALL, h: 0.06 }),
    poly('insert', shrink(0.55), C.red, { up: TALL + 0.06 }),
    ...TRI.map(([u, v], i) => disc(`screw-${i}`, u, v, 0.15, C.chrome, { up: TALL + 0.06 })),
  ]);
