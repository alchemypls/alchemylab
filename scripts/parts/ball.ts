import { block, C, IN, r } from './kit';

// 1-1/16" steel ball: a floor shadow, then an upright circle with a highlight (round in both views)
const D = 1.0625;

export default block('ball', 'Ball', { cols: 1, rows: 1 }, { in: [1.0625], mm: [27], note: 'Standard steel pinball, 1-1/16" diameter.' },
  ({ disc, upright, pt }) => [
    disc('shadow', 0.5, 0.5, 0.9, C.ink, { extra: { opacity: 0.25, stroke: undefined } }),
    upright('ball', 0.5, 0.5, D, D, 'ellipse', C.chrome),
    // the shine sits up on the ball, a little left of center: from above it stays on the ball
    upright('shine', 0.5, 0.5, 0.276, 0.19, 'ellipse', '#ffffff', { base: 0.68 * D, extra: { x: r(pt(0.5, 0.5).x - 0.28 * D * IN), opacity: 0.85, stroke: undefined } }),
  ]);
