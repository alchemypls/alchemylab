// A bible's vector pages as one PDF to share, drawn by the canvas's own VectorArtboard and printed by Chrome
// (real text, vector, each PDF page the artboard's size, topic links jump between pages).
//   npm run bible:export -- <bible> [--html]   → .render/<bible>.pdf  (--html keeps .render/<bible>.html too)
// Needs Google Chrome or Chromium. Block pages (no elements) are left out.

import os from "os";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { renderToStaticMarkup } from 'react-dom/server';
import { VectorArtboard } from '@/workbench/ui/VectorArtboard';
import { placedNow, primeVault } from '@/workbench/hooks/useVault';
import { fitBlocks, type VaultAsset } from '@/lib/design/vault';
import { pageSize, type Bible, type DesignPage } from '@/lib/design/types';

const argv = process.argv.slice(2);
const bible = argv.find((a) => !a.startsWith('--'));
if (!bible) { console.error('usage: bible:export -- <bible> [--html]'); process.exit(1); }
const dir = path.join('design', bible);
if (!existsSync(path.join(dir, 'bible.json'))) { console.error(`no bible at ${dir}`); process.exit(1); }

const chrome = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].find((c) => spawnSync('which', [c]).status === 0);
if (!chrome) { console.error('needs Google Chrome or Chromium to print the PDF'); process.exit(1); }

const warn = console.error;   // layout effects only measure text; the browser lays it out for real
console.error = (...a: unknown[]) => { if (!String(a[0]).includes('useLayoutEffect')) warn(...a); };

const read = (d: string) => readdirSync(d).filter((f) => f.endsWith('.json'))
  .map((f) => ({ id: f.slice(0, -5), mtime: null, asset: JSON.parse(readFileSync(path.join(d, f), 'utf8')) }));
primeVault(read(path.join('vault', 'assets')), existsSync(path.join('vault', 'palettes')) ? read(path.join('vault', 'palettes')) : []);
const byId = new Map(placedNow().entries.map((e) => [e.id, e.asset as VaultAsset]));   // structures built

// Order: the index, then pages in topic order, then any page no topic names
const doc = JSON.parse(readFileSync(path.join(dir, 'bible.json'), 'utf8')) as Bible;
const files = readdirSync(path.join(dir, 'pages')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const order = Array.from(new Set(['index', ...doc.topics.map((t) => t.page).filter((p): p is string => !!p), ...files])).filter((p) => files.includes(p));
const pages = order.map((id) => ({ id, page: JSON.parse(readFileSync(path.join(dir, 'pages', `${id}.json`), 'utf8')) as DesignPage }))
  .filter(({ page }) => page.elements?.length);
const skipped = order.filter((id) => !pages.some((p) => p.id === id));

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
const dataUri = (name: string) => {
  const file = path.join(dir, 'assets', name);
  if (!existsSync(file)) { warn(`  missing image: ${name}`); return ''; }
  return `data:${MIME[name.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream'};base64,${readFileSync(file).toString('base64')}`;
};
const unescAttr = (s: string) => s.replace(/&amp;/g, '&');

const sections = pages.map(({ id, page }) => {
  const { width: W, height: H } = pageSize(page);
  let svg = renderToStaticMarkup(<VectorArtboard page={fitBlocks(page, (a) => byId.get(a))} bible={doc} bibleId={bible} onOpen={() => {}} />);
  svg = svg.replace(/href="\/api\/design\?([^"]*)"/g, (_m, q: string) => `href="${dataUri(decodeURIComponent(new URLSearchParams(unescAttr(q)).get('asset') ?? ''))}"`)
    .replace(/<svg([^>]*?)>/, (_m, attrs: string) => `<svg${attrs.replace(/\s(width|height|style)="[^"]*"/g, '')} width="${W}" height="${H}">`);
  if (/href="idb:|useAssetUrl/.test(svg)) warn(`  ${id}: has browser-only images, drawn as empty frames`);
  return { id, W, H, html: `<section id="p-${id}" style="page:p${pages.findIndex((p) => p.id === id)};width:${W}px;height:${H}px">${svg}</section>` };
});

const html = `<!doctype html><html><head><meta charset="utf-8"><title>${doc.title.replace(/</g, '&lt;')}</title><style>
${sections.map((s, i) => `@page p${i}{size:${s.W}px ${s.H}px;margin:0}`).join('\n')}
html,body{margin:0;padding:0}
section{position:relative;overflow:hidden;break-after:page}
section:last-child{break-after:auto}
section>svg{display:block}
a.jump{position:absolute;display:block}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
${sections.map((s) => s.html).join('\n')}
<script>
// Eraser masks span 200000 units so they never clip on the canvas; Chrome's print rasterizes that whole region (slow, huge PDF).
// Shrink each to the box of what it masks, with room for strokes.
for (const g of document.querySelectorAll('g[mask]')) {
  const m = document.getElementById(g.getAttribute('mask').slice(5, -1)), b = g.getBBox(), pad = 64;
  if (!m || !(b.width || b.height)) continue;
  Object.entries({ x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad }).forEach(([k, v]) => m.setAttribute(k, v));
}
// Topic links: an HTML link over each linked piece, so the PDF gets a clickable jump to that page
for (const g of document.querySelectorAll('[data-link]')) {
  const sec = g.closest('section'), to = document.getElementById('p-' + g.dataset.link);
  if (!sec || !to) continue;
  const r = g.getBoundingClientRect(), s = sec.getBoundingClientRect(), a = document.createElement('a');
  a.className = 'jump'; a.href = '#p-' + g.dataset.link;
  Object.assign(a.style, { left: (r.left - s.left) + 'px', top: (r.top - s.top) + 'px', width: r.width + 'px', height: r.height + 'px' });
  sec.appendChild(a);
}
</script></body></html>`;

const OUT = path.join(process.cwd(), '.render');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const htmlFile = path.join(OUT, `${bible}.html`), pdfFile = path.join(OUT, `${bible}.pdf`);
writeFileSync(htmlFile, html);
const profile = mkdtempSync(path.join(os.tmpdir(), "alchemy-pdf-"));
const run = spawnSync(chrome, [`--user-data-dir=${profile}`, '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=5000',
  `--print-to-pdf=${pdfFile}`, `file://${htmlFile}`], { encoding: "utf8", timeout: 300_000 });
rmSync(profile, { recursive: true, force: true });
if (run.status !== 0 || !existsSync(pdfFile)) { warn(run.stderr); process.exit(1); }
if (!argv.includes('--html')) rmSync(htmlFile);
console.log(`${pdfFile}  (${sections.length} pages${skipped.length ? `; left out, no vector elements: ${skipped.join(', ')}` : ''})`);
