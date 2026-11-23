import { Recipe, Part, Style, StateName, PartStyles, walkParts, widthKeys } from './recipe';
import { Theme, isTokenRef, tokenName } from './theme';
import { TIERS } from '../devices';

// ── CSS generator — recipe + theme → plain, native CSS ───────────
// The first output target for the recipe format, and the proof it's generator-neutral: tokens
// become CSS variables, variants become [data-*] attribute selectors, states become native
// pseudo-classes (:hover, :focus-visible, :disabled, [open] …). No framework, no JavaScript.
//
//   <button class="al-button" data-variant="primary" data-size="md">…</button>

const UNITLESS = new Set(['opacity', 'scale', 'fontWeight', 'lineHeight', 'zIndex']);
const FOCUSABLE = new Set(['button', 'link', 'input', 'textarea', 'checkbox', 'radio', 'select']);

const cssVar = (name: string) => `--${name.replace(/\./g, '-')}`;

// Browser defaults that would fight the recipe (list bullets, link underline, details marker…)
const KIND_RESETS: Partial<Record<Part['kind'], string[]>> = {
  text:    ['margin: 0;'],
  heading: ['margin: 0;'],
  list:    ['list-style: none;', 'margin: 0;', 'padding: 0;'],
  item:    ['margin: 0;'],
  link:    ['text-decoration: none;', 'color: inherit;'],
  summary: ['list-style: none;', 'cursor: pointer;'],
};

const PART_PSEUDO: Record<StateName, string> = {
  hover: ':hover', press: ':active', focus: ':focus-visible', disabled: ':disabled',
  checked: ':checked', open: '[open]', invalid: '[aria-invalid="true"]', current: '[aria-current]:not([aria-current="false"])', selected: '[aria-selected="true"]', alive: '[data-alive]',
};

