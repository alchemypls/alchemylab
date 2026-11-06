// Draws vault assets to PNG with the canvas's own components (PosedAsset), for checking a part without the browser.
//   npm run asset:render -- flipper ball          → .render/<id>-iso.png (+ -top.png for blocks), and .render/sheet.png
//   npm run asset:render -- --all                 → every asset
//   --view iso|top|both   (blocks; default both)   --turn 90   --mirror   --size 160 (px tall per picture)
// Needs inkscape (SVG → PNG) and ImageMagick's convert (contact sheet); without them it leaves the SVGs.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { renderToStaticMarkup } from 'react-dom/server';
import { PosedAsset } from '@/workbench/ui/vector/shapes';
import { assetView, blockPose, blockProjection, type VaultAsset } from '@/lib/design/vault';
import { gridOf } from '@/lib/design/vector';

const VAULT = path.join(process.cwd(), 'vault', 'assets'), OUT = path.join(process.cwd(), '.render');
const argv = process.argv.slice(2);
const opt = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const flags = new Set(['--view', '--turn', '--size']);
const ids = argv.filter((a, i) => !a.startsWith('--') && !flags.has(argv[i - 1] ?? ''));
const all = argv.includes('--all') ? readdirSync(VAULT).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : ids;
if (!all.length) { console.error('name assets (or --all)'); process.exit(1); }
const view = opt('view') ?? 'both', turn = Number(opt('turn') ?? 0), mirror = argv.includes('--mirror'), size = Number(opt('size') ?? 160);

// React warns that layout effects don't run on a server; they only measure text, which a picture doesn't need
const warn = console.error;
console.error = (...a: unknown[]) => { if (!String(a[0]).includes('useLayoutEffect')) warn(...a); };

const has = (cmd: string) => spawnSync('which', [cmd]).status === 0;
const png = has('inkscape'), sheet = has('convert');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const made: string[] = [];
for (const id of all) {
  const file = path.join(VAULT, `${id}.json`);
  if (!existsSync(file)) { console.log(`✗ ${id}: not in vault/assets`); continue; }
  const a = JSON.parse(readFileSync(file, 'utf8')) as VaultAsset;
  const views: ('iso' | 'top')[] = a.kind !== 'block' ? ['iso'] : view === 'both' ? ['iso', 'top'] : [view as 'iso' | 'top'];
  for (const vw of views) {
    const flat = a.kind === 'block' ? vw === 'top' : undefined;
    const projected = a.kind === 'block' && !!blockProjection(a, flat ?? !!gridOf(a).flat);
    const el = { asset: id, turn: turn || undefined, mirror: mirror || undefined, projected: projected || undefined };
    const v = assetView(a, projected ? flat : undefined, el), pad = Math.max(v.w, v.h) * 0.06;
    const fp = a.kind === 'block' ? blockPose(a, projected ? flat : undefined, el).corners : null;
    const svg = renderToStaticMarkup(
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${v.x - pad} ${v.y - pad} ${v.w + 2 * pad} ${v.h + 2 * pad}`} height={size} width={Math.round((size * (v.w + 2 * pad)) / (v.h + 2 * pad))}>
        <rect x={v.x - pad} y={v.y - pad} width={v.w + 2 * pad} height={v.h + 2 * pad} fill="#f4efe6" />
        {fp && <polygon points={fp.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#c9a36b" strokeDasharray="4 3" />}
        <PosedAsset asset={a} el={{ ...el, x: v.x, y: v.y, w: v.w, h: v.h }} />
      </svg>,
    );
    const base = path.join(OUT, `${id}-${vw}${turn ? `-t${turn}` : ''}${mirror ? '-m' : ''}`);
    writeFileSync(`${base}.svg`, svg);
    if (png) spawnSync('inkscape', [`${base}.svg`, '--export-type=png', `--export-filename=${base}.png`], { stdio: 'ignore' });
    made.push(png ? `${base}.png` : `${base}.svg`);
  }
}

// One picture of everything drawn, rows of five, for a single look
if (png && sheet && made.length > 1) {
  const rows: string[] = [];
  for (let i = 0; i < made.length; i += 5) {
    const row = path.join(OUT, `_row${i / 5}.png`);
    spawnSync('convert', [...made.slice(i, i + 5), '-background', '#f4efe6', '-splice', '12x0', '+append', row]);
    rows.push(row);
  }
  spawnSync('convert', [...rows, '-background', '#f4efe6', '-splice', '0x12', '-gravity', 'west', '-append', path.join(OUT, 'sheet.png')]);
  console.log(path.join(OUT, 'sheet.png'));
} else made.forEach((f) => console.log(f));
