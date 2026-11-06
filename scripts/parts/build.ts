// Writes vault assets from their part files (scripts/parts/<id>.ts), validated.
//   npm run parts:build                → every part
//   npm run parts:build -- flipper ball → just these
//   --force   overwrite a file that changed on disk (edited on Fab) since the part last wrote it
// A file whose drawing already matches is left alone. Relative imports only.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { validateAsset } from '../../lib/design/validate';
import type { Part } from './kit';

const DIR = path.join(process.cwd(), 'scripts', 'parts'), VAULT = path.join(process.cwd(), 'vault', 'assets');
const args = process.argv.slice(2), force = args.includes('--force'), want = args.filter((a) => !a.startsWith('--'));

const parts: Part[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.ts') && !['kit.ts', 'build.ts'].includes(f))
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- every part file in the folder, found at run time
  .map((f) => (require(path.join(DIR, f)) as { default?: Part }).default)
  .filter((p): p is Part => !!p && typeof p.make === 'function');
const unknown = want.filter((id) => !parts.some((p) => p.id === id));
if (unknown.length) { console.error(`no part file for: ${unknown.join(', ')}`); process.exit(1); }

const same = (a: unknown, b: unknown) => JSON.stringify({ ...(a as object), updated: 0 }) === JSON.stringify({ ...(b as object), updated: 0 });
let failed = false;
for (const p of parts.filter((x) => !want.length || want.includes(x.id))) {
  const asset = p.make(), file = path.join(VAULT, `${p.id}.json`);
  const { errors, warnings } = validateAsset(asset);
  if (errors.length) { failed = true; console.log(`✗ ${p.id}: ${errors.join('; ')}`); continue; }
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  if (prev && same(prev, asset)) { remember(p.id, prev); console.log(`= ${p.id}`); continue; }
  if (prev && !force && !builtBefore(p.id, prev)) { console.log(`! ${p.id}: changed on disk since it was built (edited on Fab?). --force to overwrite`); continue; }
  writeFileSync(file, JSON.stringify(asset, null, 2) + '\n');
  remember(p.id, asset);
  console.log(`✓ ${p.id}${warnings.length ? ` (${warnings.join('; ')})` : ''}`);
}
process.exit(failed ? 1 : 0);

// What each part last wrote, so a hand edit on Fab is noticed instead of overwritten (.render/, not committed)
function stampFile() { return path.join(process.cwd(), '.render', 'parts.json'); }
function stamps(): Record<string, string> { try { return JSON.parse(readFileSync(stampFile(), 'utf8')); } catch { return {}; } }
function key(a: unknown) { return JSON.stringify({ ...(a as object), updated: 0 }); }
function builtBefore(id: string, prev: unknown) { const s = stamps()[id]; return s === undefined ? false : s === key(prev); }
function remember(id: string, a: unknown) {
  const all = stamps(); all[id] = key(a);
  const dir = path.dirname(stampFile());
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(stampFile(), JSON.stringify(all));
}
