import { PageLayout, PagePlacement, PageDef, PageSection, ProjectMeta, PlacementGeom, Insets, getActivePlacements, resolvePlacement, pageInsets, pinStyle, boundedMax, safeBackdrop } from '../project';
import { TIERS, TIER_ORDER, TIER_COLUMNS } from '../devices';
import { ProjectComponent, Theme, themeToCss, recipeToCss, recipeToMarkup, behaviorsUsed, behaviorScript, fontsHref } from '../library';

function toVarName(label: string): string {
  return label.replace(/[^a-zA-Z0-9]/g, '').replace(/^[0-9]/, '_$&') || 'Component';
}

// Page head → Next.js `metadata` export. Page fields win; project head fields are fallbacks
// (project headTitle becomes a "Page — Site" suffix). Returns [] when there's nothing to emit.
function metadataLines(page: PageDef, meta?: ProjectMeta): string[] {
  const head  = page.head ?? {};
  const title = head.title?.trim() || (meta?.headTitle?.trim() ? `${page.name} — ${meta.headTitle.trim()}` : '');
  const desc  = head.description?.trim() || meta?.headDescription?.trim() || '';
  const og    = head.ogImage?.trim();
  const fields = [
    title        && `  title: ${JSON.stringify(title)},`,
    desc         && `  description: ${JSON.stringify(desc)},`,
    og           && `  openGraph: { images: [${JSON.stringify(og)}] },`,
    head.noindex && `  robots: { index: false, follow: false },`,
  ].filter(Boolean) as string[];
  return fields.length ? [`export const metadata = {`, ...fields, `};`, ``] : [];
}

// ── Responsive page output (mobile-first) ────────────────────────
// One self-contained page file: the project theme as CSS variables, the CSS of each component
// the page uses, and one CSS grid — mobile columns by default, then an @media (min-width) block
// per wider tier with only the rules that change there (the same cascade resolvePlacement()
// models in the editor). Native elements, no component imports, no runtime dependencies.
// Rows are the artboard's 80px row track (grid-auto-rows: minmax(80px, auto)).

const GAP = 16;
const MAIN = 'max-width: 1440px; margin: 0 auto; box-sizing: border-box; container-type: inline-size;';
const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

// A grid cell at one tier; a bounded one scrolls inside, no taller than the screen between the kept-clear edges
function cellCss(p: PagePlacement, g: PlacementGeom, ins: Insets): string {
  if (g.hidden) return 'display: none;';
  const bound = p.bounded ? ` max-height: ${boundedMax(g.row, ins, GAP)}; overflow-y: auto; overscroll-behavior: contain; align-self: start;` : '';
  return `grid-column: ${g.col + 1} / span ${g.colSpan}; grid-row: ${g.row + 1} / span ${g.rowSpan}; display: block;${bound}`;
}

// A pinned block at one tier: its spot (every side reset first, so a spot moved on a wider tier leaves nothing behind)
function pinCss(g: PlacementGeom, cols: number): string {
  if (g.hidden || !g.pin) return 'display: none;';
  const spot = Object.entries(pinStyle(g.pin, g.colSpan, cols)).map(([k, v]) => `${kebab(k)}: ${v};`).join(' ');
  return `display: block; top: auto; right: auto; bottom: auto; left: auto; width: auto; ${spot}`;
}

const mainPadding = (ins: Insets) => `padding: ${ins.top}px ${GAP + ins.right}px ${ins.bottom}px ${GAP + ins.left}px;`;

// One grid of the page: the page's own, or a section shown in place (id = its #hash; null = a page without sections)
interface Grid { id: string | null; name: string; cells: PagePlacement[] }

// Sections: one shows at a time, picked by :target (no script needed); with no hash, the first. The enter is a short
// rise (a fade when the OS asks for calm).
const SECTION_CSS = [
  `.page-sec:not(:target) { display: none; }`,
  `.page-main:not(:has(.page-sec:target)) > .page-sec:first-child { display: grid; }`,
  `.page-sec:target { animation: page-sec-in var(--motion-enter, 300ms) var(--motion-ease-enter, ease-out); }`,
  `@keyframes page-sec-in { from { opacity: 0; transform: translateY(8px); } }`,
  `@keyframes page-sec-fade { from { opacity: 0; } }`,
  `@media (prefers-reduced-motion: reduce) { .page-sec:target { animation-name: page-sec-fade; } }`,
];

