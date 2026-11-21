import { PageLayout, PagePlacement, PageDef, PageSection, ProjectMeta, PlacementGeom, Insets, getActivePlacements, resolvePlacement, pageInsets, isGroup, componentOf, nest, placedAt, pageRow, ROW_HEIGHT, pinStyle, boundedMax, safeBackdrop, GRID_GAP, liveBackdrop, type LiveBackdrop } from '../project';
import { TIERS, TIER_ORDER, TIER_COLUMNS, type Tier } from '../devices';
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
// Rows are at least ROW_HEIGHT and grow to their content. A group is a grid inside its cell: its container's columns
// (subgrid, so it lines up with the page) and its own rows.

const GAP = GRID_GAP;
const MAIN = 'max-width: 1440px; margin: 0 auto; box-sizing: border-box; container-type: inline-size;';
const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

// A grid cell at one tier; a bounded one scrolls inside, no taller than the screen between the kept-clear edges
function cellCss(p: PagePlacement, g: PlacementGeom, ins: Insets, top = g.row): string {   // top: its row on the page's grid (pageRow)
  if (g.hidden) return 'display: none;';
  const bound = p.bounded ? ` max-height: ${boundedMax(top, ins, GAP)}; overflow-y: auto; overscroll-behavior: contain; align-self: start;` : '';
  const display = isGroup(p) ? `display: grid; grid-template-columns: subgrid; grid-auto-rows: minmax(${ROW_HEIGHT}px, auto); row-gap: ${GAP}px; align-content: start;` : 'display: block;';
  return `grid-column: ${g.col + 1} / span ${g.colSpan}; grid-row: ${g.row + 1} / span ${g.rowSpan}; ${display}${bound}`;
}

// A pinned block at one tier: its spot (every side reset first, so a spot moved on a wider tier leaves nothing behind)
function pinCss(g: PlacementGeom, cols: number): string {
  if (g.hidden || !g.pin) return 'display: none;';
  const spot = Object.entries(pinStyle(g.pin, g.colSpan, cols)).map(([k, v]) => `${kebab(k)}: ${v};`).join(' ');
  return `display: block; top: auto; right: auto; bottom: auto; left: auto; width: auto; ${spot}`;
}

const mainPadding = (ins: Insets) => `padding: ${ins.top}px ${GAP + ins.right}px ${ins.bottom}px ${GAP + ins.left}px;`;

// One grid of the page: the page's own, or a section shown in place (id = its #hash; null = a page without sections)
interface Grid { id: string | null; name: string; all: PagePlacement[] }   // every block on it, groups' insides too (nest walks them)

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

// Marks the rail link of the section showing (aria-current="page") as the hash changes, and steps between sections:
// arrow keys and PageUp/Down, one wheel gesture, a vertical swipe. Each step sets the hash, so back/forward and links
// work the same ([data-own-swipe]: a control that takes drags, the orb stick). A step waits while what's under the pointer (or the page) can still scroll that way, and keys leave
// fields, tab rows, menus and sliders alone. Self-contained: its source is copied into the page. Without it, sections
// still switch by link; only the current-link styling and the stepping wait.
function alchemySections(ids: string[]) {
  const current = () => { const h = location.hash.slice(1); return ids.indexOf(h) >= 0 ? h : ids[0]; };
  const mark = () => {
    const on = current();
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      const to = (a.getAttribute('href') || '').slice(1);
      if (ids.indexOf(to) < 0) return;
      if (to === on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  };
  const step = (d: number) => {
    const j = ids.indexOf(current()) + d;
    if (j >= 0 && j < ids.length) location.hash = ids[j];
  };
  // Whether something from `el` up (the page last) still has room to scroll toward d (+1 down / -1 up)
  const canScroll = (el: Element | null, d: number): boolean => {
    const page = document.scrollingElement || document.documentElement;
    for (let n = el; n && n !== page; n = n.parentElement) {
      const o = getComputedStyle(n).overflowY;
      if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 1 && (d > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0)) return true;
    }
    return d > 0 ? page.scrollTop + page.clientHeight < page.scrollHeight - 1 : page.scrollTop > 0;
  };
  const OWN_KEYS = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="tablist"], [role="listbox"], [role="menu"], [role="slider"], [role="grid"], [data-keys]';
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t && t.closest(OWN_KEYS)) return;
    const d = e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key.indexOf('Page') === 0) && canScroll(t, d)) return;
    e.preventDefault();
    step(d);
  };
  // One wheel gesture = one step: after a step, the wheel stays quiet until it has been still for 250ms (trackpads coast)
  let locked = false, quiet = 0, acc = 0;
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    clearTimeout(quiet);
    quiet = window.setTimeout(() => { locked = false; acc = 0; }, 250);
    const d = e.deltaY > 0 ? 1 : -1;
    if (locked) return;
    if (canScroll(e.target instanceof Element ? e.target : null, d)) { locked = true; return; }   // this gesture scrolls; the next one may step
    acc += e.deltaY;
    if (Math.abs(acc) < 40) return;
    locked = true; acc = 0;
    step(d);
  };
  // A swipe steps only if, when it started, nothing could scroll its way (a swipe that scrolls to the end doesn't step)
  let touch: { x: number; y: number; t: Element | null; up: boolean; down: boolean } | null = null;
  const onTouchStart = (e: TouchEvent) => {
    const t = e.target instanceof Element ? e.target : null;
    touch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t, up: canScroll(t, -1), down: canScroll(t, 1) } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (!touch || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - touch.x, dy = touch.y - e.changedTouches[0].clientY, d = dy > 0 ? 1 : -1, t = touch.t;
    const could = d > 0 ? touch.down : touch.up;
    touch = null;
    if (Math.abs(dy) < 60 || Math.abs(dy) < Math.abs(dx) * 1.5 || (t && t.closest(OWN_KEYS + ', [data-own-swipe]')) || could) return;
    step(d);
  };
  window.addEventListener('hashchange', mark);
  document.addEventListener('keydown', onKey);
  window.addEventListener('wheel', onWheel, { passive: true });
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  mark();
}

