import { shape, C } from './kit';

// Side view: an insulator stack holding two leaf blades, contacts near the tips
export default shape('flipper-switch', 'Flipper switch', { in: [1.5, 0.6, 0.5], mm: [38, 15, 13], note: 'Side view: two leaf blades on an insulator stack.' },
  ({ box, line, disc }) => [
    box('stack', -0.75, -0.25, 0.4, 0.5, C.black, { radius: 3 }),
    line('blade-top', -0.35, -0.1, 0.7, -0.12, C.steel, 4), line('blade-bottom', -0.35, 0.1, 0.7, 0.03, C.steel, 4),
    disc('contact-top', 0.55, -0.075, 0.08, C.chrome), disc('contact-bottom', 0.55, -0.005, 0.08, C.chrome),
    line('screw-a', -0.62, -0.3, -0.62, 0.3, C.chrome, 3), line('screw-b', -0.48, -0.3, -0.48, 0.3, C.chrome, 3),
    box('tab-a', -0.37, -0.15, 0.1, 0.06, C.chrome, { strokeWidth: 1 }), box('tab-b', -0.37, 0.07, 0.1, 0.06, C.chrome, { strokeWidth: 1 }),
  ]);
