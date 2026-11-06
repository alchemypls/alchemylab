import { shape, C } from './kit';

// Side view: a chrome rod with a groove for the ring's yoke
export default shape('bumper-plunger', 'Pop bumper plunger', { in: [1.5, 0.25], mm: [38, 6], note: 'Side view.' },
  ({ box, capsule }) => [
    capsule('rod', -0.75, -0.125, 1.5, 0.25, C.chrome),
    box('groove', 0.45, -0.125, 0.06, 0.25, C.steel, { strokeWidth: 1 }),
    box('yoke-hole', -0.6, -0.04, 0.22, 0.08, C.black, { strokeWidth: 1, radius: 2 }),
  ]);