// What both outputs share: the components used, the CSS (theme, backdrop, components, the grids and pins per tier),
// the grids and the pinned blocks, the links that stay on the page, the script (behaviors, sections)
function pageParts(page: PageDef, layout: PageLayout, components: Record<string, ProjectComponent>, theme: Theme, meta?: ProjectMeta, sections: PageSection[] = []) {
  const all      = getActivePlacements(layout);
  // A section's own pinned blocks come along, shown only while it is (secPins); the page's show throughout. One of a
  // component the page pins itself stays behind (each section page's own rail: the page's rail serves them all)
  const ownPinned = new Set(all.filter((p) => p.pin).map((p) => p.componentId));
  const secPins  = sections.flatMap((s) => getActivePlacements(s.layout).filter((p) => p.pin && !ownPinned.has(p.componentId)).map((p) => [p, s.id] as const));
  const pinned   = [...all.filter((p) => p.pin), ...secPins.map(([p]) => p)];
  const grid     = (id: string | null, name: string, ps: PagePlacement[]): Grid => ({ id, name, all: ps.filter((p) => !p.pin) });
  const grids: Grid[] = !sections.length ? [grid(null, page.name, all)] : [
    ...(all.some((p) => !p.pin) ? [grid('top', page.name, all)] : []),
    ...sections.map((s) => grid(s.id, s.name, getActivePlacements(s.layout))),
  ];
  const owner    = new Map<PagePlacement, string | null>([...grids.flatMap((g) => g.all.map((p) => [p, g.id] as const)), ...secPins]);
  const cls      = (p: PagePlacement) => `${owner.get(p) ? `${owner.get(p)}--` : ''}p-${p.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const cells    = grids.flatMap((g) => g.all);
  const used     = Array.from(new Set([...pinned, ...cells].filter((p) => !isGroup(p)).map((p) => p.componentId))).map((id) => components[id]).filter(Boolean);
  const backdrop = safeBackdrop(page.backdrop) ?? safeBackdrop(meta?.backdrop);
  const live     = liveBackdrop(page, meta);
  const anchors  = Object.fromEntries(sections.map((s) => [s.path, `#${s.id}`]));

  // CSS — theme, backdrop, components, then the page per tier: mobile base + what changes at each wider tier
  const mIns = pageInsets(all, 'mobile');
  const css: string[] = [
    themeToCss(theme),
    `body { margin: 0; background: var(--color-bg); color: var(--color-text); font-family: var(--font-sans); }`,
    ...(backdrop ? [`body::before { content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none; background: ${backdrop}; background-size: cover; background-position: center; }`] : []),
    ...(live ? [`.page-live { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden;${live.kind === 'video' ? ' width: 100%; height: 100%; object-fit: cover;' : ''} }`] : []),
    ...used.map((c) => recipeToCss(c.recipe)),
    `.page-main { ${MAIN} ${mainPadding(mIns)} }`,
    `.page-grid { display: grid; grid-template-columns: repeat(${TIER_COLUMNS.mobile}, 1fr); grid-auto-rows: minmax(${ROW_HEIGHT}px, auto); gap: ${GAP}px; }`,
    ...(sections.length ? [...SECTION_CSS, `.page-sec { scroll-margin-top: ${mIns.top}px; }`] : []),
    ...(pinned.length ? [`${pinned.map((p) => `.${cls(p)}`).join(', ')} { position: fixed; z-index: 10; box-sizing: border-box; container-type: inline-size; }`] : []),
    // A section's pins hide while another section shows (the first shows with no hash)
    ...secPins.map(([p, id]) => id === grids.find((g) => g.id)?.id
      ? `.page-main:has(> .page-sec:target:not(#${id})) ~ .${cls(p)} { display: none !important; }`
      : `.page-main:not(:has(> #${id}:target)) ~ .${cls(p)} { display: none !important; }`),
    `:root { --tier: 0; }`,   // 0 phone, 1 tablet, 2 desktop: a value can step per tier, calc(136px + 32px * var(--tier, 0))
  ];
  // A block at a tier inside its grid (kept within a group's columns), and its row on the page for a scroll cap
  const listOf = new Map(grids.flatMap((g) => g.all.map((p) => [p, g.all] as const)));
  const at = (p: PagePlacement, tier: Tier) => placedAt(listOf.get(p)!, p, tier), top = (p: PagePlacement, tier: Tier) => pageRow(listOf.get(p)!, p, tier);
  for (const p of cells) css.push(`.${cls(p)} { ${cellCss(p, at(p, 'mobile'), mIns, top(p, 'mobile'))} }`);
  for (const p of pinned) css.push(`.${cls(p)} { ${pinCss(resolvePlacement(p, 'mobile'), TIER_COLUMNS.mobile)} }`);
  for (const tier of TIER_ORDER.slice(1)) {
    const prev  = TIER_ORDER[TIER_ORDER.indexOf(tier) - 1];
    const minW  = TIERS.find((t) => t.id === tier)!.minWidth;
    const ins = pageInsets(all, tier), insBefore = pageInsets(all, prev);
    const rules = [`  :root { --tier: ${TIER_ORDER.indexOf(tier)}; }`, `  .page-grid { grid-template-columns: repeat(${TIER_COLUMNS[tier]}, 1fr); }`];
    if (mainPadding(ins) !== mainPadding(insBefore)) {
      rules.push(`  .page-main { ${mainPadding(ins)} }`);
      if (sections.length) rules.push(`  .page-sec { scroll-margin-top: ${ins.top}px; }`);
    }
    for (const p of cells) {
      const g = at(p, tier), before = at(p, prev);
      if (g.hidden && before.hidden) continue;
      const now = cellCss(p, g, ins, top(p, tier));
      if (now === cellCss(p, before, insBefore, top(p, prev)) && TIER_COLUMNS[tier] === TIER_COLUMNS[prev]) continue;
      rules.push(`  .${cls(p)} { ${now} }`);
    }
    for (const p of pinned) {
      const now = pinCss(resolvePlacement(p, tier), TIER_COLUMNS[tier]);
      if (now !== pinCss(resolvePlacement(p, prev), TIER_COLUMNS[prev])) rules.push(`  .${cls(p)} { ${now} }`);
    }
    css.push(`@media (min-width: ${minW}px) {`, ...rules, `}`);
  }
  const behaviorKeys = [...(live ? ['backdrop'] : []), ...behaviorsUsed(used.map((c) => c.recipe)), ...(sections.length ? ['sections'] : [])];
  const sectionsJs = sections.length ? `(${alchemySections.toString()})(${JSON.stringify(grids.map((g) => g.id))});` : '';
  const behaviorJs = [behaviorScript(behaviorKeys.filter((k) => k !== 'sections')), sectionsJs].filter(Boolean).join('\n');
  const secOf = (p: PagePlacement) => secPins.find(([q]) => q === p)?.[1];   // a section's pinned block: that section's id
  return { grids, pinned, cls, secOf, css, anchors, behaviorKeys, behaviorJs, live };
}

