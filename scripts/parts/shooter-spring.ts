import { shape, C } from './kit';

// Side view, relaxed: a 14-turn zigzag along a dashed axis
const TURNS = 14;

export default shape('shooter-spring', 'Shooter spring', { in: [2, 0.5], mm: [51, 13], estimated: true, note: 'Side view, relaxed. Drawn as a zigzag; no spring or wave primitive yet.' },
  ({ ink, line }) => {
    const pts: [number, number][] = [[-1, 0]];
    for (let i = 0; i <= TURNS * 2; i++) pts.push([-1 + (i / (TURNS * 2)) * 2, i % 2 ? 0.25 : -0.25]);
    pts.push([1, 0]);
    return [line('axis', -1.05, 0, 1.05, 0, C.paper2, 1, { dash: true }), ink('coil', pts, C.chrome, 4)];
  });
