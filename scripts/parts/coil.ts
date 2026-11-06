import { C, type ShapeKit } from './kit';

// A solenoid coil from the side: nylon bobbin flanges, copper winding under a paper wrapper, two solder lugs on top
export const coil = (L: number, D: number) => ({ box, line }: ShapeKit) => {
  const f = 0.08, x0 = -L / 2, wrap = L * 0.42;
  const turns = Array.from({ length: Math.floor((L - 2 * f) / 0.09) }, (_, i) => x0 + f + 0.05 + i * 0.09)
    .filter((u) => u < -wrap / 2 || u > wrap / 2)
    .map((u, i) => line(`turn-${i}`, u, -D / 2 + 0.02, u + 0.04, D / 2 - 0.02, C.wire, 1.2));
  return [
    box('winding', x0 + f, -D / 2, L - 2 * f, D, C.copper),
    ...turns,
    box('wrapper', -wrap / 2, -D / 2, wrap, D, C.paper),
    line('label-1', -wrap / 2 + 0.12, -0.06, wrap / 2 - 0.12, -0.06, C.paper2, 3), line('label-2', -wrap / 2 + 0.12, 0.06, wrap / 4, 0.06, C.paper2, 3),
    box('flange-a', x0, -D / 2 - 0.08, f, D + 0.16, C.nylon), box('flange-b', -x0 - f, -D / 2 - 0.08, f, D + 0.16, C.nylon),
    box('lug-a', x0 + 0.01, -D / 2 - 0.3, 0.05, 0.22, C.chrome, { strokeWidth: 1 }), box('lug-b', x0 + 0.12, -D / 2 - 0.3, 0.05, 0.22, C.chrome, { strokeWidth: 1 }),
  ];
};
