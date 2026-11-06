// Vault assets in a few lines each, in inches, instead of their JSON. For reading a part without its coordinates.
//   npm run asset:info              → one line per asset
//   npm run asset:info -- flipper   → that asset, one line per element
// Relative imports only.

import { readdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import type { VaultAsset } from '../lib/design/vault';
import { gridOf, type VElement } from '../lib/design/vector';

const VAULT = path.join(process.cwd(), 'vault', 'assets');
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const load = (id: string) => JSON.parse(readFileSync(path.join(VAULT, `${id}.json`), 'utf8')) as VaultAsset;
const n = (v: number) => String(Math.round(v * 100) / 100).replace(/^0\./, '.');
const dims = (a: VaultAsset) => (a.dims ? `${a.dims.in.map(n).join(' × ')} in${a.dims.mm ? ` (${a.dims.mm.join(' × ')} mm)` : ''}${a.dims.estimated ? ' est.' : ''}` : 'no dims');

if (!ids.length) {
  for (const f of readdirSync(VAULT).filter((x) => x.endsWith('.json')).sort()) {
    const a = load(f.slice(0, -5)), fp = a.footprint ?? (a.kind === 'block' ? { cols: 1, rows: 1 } : null);
    console.log(`${f.slice(0, -5).padEnd(16)} ${a.kind.padEnd(5)} ${JSON.stringify(a.title).padEnd(22)} ${fp ? `${fp.cols}×${fp.rows}`.padEnd(5) : '     '} ${(a.elements ?? []).length.toString().padStart(3)} els  ${dims(a)}`);
  }
  process.exit(0);
}

for (const id of ids) {
  if (!existsSync(path.join(VAULT, `${id}.json`))) { console.log(`✗ ${id}: not in vault/assets`); continue; }
  const a = load(id), IN = a.kind === 'block' ? gridOf(a).cell : 64, fp = a.footprint;
  console.log(`${id}  ${a.kind} ${JSON.stringify(a.title)}${fp ? `  footprint ${fp.cols}×${fp.rows}` : ''}  ${dims(a)}${a.dims?.note ? `\n  ${a.dims.note}` : ''}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a summary reads whichever fields each element type has
  for (const e of (a.elements ?? []) as (VElement & Record<string, any>)[]) {
    const where = e.plane ? `${e.plane}${e.lift ? ` +${n(e.lift / IN)}` : ''}${e.slope ? ` slope ${n(e.slope)}${e.slopeAlong === 'w' ? 'w' : ''}` : ''}` : e.upright ? `upright${e.base ? ` +${n(e.base / IN)}` : ''}` : 'flat';
    const size = 'w' in e ? `${n(e.w / IN)} × ${n(e.h / IN)}` : e.type === 'stroke' ? `${e.points.length} pts` : e.type === 'line' ? 'line' : '';
    const extra = [
      e.height && `h ${n(e.height / IN)}`, e.taper !== undefined && `taper ${n(e.taper)}`, e.n && `n ${n(e.n)}`, e.radius && `radius ${n(e.radius)}px`,
      e.type === 'poly' && `${e.pts.length} corners${e.open ? ' open' : ''}`, e.rotate && `rot ${e.rotate}°`, e.opacity !== undefined && `opacity ${n(e.opacity)}`,
      e.erased?.length && `${e.erased.length} eraser marks`, e.layer && `layer ${e.layer}`,
    ].filter(Boolean).join('  ');
    const color = e.fill ?? e.color ?? e.stroke ?? '';
    console.log(`  ${String(e.id).padEnd(14)} ${e.type.padEnd(8)} ${where.padEnd(14)} ${size.padEnd(13)} ${color.padEnd(8)} ${extra}`.trimEnd());
  }
}
