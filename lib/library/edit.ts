import { Recipe, Part, Style, StateName, walkParts } from './recipe';

// ── Recipe editing — pure, immutable helpers ─────────────────────
// A recipe's styling lives in three kinds of layer: the base (each part's own style), a variant
// option (deltas for one choice on one axis), and a state (deltas while hovered, focused, …).
// The Fabricator edits one layer at a time; these read and write a part's style in a layer.

export type Layer =
  | { kind: 'base' }
  | { kind: 'variant'; axis: string; option: string }
  | { kind: 'state'; state: StateName }                       // whole component in that state
  | { kind: 'partState'; state: StateName }                   // each part's OWN state (part.states)
  | { kind: 'responsive'; tier: 'tablet' | 'desktop' };       // mobile-first delta from that width up

export const STATE_NAMES: StateName[] = ['hover', 'press', 'focus', 'disabled', 'checked', 'open', 'invalid', 'current', 'selected'];

export const STYLE_KEYS: (keyof Style)[] = [
  'layout', 'align', 'justify', 'gap', 'padding', 'paddingX', 'paddingY',
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth',
  'background', 'color', 'borderColor', 'borderWidth', 'radius', 'shadow',
  'font', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight', 'textAlign',
  'opacity', 'scale', 'outlineColor', 'outlineWidth', 'outlineOffset', 'cursor', 'overflow',
  'hide', 'position', 'top', 'right', 'bottom', 'left', 'zIndex',
  'scroll', 'scrollbar', 'snapAlign', 'basis', 'aspect', 'objectFit',
];

export const layerKey = (l: Layer) =>
  l.kind === 'base' ? 'base'
  : l.kind === 'variant' ? `variant:${l.axis}:${l.option}`
  : l.kind === 'state' ? `state:${l.state}`
  : l.kind === 'partState' ? `part:${l.state}`
  : `tier:${l.tier}`;

export function partIds(r: Recipe): string[] {
  const ids: string[] = [];
  walkParts(r.anatomy, (p) => ids.push(p.id));
  return ids;
}

function findPart(part: Part, id: string): Part | undefined {
  if (part.id === id) return part;
  for (const c of part.children ?? []) { const f = findPart(c, id); if (f) return f; }
  return undefined;
}

export function layerStyle(r: Recipe, layer: Layer, partId: string): Style {
  if (layer.kind === 'base')    return findPart(r.anatomy, partId)?.style ?? {};
  if (layer.kind === 'variant') return r.variants.find((a) => a.name === layer.axis)?.options[layer.option]?.[partId] ?? {};
  if (layer.kind === 'partState')  return findPart(r.anatomy, partId)?.states?.[layer.state] ?? {};
  if (layer.kind === 'responsive') return r.responsive?.[layer.tier]?.[partId] ?? {};
  return r.states[layer.state]?.[partId] ?? {};
}

const mapPart = (part: Part, id: string, fn: (p: Part) => Part): Part =>
  part.id === id ? fn(part) : { ...part, children: part.children?.map((c) => mapPart(c, id, fn)) };

// Empty deltas are dropped so layers don't accumulate {} entries
const withPart = (styles: Record<string, Style>, partId: string, style: Style) => {
  const next = { ...styles };
  if (Object.keys(style).length) next[partId] = style; else delete next[partId];
  return next;
};

export function setLayerStyle(r: Recipe, layer: Layer, partId: string, style: Style): Recipe {
  if (layer.kind === 'base') return { ...r, anatomy: mapPart(r.anatomy, partId, (p) => ({ ...p, style })) };
  if (layer.kind === 'variant') {
    return { ...r, variants: r.variants.map((a) => a.name !== layer.axis ? a : {
      ...a, options: { ...a.options, [layer.option]: withPart(a.options[layer.option] ?? {}, partId, style) },
    }) };
  }
  if (layer.kind === 'partState') {
    return { ...r, anatomy: mapPart(r.anatomy, partId, (p) => {
      const states = { ...p.states };
      if (Object.keys(style).length) states[layer.state] = style; else delete states[layer.state];
      return { ...p, states: Object.keys(states).length ? states : undefined };
    }) };
  }
  if (layer.kind === 'responsive') {
    return { ...r, responsive: { ...r.responsive, [layer.tier]: withPart(r.responsive?.[layer.tier] ?? {}, partId, style) } };
  }
  return { ...r, states: { ...r.states, [layer.state]: withPart(r.states[layer.state] ?? {}, partId, style) } };
}

// "Add an option" — e.g. variant: hero, starting as a copy of an existing option
export function addOption(r: Recipe, axis: string, name: string, basedOn?: string): Recipe {
  return { ...r, variants: r.variants.map((a) => a.name !== axis || a.options[name] ? a : {
    ...a, options: { ...a.options, [name]: structuredClone(a.options[basedOn ?? a.default] ?? {}) },
  }) };
}

