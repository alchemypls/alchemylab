import { shape, C } from './kit';

// Plan view: a flat link with a pin hole at each end (plunger to crank)
export default shape('flipper-link', 'Flipper linkage', { in: [1.75, 0.4, 0.15], mm: [44, 10, 4], note: 'Plan view: links the plunger to the crank.' },
  ({ capsule, disc }) => [
    capsule('link', -0.875, -0.2, 1.75, 0.4, C.steel),
    disc('hole-a', -0.675, 0, 0.14, C.white), disc('hole-b', 0.675, 0, 0.14, C.white),
  ]);
