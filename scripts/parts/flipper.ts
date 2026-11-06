import { block, C } from './kit';

// Red rubber slab with the white bat set into its top, chrome pivot at the round end. 3 × 0.65 × 0.4"
const L = 3, W = 0.65, H = 0.4, TAPER = 0.46, RUBBER = 0.08;   // the tip is about 0.3" across
const r1 = W / 2 - RUBBER, r2 = (TAPER * W) / 2 - RUBBER;

export default block('flipper', 'Flipper', { cols: 3, rows: 1 },
  { in: [3, 0.65, 0.4], mm: [76, 17, 10], note: 'Williams/Bally 3" bat with its rubber ring. Pivot end round, tip about 0.3" across.' },
  ({ capsule, disc }) => [
    capsule('rubber', 0, (1 - W) / 2, L, W, TAPER, C.rubber, { h: H }),
    capsule('bat', RUBBER, (1 - W) / 2 + RUBBER, L - 2 * RUBBER, 2 * r1, Math.round((r2 / r1) * 100) / 100, C.white, { up: H, extra: { strokeWidth: 1 } }),
    disc('pivot', W / 2, 0.5, 0.2, C.chrome, { up: H, extra: { strokeWidth: 1 } }),
  ]);