// Marks the rail link of the section showing (aria-current="page") as the hash changes. Self-contained: its source is
// copied into the page. Without it, sections still switch; only the current-link styling waits.
function alchemySections(ids: string[]) {
  const mark = () => {
    const h = location.hash.slice(1), on = ids.indexOf(h) >= 0 ? h : ids[0];
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      const to = (a.getAttribute('href') || '').slice(1);
      if (ids.indexOf(to) < 0) return;
      if (to === on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  };
  window.addEventListener('hashchange', mark);
  mark();
}

// What both outputs share: the components used, the CSS (theme, backdrop, components, the grids and pins per tier),
// the grids and the pinned blocks, the links that stay on the page, the script (behaviors, sections)
function pageParts(page: PageDef, layout: PageLayout, components: Record<string, ProjectComponent>, theme: Theme, meta?: ProjectMeta, sections: PageSection[] = []) {
  const all      = getActivePlacements(layout);
  const pinned   = all.filter((p) => p.pin);
  const byRow    = (a: PagePlacement, b: PagePlacement) => a.row - b.row || a.col - b.col;
  const own      = all.filter((p) => !p.pin).sort(byRow);
  const grids: Grid[] = !sections.length ? [{ id: null, name: page.name, cells: own }] : [
    ...(own.length ? [{ id: 'top', name: page.name, cells: own }] : []),
    ...sections.map((s) => ({ id: s.id, name: s.name, cells: getActivePlacements(s.layout).filter((p) => !p.pin).sort(byRow) })),
  ];
  const owner    = new Map<PagePlacement, string | null>(grids.flatMap((g) => g.cells.map((p) => [p, g.id] as const)));
  const cls      = (p: PagePlacement) => `${owner.get(p) ? `${owner.get(p)}--` : ''}p-${p.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const cells    = grids.flatMap((g) => g.cells);
  const used     = Array.from(new Set([...pinned, ...cells].map((p) => p.componentId))).map((id) => components[id]).filter(Boolean);
  const backdrop = safeBackdrop(page.backdrop) ?? safeBackdrop(meta?.backdrop);
  const anchors  = Object.fromEntries(sections.map((s) => [s.path, `#${s.id}`]));

  // CSS — theme, backdrop, components, then the page per tier: mobile base + what changes at each wider tier
  const mIns = pageInsets(all, 'mobile');
  const css: string[] = [
    themeToCss(theme),
    `body { margin: 0; background: var(--color-bg); color: var(--color-text); font-family: var(--font-sans); }`,
    ...(backdrop ? [`body::before { content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none; background: ${backdrop}; background-size: cover; background-position: center; }`] : []),
    ...used.map((c) => recipeToCss(c.recipe)),
    `.page-main { ${MAIN} ${mainPadding(mIns)} }`,
    `.page-grid { display: grid; grid-template-columns: repeat(${TIER_COLUMNS.mobile}, 1fr); grid-auto-rows: minmax(80px, auto); gap: ${GAP}px; }`,
    ...(sections.length ? [...SECTION_CSS, `.page-sec { scroll-margin-top: ${mIns.top}px; }`] : []),
    ...(pinned.length ? [`${pinned.map((p) => `.${cls(p)}`).join(', ')} { position: fixed; z-index: 10; box-sizing: border-box; container-type: inline-size; }`] : []),
  ];
  for (const p of cells) css.push(`.${cls(p)} { ${cellCss(p, resolvePlacement(p, 'mobile'), mIns)} }`);
  for (const p of pinned) css.push(`.${cls(p)} { ${pinCss(resolvePlacement(p, 'mobile'), TIER_COLUMNS.mobile)} }`);
  for (const tier of TIER_ORDER.slice(1)) {
    const prev  = TIER_ORDER[TIER_ORDER.indexOf(tier) - 1];
    const minW  = TIERS.find((t) => t.id === tier)!.minWidth;
    const ins = pageInsets(all, tier), insBefore = pageInsets(all, prev);
    const rules = [`  .page-grid { grid-template-columns: repeat(${TIER_COLUMNS[tier]}, 1fr); }`];
    if (mainPadding(ins) !== mainPadding(insBefore)) {
      rules.push(`  .page-main { ${mainPadding(ins)} }`);
      if (sections.length) rules.push(`  .page-sec { scroll-margin-top: ${ins.top}px; }`);
    }
    for (const p of cells) {
      const g = resolvePlacement(p, tier), before = resolvePlacement(p, prev);
      if (g.hidden && before.hidden) continue;
      const now = cellCss(p, g, ins);
      if (now === cellCss(p, before, insBefore) && TIER_COLUMNS[tier] === TIER_COLUMNS[prev]) continue;
      rules.push(`  .${cls(p)} { ${now} }`);
    }
    for (const p of pinned) {
      const now = pinCss(resolvePlacement(p, tier), TIER_COLUMNS[tier]);
      if (now !== pinCss(resolvePlacement(p, prev), TIER_COLUMNS[prev])) rules.push(`  .${cls(p)} { ${now} }`);
    }
    css.push(`@media (min-width: ${minW}px) {`, ...rules, `}`);
  }
  const behaviorKeys = [...behaviorsUsed(used.map((c) => c.recipe)), ...(sections.length ? ['sections'] : [])];
  const sectionsJs = sections.length ? `(${alchemySections.toString()})(${JSON.stringify(grids.map((g) => g.id))});` : '';
  const behaviorJs = [behaviorScript(behaviorKeys.filter((k) => k !== 'sections')), sectionsJs].filter(Boolean).join('\n');
  return { grids, pinned, cls, css, anchors, behaviorKeys, behaviorJs };
}

const tierNote = () => TIER_ORDER.map((t) => `${t} ${TIER_COLUMNS[t]} cols`).join(' / ');

export function generatePageTSX(
  page: PageDef,
  layout: PageLayout,
  components: Record<string, ProjectComponent>,
  theme: Theme,
  meta?: ProjectMeta,
  sections?: PageSection[],   // other pages shown in place (pageSections)
): string {
  const pageName = page.name;
  const { grids, pinned, cls, css, anchors, behaviorKeys, behaviorJs } = pageParts(page, layout, components, theme, meta, sections);

  const cellCode = (p: PagePlacement) => {
    const comp = components[p.componentId];
    return [
      `        {/* ${(p.name ?? comp?.recipe.name ?? `missing: ${p.componentId}`).replace(/\*\//g, '* /')} */}`,
      `        <div className="${cls(p)}">`,
      comp ? recipeToMarkup(comp.recipe, p.props, p.options, '          ', false, page.path, anchors) : `          {/* component not found */}`,
      `        </div>`,
    ].join('\n');
  };
  const gridsCode = grids.map((g) => [
    g.id ? `        <section id="${g.id}" className="page-grid page-sec" aria-label={${JSON.stringify(g.name)}}>` : `        <div className="page-grid">`,
    g.cells.map(cellCode).join('\n').replace(/^/gm, '  ') || `          {/* No components placed */}`,
    g.id ? `        </section>` : `        </div>`,
  ].join('\n')).join('\n');

  const fnName = toVarName(pageName) + 'Page';

  // Behaviors used on this page — each runtime once. The source is embedded as a JSON string
  // (safe to quote), and next/script runs it after hydration and on client-side navigations.

  return [
    `// Generated by Alchemy — ${pageName} (${page.path}) · mobile-first: ${tierNote()}`,
    ``,
    ...(behaviorJs ? [`import Script from 'next/script';`, ``] : []),
    ...metadataLines(page, meta),
    ...(behaviorJs ? [
      `// Behaviors: ${behaviorKeys.join(', ')} — progressive enhancement; the page works without them`,
      `const behaviorsJs = ${JSON.stringify(behaviorJs)};`,
      ``,
    ] : []),
    `const pageCss = \``,
    ...css,
    `\`;`,
    ``,
    `export default function ${fnName}() {`,
    `  return (`,
    `    <>`,
    ...(fontsHref(meta?.fonts) ? [`      <link rel="stylesheet" href=${JSON.stringify(fontsHref(meta?.fonts))} precedence="default" />`] : []),
    `      <style>{pageCss}</style>`,
    `      <main className="page-main">`,
    gridsCode,
    `      </main>`,
    ...(pinned.length ? [`      {/* Pinned to the screen */}`, pinned.map(cellCode).join('\n').replace(/^  /gm, '')] : []),
    ...(behaviorJs ? [`      <Script id="alchemy-behaviors" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: behaviorsJs }} />`] : []),
    `    </>`,
    `  );`,
    `}`,
    ``,
  ].join('\n');
}

// ── Plain HTML: one file a browser opens as is ───────────────────
// The same CSS, markup and behaviors as the TSX, with the head written out as tags and the behaviors in a <script> at
// the end of <body> (they run once the page is parsed). No framework, no build step.

const escText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s: string) => escText(s).replace(/"/g, '&quot;');

export function generatePageHTML(
  page: PageDef,
  layout: PageLayout,
  components: Record<string, ProjectComponent>,
  theme: Theme,
  meta?: ProjectMeta,
  sections?: PageSection[],   // other pages shown in place (pageSections)
): string {
  const { grids, pinned, cls, css, anchors, behaviorKeys, behaviorJs } = pageParts(page, layout, components, theme, meta, sections);
  const head  = page.head ?? {};
  const title = head.title?.trim() || (meta?.headTitle?.trim() ? `${page.name} — ${meta.headTitle.trim()}` : page.name);
  const desc  = head.description?.trim() || meta?.headDescription?.trim() || '';
  const og    = head.ogImage?.trim();
  const fonts = fontsHref(meta?.fonts);
  const cellHtml = (p: PagePlacement) => {
    const comp = components[p.componentId];
    return [
      `      <!-- ${escText(p.name ?? comp?.recipe.name ?? `missing: ${p.componentId}`).replace(/--/g, '- -')} -->`,
      `      <div class="${cls(p)}">`,
      comp ? recipeToMarkup(comp.recipe, p.props, p.options, '        ', true, page.path, anchors) : `        <!-- component not found -->`,
      `      </div>`,
    ].join('\n');
  };
  const gridsHtml = grids.map((g) => [
    g.id ? `    <section id="${g.id}" class="page-grid page-sec" aria-label="${escAttr(g.name)}">` : `    <div class="page-grid">`,
    g.cells.map(cellHtml).join('\n') || `      <!-- No components placed -->`,
    g.id ? `    </section>` : `    </div>`,
  ].join('\n')).join('\n');
  return [
    `<!doctype html>`,
    `<!-- Generated by Alchemy — ${escText(page.name)} (${escText(page.path)}) · mobile-first: ${tierNote()} -->`,
    `<html lang="en">`,
    `<head>`,
    `  <meta charset="utf-8">`,
    `  <meta name="viewport" content="width=device-width, initial-scale=1">`,
    `  <title>${escText(title)}</title>`,
    ...(desc ? [`  <meta name="description" content="${escAttr(desc)}">`] : []),
    ...(og ? [`  <meta property="og:image" content="${escAttr(og)}">`] : []),
    ...(head.noindex ? [`  <meta name="robots" content="noindex, nofollow">`] : []),
    ...(fonts ? [
      `  <link rel="preconnect" href="https://fonts.googleapis.com">`,
      `  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
      `  <link rel="stylesheet" href="${escAttr(fonts)}">`,
    ] : []),
    `  <style>`,
    ...css,
    `  </style>`,
    `</head>`,
    `<body>`,
    `  <main class="page-main">`,
    gridsHtml,
    `  </main>`,
    ...(pinned.length ? [`  <!-- Pinned to the screen -->`, pinned.map(cellHtml).join('\n').replace(/^    /gm, '')] : []),
    ...(behaviorJs ? [
      `  <!-- Behaviors: ${behaviorKeys.join(', ')} — progressive enhancement; the page works without them -->`,
      `  <script>`,
      behaviorJs.replace(/<\/script/gi, '<\\/script'),
      `  </script>`,
    ] : []),
    `</body>`,
    `</html>`,
    ``,
  ].join('\n');
}