export function removeOption(r: Recipe, axis: string, name: string): Recipe {
  return { ...r, variants: r.variants.map((a) => {
    if (a.name !== axis || a.default === name || !a.options[name]) return a;
    const options = { ...a.options };
    delete options[name];
    return { ...a, options };
  }) };
}

// Text input → style value: plain numbers become numbers (px / unitless), everything else stays text
export const parseStyleValue = (raw: string): string | number | boolean => {
  const t = raw.trim();
  if (t === 'true' || t === 'false') return t === 'true';
  return t !== '' && !isNaN(Number(t)) ? Number(t) : t;
};

// ── What each style property accepts ─────────────────────────────
// Token groups a property may reference ({color.primary} is fine for background, not opacity),
// a closed set of choices, or plain numbers. Drives the Fabricator's suggestions + validation.

export interface PropertySpec {
  tokens?:  string[];          // allowed token groups (prefix before the first '.')
  choices?: string[];          // closed set — edited with a dropdown
  numeric?: boolean;           // must be a number (px, or unitless for opacity/scale/…)
  free?:    boolean;           // raw CSS text also allowed (e.g. a custom colour or gradient)
}

const COLOR = { tokens: ['color'], free: true };
const SPACE = { tokens: ['space'], numeric: true, free: true };
const SIZE  = { tokens: ['size', 'space'], numeric: true, free: true };

export const PROPERTY_SPECS: Record<keyof Style, PropertySpec> = {
  layout:  { choices: ['row', 'column', 'inline'] },
  align:   { choices: ['start', 'center', 'end', 'stretch'] },
  justify: { choices: ['start', 'center', 'end', 'between'] },
  gap: SPACE, padding: SPACE, paddingX: SPACE, paddingY: SPACE,
  width:  { ...SIZE, choices: ['fill', 'hug'] }, height: { ...SIZE, choices: ['fill', 'hug'] },
  minWidth: SIZE, minHeight: SIZE, maxWidth: SIZE,
  background: COLOR, color: COLOR, borderColor: COLOR, outlineColor: COLOR,
  borderWidth: { numeric: true }, outlineWidth: { numeric: true }, outlineOffset: { numeric: true },
  radius:  { tokens: ['radius'], numeric: true, free: true },
  shadow:  { tokens: ['shadow'], free: true },
  font:    { tokens: ['font'], free: true },
  fontSize:   { tokens: ['text'], numeric: true, free: true },
  fontWeight: { tokens: ['weight'], numeric: true },
  letterSpacing: { numeric: true, free: true },
  lineHeight:    { numeric: true },
  textAlign: { choices: ['start', 'center', 'end'] },
  opacity:   { numeric: true },
  scale:     { numeric: true },
  cursor:    { choices: ['pointer', 'text', 'not-allowed', 'default'] },
  overflow:  { choices: ['hidden', 'visible'] },
  hide:      { choices: ['true', 'false'] },
  position:  { choices: ['relative', 'absolute'] },
  top: { ...SIZE, tokens: ['space'] }, right: { ...SIZE, tokens: ['space'] },
  bottom: { ...SIZE, tokens: ['space'] }, left: { ...SIZE, tokens: ['space'] },
  zIndex:    { numeric: true },
  scroll:    { choices: ['x', 'x-snap'] },
  scrollbar: { choices: ['thin', 'hidden'] },
  snapAlign: { choices: ['start', 'center'] },
  basis:     { tokens: ['size', 'space'], numeric: true, free: true },
  aspect:    { free: true },
  objectFit: { choices: ['cover', 'contain'] },
};

// Token names a property may use, from a theme's token list
export const tokensFor = (key: keyof Style, tokenNames: string[]) => {
  const groups = PROPERTY_SPECS[key]?.tokens ?? [];
  return tokenNames.filter((t) => groups.includes(t.split('.')[0]));
};

// Returns an error message, or null if `raw` is acceptable for `key`
export function validateStyleValue(key: keyof Style, raw: string, tokenNames: string[]): string | null {
  const spec = PROPERTY_SPECS[key];
  const v = raw.trim();
  if (!spec || v === '') return v === '' ? 'empty' : null;
  if (spec.choices?.includes(v)) return null;
  const token = /^\{([a-z0-9.-]+)\}$/i.exec(v)?.[1];
  if (token) {
    if (!tokenNames.includes(token)) return `no token named ${token}`;
    if (!spec.tokens?.includes(token.split('.')[0])) {
      return spec.tokens?.length ? `use a ${spec.tokens.join(' / ')} token` : 'takes a number, not a token';
    }
    return null;
  }
  if (spec.numeric && !isNaN(Number(v))) return null;
  if (spec.free && !spec.choices?.length) return null;
  if (spec.free && spec.choices?.length) return null;
  if (spec.choices && !spec.numeric) return `one of: ${spec.choices.join(', ')}`;
  return spec.numeric ? 'must be a number' : null;
}
