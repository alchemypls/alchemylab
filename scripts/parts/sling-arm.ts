import { shape, C } from './kit';

// Plan view: the kicker arm, pivot at the round end, plunger slot, kicker blade at the far end
export default shape('sling-arm', 'Slingshot arm', { in: [2.5, 0.5, 0.25], mm: [64, 13, 6], estimated: true, note: 'Plan view: pivot, plunger slot, kicker blade.' },
  ({ capsule, disc, box }) => [
    capsule('arm', -1.25, -0.25, 2.3, 0.5, C.steel, 0.7),
    box('kicker', 0.95, -0.4, 0.3, 0.8, C.steel, { radius: 3 }),
    disc('pivot', -1.0, 0, 0.18, C.white), box('slot', -0.3, -0.05, 0.5, 0.1, C.white, { radius: 3, strokeWidth: 1 }),
  ]);
