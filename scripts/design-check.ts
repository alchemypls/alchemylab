// Validate design bibles on disk — the agent runs this after every write.
//   npm run design:check            → every bible in design/
//   npm run design:check -- <bible> → one bible
// With no bible named, also checks vault/assets/ and vault/palettes/.
// Prints errors/warnings per file plus the canvas's last fit report; exits 1 on any error or overflow.
// Runs via jiti (already present through tailwind), so imports must stay relative.

import { readdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { pageHash, validateAsset, validateBible, validatePage, type BibleContext, type Issues } from '../lib/design/validate';
import { validatePalette } from '../lib/design/palette';
import { hiddenLayers } from '../lib/design/layers';

const ROOT = path.join(process.cwd(), 'design');
const only = process.argv[2];
let failed = false;

const ls = (dir: string, ext?: string) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => !ext || f.endsWith(ext)) : [];

function report(file: string, run: () => Issues) {
  let issues: Issues;
  try { issues = run(); } catch (e) { issues = { errors: [`invalid JSON: ${(e as Error).message}`], warnings: [] }; }
  const { errors, warnings } = issues;
  if (errors.length) failed = true;
  console.log(`${errors.length ? '✗' : '✓'} ${file}`);
  errors.forEach((m) => console.log(`    error   ${m}`));
  warnings.forEach((m) => console.log(`    warning ${m}`));
}

// The user hid these layers: they're in the file but not on screen, and the fit report skips them
function hidden(file: string, page: unknown) {
  const h = hiddenLayers(page as Parameters<typeof hiddenLayers>[0]);
  if (h.length) console.log(`    hidden  ${h.map((l) => `"${l.name}" (${l.count})`).join(', ')}: hidden by the user, not shown`);
}

const VAULT = path.join(process.cwd(), 'vault', 'assets');
const vault = ls(VAULT, '.json').map((f) => f.slice(0, -5));
if (!only) for (const id of vault) {
  const file = `vault/assets/${id}.json`;
  let page: unknown;
  report(file, () => validateAsset(page = JSON.parse(readFileSync(path.join(VAULT, `${id}.json`), 'utf8'))));
  if (page) hidden(file, page);
}
const PALETTES = path.join(process.cwd(), 'vault', 'palettes');
if (!only) for (const f of ls(PALETTES, '.json')) report(`vault/palettes/${f}`, () => validatePalette(JSON.parse(readFileSync(path.join(PALETTES, f), 'utf8'))));

const bibles = ls(ROOT).filter((d) => existsSync(path.join(ROOT, d, 'bible.json')) && (!only || d === only));
if (!bibles.length) {
  console.log(only ? `No bible "${only}" in design/` : 'No bibles in design/');
  process.exit(only || failed ? 1 : 0);
}

for (const id of bibles) {
  const dir = path.join(ROOT, id);
  const read = (f: string) => JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
  const ctx: BibleContext = {
    pages:  ls(path.join(dir, 'pages'), '.json').map((f) => f.slice(0, -5)),
    assets: ls(path.join(dir, 'assets')),
    vault,
  };
  try { ctx.topics = read('bible.json').topics.map((t: { id: string }) => t.id); } catch { /* reported below */ }
  report(`${id}/bible.json`, () => validateBible(read('bible.json'), ctx));
  for (const p of ctx.pages) {
    let page: unknown;
    report(`${id}/pages/${p}.json`, () => validatePage(page = read(`pages/${p}.json`), ctx));
    if (page) hidden(p, page);
  }

  const fit = existsSync(path.join(dir, '.render.json')) ? read('.render.json') : {};
  for (const p of ctx.pages) {
    const r = fit[p];
    let hash: string | null = null;
    try { hash = pageHash(read(`pages/${p}.json`)); } catch { /* invalid JSON — already reported above */ }
    if (!r) console.log(`  · ${p}: no fit report (open it on the Ideation canvas)`);
    else if (r.hash !== hash) console.log(`  · ${p}: fit report is stale — page changed since measured (open it on the Ideation canvas)`);
    else if (!r.fits) { failed = true; console.log(`  ✗ ${p}: overflows by ${Math.round(r.overflowPx)}px — ${r.overflowing.join(', ')}`); }
    else console.log(`  ✓ ${p}: fits`);
  }
}
process.exit(failed ? 1 : 0);
