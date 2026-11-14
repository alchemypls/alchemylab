// Draws a design page to PNG with the canvas's own VectorArtboard, for checking a page without the browser.
//   npm run page:render -- <bible> <page> [--crop x,y,w,h] [--width px]   → .render/<bible>-<page>.png
// Needs inkscape (SVG → PNG); without it, leaves the SVG.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { renderToStaticMarkup } from 'react-dom/server';
import { VectorArtboard } from '@/workbench/ui/VectorArtboard';
import { placedNow, primeVault } from '@/workbench/hooks/useVault';
import { fitBlocks, type VaultAsset } from '@/lib/design/vault';
import { pageSize, type DesignPage } from '@/lib/design/types';

const argv = process.argv.slice(2);
const opt = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const [bible, pageId] = argv.filter((a, i) => !a.startsWith('--') && !['--crop', '--width'].includes(argv[i - 1] ?? ''));
if (!bible || !pageId) { console.error('usage: page:render -- <bible> <page> [--crop x,y,w,h] [--width px]'); process.exit(1); }

const warn = console.error;   // layout effects only measure text; a picture doesn't need them
console.error = (...a: unknown[]) => { if (!String(a[0]).includes('useLayoutEffect')) warn(...a); };

const read = (dir: string) => readdirSync(dir).filter((f) => f.endsWith('.json'))
  .map((f) => ({ id: f.slice(0, -5), mtime: null, asset: JSON.parse(readFileSync(path.join(dir, f), 'utf8')) }));
const assets = read(path.join('vault', 'assets'));
primeVault(assets, existsSync(path.join('vault', 'palettes')) ? read(path.join('vault', 'palettes')) : []);
const byId = new Map(placedNow().entries.map((e) => [e.id, e.asset as VaultAsset]));   // structures built

const dir = path.join('design', bible);
const page = fitBlocks(JSON.parse(readFileSync(path.join(dir, 'pages', `${pageId}.json`), 'utf8')) as DesignPage, (id) => byId.get(id));
const bibleDoc = JSON.parse(readFileSync(path.join(dir, 'bible.json'), 'utf8'));
let svg = renderToStaticMarkup(<VectorArtboard page={page} bible={bibleDoc} bibleId={bible} onOpen={() => {}} />);

const { width: W, height: H } = pageSize(page);
const crop = opt('crop')?.split(',').map(Number), [cx, cy, cw, ch] = crop?.length === 4 ? crop : [0, 0, W, H];
const width = Number(opt('width') ?? Math.min(cw, 1600));
svg = svg.replace(/<svg([^>]*?)viewBox="[^"]*"/, `<svg xmlns="http://www.w3.org/2000/svg"$1viewBox="${cx} ${cy} ${cw} ${ch}"`)
  .replace(/<svg([^>]*?)>/, (m, attrs) => `<svg${attrs.replace(/\s(width|height|class|style)="[^"]*"/g, '')} width="${width}" height="${Math.round((width * ch) / cw)}">`);

// Text draws as HTML (foreignObject), which inkscape can't render: swap in plain SVG text, wrapped by an estimated width
const unesc = (t: string) => t.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
svg = svg.replace(/<foreignObject x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/foreignObject>/g, (_m, x, y, w, h, inner: string) => {
  const css = (k: string) => inner.match(new RegExp(`${k}:([^;\"]+)`))?.[1];
  const size = parseFloat(css('font-size') ?? '16'), weight = css('font-weight') ?? '400', color = css('color') ?? '#1f1b16', align = css('text-align') ?? 'left';
  const body = inner.match(/white-space:pre-wrap[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? unesc(inner);
  const per = Math.max(1, Math.floor(Number(w) / (size * 0.55))), lines: string[] = [];
  for (const para of unesc(body).split('\n')) {
    let cur = '';
    for (const word of para.split(' ')) { if (cur && (cur + ' ' + word).length > per) { lines.push(cur); cur = word; } else cur = cur ? `${cur} ${word}` : word; }
    lines.push(cur);
  }
  const anchor = align === 'right' ? 'end' : align === 'center' ? 'middle' : 'start', tx = anchor === 'end' ? Number(x) + Number(w) : anchor === 'middle' ? Number(x) + Number(w) / 2 : Number(x);
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<text font-family="sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${lines.map((l, i) => `<tspan x="${tx}" y="${Number(y) + size * (1 + i * 1.3)}">${esc(l)}</tspan>`).join('')}</text>`;
});

const OUT = path.join(process.cwd(), '.render');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const base = path.join(OUT, `${bible}-${pageId}`);
writeFileSync(`${base}.svg`, svg);
if (spawnSync('which', ['inkscape']).status === 0) {
  spawnSync('inkscape', [`${base}.svg`, '--export-type=png', `--export-background=#ffffff`, `--export-filename=${base}.png`], { stdio: 'ignore' });
  console.log(`${base}.png`);
} else console.log(`${base}.svg`);