// The live backdrop's element: its settings as attributes (already made safe by liveBackdrop). A video ships without
// autoplay, so without the script (or when calm) its poster stays.
function liveAttrs(l: LiveBackdrop): [string, string][] {
  if (l.kind === 'video') return [['src', l.src!], ...(l.poster ? [['poster', l.poster] as [string, string]] : []), ['preload', 'metadata']];
  return [...(l.colors ? [['data-colors', l.colors] as [string, string]] : []), ...(l.stars !== undefined ? [['data-stars', String(l.stars)] as [string, string]] : []), ...(l.speed !== undefined ? [['data-speed', String(l.speed)] as [string, string]] : [])];
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
  const { grids, pinned, cls, secOf, css, anchors, behaviorKeys, behaviorJs, live } = pageParts(page, layout, components, theme, meta, sections);

  // A block; a group's blocks (already written) go inside it, a level deeper
  const cellCode = (p: PagePlacement, kids: string[] = []): string => {
    const comp = componentOf(components, p);
    const inner = isGroup(p) ? kids.join('\n').replace(/^/gm, '  ') || `          {/* empty group */}`
      : comp ? recipeToMarkup(comp.recipe, p.props, p.options, '          ', false, page.path, anchors) : `          {/* component not found */}`;
    return [
      `        {/* ${(p.name ?? (isGroup(p) ? 'Group' : comp?.recipe.name) ?? `missing: ${p.componentId}`).replace(/\*\//g, '* /')} */}`,
      `        <div className="${cls(p)}"${secOf(p) ? ` data-sec="${secOf(p)}"` : ''}>`,
      inner,
      `        </div>`,
    ].join('\n');
  };
  const gridsCode = grids.map((g) => [
    g.id ? `        <section id="${g.id}" className="page-grid page-sec" aria-label={${JSON.stringify(g.name)}}>` : `        <div className="page-grid">`,
    nest(g.all, cellCode).join('\n').replace(/^/gm, '  ') || `          {/* No components placed */}`,
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
    ...(live ? [live.kind === 'video'
      ? `      <video className="page-live" aria-hidden="true" data-behavior="backdrop" muted loop playsInline ${liveAttrs(live).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')} />`
      : `      <div className="page-live" aria-hidden="true" data-behavior="backdrop"${liveAttrs(live).map(([k, v]) => ` ${k}=${JSON.stringify(v)}`).join('')} />`] : []),
    `      <main className="page-main">`,
    gridsCode,
    `      </main>`,
    ...(pinned.length ? [`      {/* Pinned to the screen */}`, pinned.map((p) => cellCode(p)).join('\n').replace(/^  /gm, '')] : []),
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
  const { grids, pinned, cls, secOf, css, anchors, behaviorKeys, behaviorJs, live } = pageParts(page, layout, components, theme, meta, sections);
  const head  = page.head ?? {};
  const title = head.title?.trim() || (meta?.headTitle?.trim() ? `${page.name} — ${meta.headTitle.trim()}` : page.name);
  const desc  = head.description?.trim() || meta?.headDescription?.trim() || '';
  const og    = head.ogImage?.trim();
  const fonts = fontsHref(meta?.fonts);
  const cellHtml = (p: PagePlacement, kids: string[] = []): string => {
    const comp = componentOf(components, p);
    const inner = isGroup(p) ? kids.join('\n').replace(/^/gm, '  ') || `        <!-- empty group -->`
      : comp ? recipeToMarkup(comp.recipe, p.props, p.options, '        ', true, page.path, anchors) : `        <!-- component not found -->`;
    return [
      `      <!-- ${escText(p.name ?? (isGroup(p) ? 'Group' : comp?.recipe.name) ?? `missing: ${p.componentId}`).replace(/--/g, '- -')} -->`,
      `      <div class="${cls(p)}"${secOf(p) ? ` data-sec="${secOf(p)}"` : ''}>`,
      inner,
      `      </div>`,
    ].join('\n');
  };
  const gridsHtml = grids.map((g) => [
    g.id ? `    <section id="${g.id}" class="page-grid page-sec" aria-label="${escAttr(g.name)}">` : `    <div class="page-grid">`,
    nest(g.all, cellHtml).join('\n') || `      <!-- No components placed -->`,
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
    ...(live ? [live.kind === 'video'
      ? `  <video class="page-live" aria-hidden="true" data-behavior="backdrop" muted loop playsinline ${liveAttrs(live).map(([k, v]) => `${k}="${escAttr(v)}"`).join(' ')}></video>`
      : `  <div class="page-live" aria-hidden="true" data-behavior="backdrop"${liveAttrs(live).map(([k, v]) => ` ${k}="${escAttr(v)}"`).join('')}></div>`] : []),
    `  <main class="page-main">`,
    gridsHtml,
    `  </main>`,
    ...(pinned.length ? [`  <!-- Pinned to the screen -->`, pinned.map((p) => cellHtml(p)).join('\n').replace(/^    /gm, '')] : []),
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
