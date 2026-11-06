import { shape, C } from './kit';

// Plan view: a tapered steel plate from the shaft clamp (round end) to the link pin
export default shape('flipper-crank', 'Flipper crank', { in: [1.5, 0.65, 0.25], mm: [38, 16, 6], note: 'Plan view: shaft clamp at the round end, link pin at the tip.' },
  ({ capsule, disc, box }) => [
    capsule('plate', -0.75, -0.325, 1.5, 0.65, C.steel, 0.5),
    disc('shaft', -0.425, 0, 0.32, C.white), box('clamp-slot', -0.75, -0.025, 0.3, 0.05, C.white, { strokeWidth: 1 }),
    disc('pin', 0.58, 0, 0.13, C.chrome),
  ]);
