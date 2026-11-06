import { PageLayout, PagePlacement, PageDef, ProjectMeta, PlacementGeom, getActivePlacements, resolvePlacement } from '../project';
import { TIERS, TIER_ORDER, TIER_COLUMNS } from '../devices';
import { ProjectComponent, Theme, themeToCss, recipeToCss, recipeToMarkup, behaviorsUsed, behaviorScript } from '../library';

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

function geomCss(g: PlacementGeom): string {
  if (g.hidden) return 'display: none;';
  return `grid-column: ${g.col + 1} / span ${g.colSpan}; grid-row: ${g.row + 1} / span ${g.rowSpan}; display: block;`;
}

const sameGeom = (a: PlacementGeom, b: PlacementGeom) =>
  a.col === b.col && a.row === b.row && a.colSpan === b.colSpan && a.rowSpan === b.rowSpan && !!a.hidden === !!b.hidden;

// What both outputs share: the components used, the CSS (theme, components, the grid per tier), the cells, the behaviors
function pageParts(layout: PageLayout, components: Record<string, ProjectComponent>, theme: Theme) {
  const cells    = getActivePlacements(layout).sort((a, b) => a.row - b.row || a.col - b.col);
  const cls      = (p: PagePlacement) => `p-${p.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const used     = Array.from(new Set(cells.map((p) => p.componentId))).map((id) => components[id]).filter(Boolean);

  // CSS — theme, components, then the grid: mobile base + per-tier deltas
  const css: string[] = [
    themeToCss(theme),
    `body { margin: 0; background: var(--color-bg); color: var(--color-text); font-family: var(--font-sans); }`,
    ...used.map((c) => recipeToCss(c.recipe)),
    `.page-grid { display: grid; grid-template-columns: repeat(${TIER_COLUMNS.mobile}, 1fr); grid-auto-rows: minmax(80px, auto); gap: ${GAP}px; }`,
  ];
  for (const p of cells) css.push(`.${cls(p)} { ${geomCss(resolvePlacement(p, 'mobile'))} }`);
  for (const tier of TIER_ORDER.slice(1)) {
    const prev  = TIER_ORDER[TIER_ORDER.indexOf(tier) - 1];
    const minW  = TIERS.find((t) => t.id === tier)!.minWidth;
    const rules = [`  .page-grid { grid-template-columns: repeat(${TIER_COLUMNS[tier]}, 1fr); }`];
    for (const p of cells) {
      const g = resolvePlacement(p, tier);
      const before = resolvePlacement(p, prev);
      if (g.hidden && before.hidden) continue;
      if (sameGeom(g, before) && TIER_COLUMNS[tier] === TIER_COLUMNS[prev]) continue;
      rules.push(`  .${cls(p)} { ${geomCss(g)} }`);
    }
    css.push(`@media (min-width: ${minW}px) {`, ...rules, `}`);
  }
  const behaviorKeys = behaviorsUsed(used.map((c) => c.recipe));
  return { cells, cls, css, behaviorKeys, behaviorJs: behaviorScript(behaviorKeys) };
}

const tierNote = () => TIER_ORDER.map((t) => `${t} ${TIER_COLUMNS[t]} cols`).join(' / ');

export function generatePageTSX(
  page: PageDef,
  layout: PageLayout,
  components: Record<string, ProjectComponent>,
  theme: Theme,
  meta?: ProjectMeta,
): string {
  const pageName = page.name;
  const { cells, cls, css, behaviorKeys, behaviorJs } = pageParts(layout, components, theme);

  const cellsCode = cells.map((p) => {
    const comp = components[p.componentId];
    return [
      `        {/* ${p.name ?? comp?.recipe.name ?? `missing: ${p.componentId}`} */}`,
      `        <div className="${cls(p)}">`,
      comp ? recipeToMarkup(comp.recipe, p.props, p.options, '          ') : `          {/* component not found */}`,
      `        </div>`,
    ].join('\n');
  }).join('\n');

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
    `      <style>{pageCss}</style>`,
    `      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 16px', containerType: 'inline-size' }}>`,
    `        <div className="page-grid">`,
    cellsCode.replace(/^/gm, '  ') || `          {/* No components placed */}`,
    `        </div>`,
    `      </main>`,
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
): string {
  const { cells, cls, css, behaviorKeys, behaviorJs } = pageParts(layout, components, theme);
  const head  = page.head ?? {};
  const title = head.title?.trim() || (meta?.headTitle?.trim() ? `${page.name} — ${meta.headTitle.trim()}` : page.name);
  const desc  = head.description?.trim() || meta?.headDescription?.trim() || '';
  const og    = head.ogImage?.trim();
  const cellsHtml = cells.map((p) => {
    const comp = components[p.componentId];
    return [
      `      <!-- ${escText(p.name ?? comp?.recipe.name ?? `missing: ${p.componentId}`)} -->`,
      `      <div class="${cls(p)}">`,
      comp ? recipeToMarkup(comp.recipe, p.props, p.options, '        ', true) : `        <!-- component not found -->`,
      `      </div>`,
    ].join('\n');
  }).join('\n');
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
    `  <style>`,
    ...css,
    `  </style>`,
    `</head>`,
    `<body>`,
    `  <main style="max-width: 1440px; margin: 0 auto; padding: 0 16px; container-type: inline-size">`,
    `    <div class="page-grid">`,
    cellsHtml || `      <!-- No components placed -->`,
    `    </div>`,
    `  </main>`,
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