export function themeToCss(theme: Theme, selector = ':root'): string {
  const lines = Object.entries(theme.tokens).map(([k, v]) => `  ${cssVar(k)}: ${v};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

function val(key: string, v: string | number): string {
  if (isTokenRef(v)) return `var(${cssVar(tokenName(v))})`;
  if (typeof v === 'number') return UNITLESS.has(key) ? String(v) : `${v}px`;
  return v;
}

const FLEX = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', between: 'space-between' } as const;
const SIZE = (v: string | number, key: string) => (v === 'fill' ? '100%' : v === 'hug' ? 'fit-content' : val(key, v));

function declarations(s: Style): string[] {
  const d: string[] = [];
  const put = (prop: string, key: keyof Style) => { const v = s[key]; if (v !== undefined) d.push(`${prop}: ${val(key, v as string | number)};`); };

  if (s.layout)  d.push(`display: ${s.layout === 'inline' ? 'inline-flex' : 'flex'};`, `flex-direction: ${s.layout === 'column' ? 'column' : 'row'};`);
  if (s.align)   d.push(`align-items: ${FLEX[s.align]};`);
  if (s.justify) d.push(`justify-content: ${FLEX[s.justify]};`);
  put('gap', 'gap'); put('padding', 'padding'); put('padding-inline', 'paddingX'); put('padding-block', 'paddingY');
  if (s.width  !== undefined) d.push(`width: ${SIZE(s.width, 'width')};`);
  if (s.height !== undefined) d.push(`height: ${SIZE(s.height, 'height')};`);
  put('min-width', 'minWidth'); put('min-height', 'minHeight'); put('max-width', 'maxWidth');
  put('background', 'background'); put('color', 'color');
  if (s.borderWidth !== undefined || s.borderStyle) d.push(`border-style: ${s.borderStyle ?? 'solid'};`);
  put('border-width', 'borderWidth'); put('border-color', 'borderColor');
  put('border-radius', 'radius'); put('box-shadow', 'shadow');
  put('font-family', 'font'); put('font-size', 'fontSize'); put('font-weight', 'fontWeight');
  put('letter-spacing', 'letterSpacing'); put('line-height', 'lineHeight');
  if (s.textAlign) d.push(`text-align: ${s.textAlign};`);
  if (s.textTransform) d.push(`text-transform: ${s.textTransform};`);
  if (s.backdropBlur !== undefined) {
    const f = `blur(${val('backdropBlur', s.backdropBlur)})`;
    d.push(`-webkit-backdrop-filter: ${f};`, `backdrop-filter: ${f};`);
  }
  put('opacity', 'opacity');
  if (s.scale !== undefined) d.push(`transform: scale(${s.scale});`);
  if (s.outlineWidth !== undefined || s.outlineColor !== undefined) {
    d.push(`outline: ${val('outlineWidth', s.outlineWidth ?? 2)} solid ${val('outlineColor', s.outlineColor ?? 'currentColor')};`);
  }
  put('outline-offset', 'outlineOffset');
  if (s.cursor)   d.push(`cursor: ${s.cursor};`);
  if (s.overflow) d.push(`overflow: ${s.overflow};`);
  if (s.position) d.push(`position: ${s.position};`);
  else if (s.ticks !== undefined) d.push('position: relative;');   // the ticks are placed against it
  put('top', 'top'); put('right', 'right'); put('bottom', 'bottom'); put('left', 'left'); put('z-index', 'zIndex');
  if (s.scroll) {
    d.push('overflow-x: auto;', 'overflow-y: hidden;', 'overscroll-behavior-x: contain;');
    if (s.scroll === 'x-snap') d.push('scroll-snap-type: x mandatory;', 'scroll-behavior: smooth;');
  }
  if (s.scrollbar) d.push(`scrollbar-width: ${s.scrollbar === 'hidden' ? 'none' : 'thin'};`);
  if (s.snapAlign) d.push(`scroll-snap-align: ${s.snapAlign};`);
  if (s.basis !== undefined) d.push(`flex: 0 0 ${val('basis', s.basis)};`);
  if (s.aspect)    d.push(`aspect-ratio: ${s.aspect};`);
  if (s.objectFit) d.push(`object-fit: ${s.objectFit};`, 'display: block;');
  if (s.hide === true) d.push('display: none;');
  return d;
}

const rule = (selector: string, decls: string[]) =>
  decls.length ? `${selector} {\n${decls.map((l) => `  ${l}`).join('\n')}\n}` : '';

// Corner ticks: one ::before over the part, an L of two 2px bars in each corner. A pseudo-element, so a variant's
// `background` can't wipe them; inside the edge, so the part's overflow: hidden can't clip them.
function ticksRule(selector: string, s: Style): string {
  if (s.ticks === undefined && s.tickColor === undefined) return '';
  const L = val('ticks', s.ticks ?? 12), c = val('tickColor', s.tickColor ?? 'currentColor'), bar = `linear-gradient(${c}, ${c})`;
  const corners = ['top left', 'top right', 'bottom left', 'bottom right'];
  const layers = corners.flatMap((at) => [`${bar} ${at} / ${L} 2px no-repeat`, `${bar} ${at} / 2px ${L} no-repeat`]);
  return rule(`${selector}::before`, ['content: "";', 'position: absolute;', 'inset: 0;', 'pointer-events: none;', `background: ${layers.join(', ')};`]);
}
// A style's rules under one selector: its declarations, and its ticks
const styleRules = (selector: string, s: Style) => [rule(selector, declarations(s)), ticksRule(selector, s)];

export const rootClass = (r: Recipe) => `al-${r.key}`;
export const partClass = (r: Recipe, partId: string) => (partId === r.anatomy.id ? rootClass(r) : `${rootClass(r)}__${partId}`);

// Native pseudo-class on the root for each state. Containers (non-focusable roots) react to
// their contents: focus-within, or a data-/aria- attribute the markup sets.
function stateSelector(r: Recipe, state: StateName, root = `.${rootClass(r)}`): string {
  const focusable = FOCUSABLE.has(r.anatomy.kind);
  switch (state) {
    case 'hover':    return focusable ? `${root}:hover:not(:disabled)`  : `${root}:hover`;
    case 'press':    return focusable ? `${root}:active:not(:disabled)` : `${root}:active`;
    case 'focus':    return focusable ? `${root}:focus-visible` : `${root}:focus-within`;
    case 'disabled': return focusable ? `${root}:disabled` : `${root}[data-disabled]`;
    case 'checked':  return focusable ? `${root}:checked`  : `${root}:has(:checked)`;
    case 'open':     return `${root}[open]`;
    case 'invalid':  return focusable ? `${root}[aria-invalid="true"]` : `${root}[data-invalid]`;
    case 'current':  return `${root}[aria-current]:not([aria-current="false"])`;
    case 'selected': return `${root}[aria-selected="true"]`;
    case 'alive':    return `${root}[data-alive]`;
  }
}

// `scope` is a selector that matches the root in some condition; returns rules for each part under it
function partRules(r: Recipe, scope: string, styles: PartStyles): string[] {
  return Object.entries(styles).flatMap(([partId, style]) =>
    styleRules(partId === r.anatomy.id ? scope : `${scope} .${partClass(r, partId)}`, style));
}

// `scope` prefixes every selector (e.g. ".al-theme-projA") so two projects' copies of the same
// recipe can coexist on one page — the Workbench shows several projects at once. Exported code
// for a single project passes no scope.
export function recipeToCss(r: Recipe, scope = ''): string {
  const css = recipeRules(r);
  if (!scope) return css;
  return css.replace(/^(\s*)(\.al-)/gm, `$1${scope} $2`);
}

function recipeRules(r: Recipe): string {
  const out: string[] = [`/* ${r.name} — ${r.description} */`];
  const root = `.${rootClass(r)}`;

  // Base: every part
  walkParts(r.anatomy, (p: Part) => {
    // Native-element resets first, so the recipe's own style can override them
    const resets = ['box-sizing: border-box;', ...(KIND_RESETS[p.kind] ?? [])];
    const base = [...resets, ...declarations(p.style ?? {})];
    if (r.transition && (p.id === r.anatomy.id || p.states)) {
      base.push(`transition: all ${val('duration', r.transition.duration)} ${val('ease', r.transition.ease)};`);
    }
    out.push(rule(`.${partClass(r, p.id)}`, base), ticksRule(`.${partClass(r, p.id)}`, p.style ?? {}));
    if (p.kind === 'summary') out.push(rule(`.${partClass(r, p.id)}::-webkit-details-marker`, ['display: none;']));
  });

  // `hidden` parts (untilReady controls) stay hidden even though their own rules set display
  out.push(rule(`${root} [hidden]`, ['display: none !important;']));

  // Variants — [data-axis="option"] on the root
  for (const axis of r.variants) {
    for (const [option, styles] of Object.entries(axis.options)) {
      out.push(...partRules(r, `${root}[data-${axis.name}="${option}"]`, styles));
    }
  }

  // Responsive — mobile-first: base is phone, then min-width blocks per wider tier.
  // CONTAINER queries, not media queries: a component responds to the width it's given, so an
  // iPhone-sized preview inside a wide editor window still shows the phone layout. Pages (and
  // the workbench previews) mark their content area `container-type: inline-size`.
  const steps = [...(TIERS.slice(1) as { id: 'tablet' | 'desktop'; minWidth: number }[]),
    ...widthKeys(r).map((k) => ({ id: k, minWidth: Number(k) }))].sort((a, b) => a.minWidth - b.minWidth);
  for (const t of steps) {
    const styles = r.responsive?.[t.id];
    if (!styles || !Object.keys(styles).length) continue;
    const inner = partRules(r, root, styles).filter(Boolean).map((x) => x.replace(/^/gm, '  '));
    if (inner.length) out.push(`@container (min-width: ${t.minWidth}px) {\n${inner.join('\n')}\n}`);
  }

  // States — after variants so they win
  for (const [state, styles] of Object.entries(r.states) as [StateName, PartStyles][]) {
    out.push(...partRules(r, stateSelector(r, state), styles));
  }

  // An option's own states — after the shared ones, and one attribute more specific, so they win
  for (const axis of r.variants) {
    for (const [option, states] of Object.entries(axis.states ?? {})) {
      for (const [state, styles] of Object.entries(states) as [StateName, PartStyles][]) {
        out.push(...partRules(r, stateSelector(r, state, `${root}[data-${axis.name}="${option}"]`), styles));
      }
    }
  }

  // Part-level states — a part reacting to itself (a nav link's own hover)
  walkParts(r.anatomy, (p: Part) => {
    for (const [state, style] of Object.entries(p.states ?? {}) as [StateName, Style][]) {
      out.push(...styleRules(`.${partClass(r, p.id)}${PART_PSEUDO[state]}`, style));
    }
  });

  // Calm (prefers-reduced-motion): state changes fade colors and opacity only, nothing moves or scales; tracks jump
  const moving: string[] = [], tracks: string[] = [];
  walkParts(r.anatomy, (p: Part) => {
    if (r.transition && (p.id === r.anatomy.id || p.states)) moving.push(`.${partClass(r, p.id)}`);
    if (p.style?.scroll === 'x-snap') tracks.push(`.${partClass(r, p.id)}`);
  });
  const calm = [
    rule(moving.join(',\n'), ['transition-property: color, background-color, border-color, outline-color, box-shadow, opacity;']),
    rule(tracks.join(',\n'), ['scroll-behavior: auto;']),
  ].filter(Boolean);
  if (calm.length) out.push(`@media (prefers-reduced-motion: reduce) {\n${calm.join('\n').replace(/^/gm, '  ')}\n}`);

  return out.filter(Boolean).join('\n\n');
}
