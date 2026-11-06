import { Recipe, Part, PartKind, ListItem } from './recipe';
import { partClass, rootClass } from './css';

// ── Markup — recipe + one placement's choices → native elements ──
// Shared by the exported-code writer (recipeToMarkup) and the Workbench renderer
// (workbench/ui/RecipeView.tsx), so what you preview is what ships.

export type PropValue   = string | boolean | ListItem[];
export type PropValues  = Record<string, PropValue>;
export type OptionPicks = Record<string, string>;   // variant axis → chosen option

export const NATIVE: Record<PartKind, string> = {
  box: 'div', text: 'span', heading: 'h3', button: 'button', link: 'a', image: 'img', icon: 'span',
  input: 'input', textarea: 'textarea', checkbox: 'input', radio: 'input', select: 'select',
  nav: 'nav', list: 'ul', item: 'li', disclosure: 'details', summary: 'summary', slot: 'div',
};
export const VOID = new Set(['img', 'input']);

export const propValue = (r: Recipe, props: PropValues | undefined, name: string): PropValue =>
  props?.[name] ?? r.props.find((p) => p.name === name)?.default ?? '';

// Items of a 'list' prop (empty array if the prop isn't a list)
export const listItems = (r: Recipe, props: PropValues | undefined, name: string): ListItem[] => {
  const v = propValue(r, props, name);
  return Array.isArray(v) ? v : [];
};

// "{prop.label}" → the prop's value; "{item.href}" → the current repeated item's field
export function bind(r: Recipe, props: PropValues | undefined, text: string | undefined, item?: ListItem): string {
  if (!text) return '';
  return text
    .replace(/\{prop\.([a-zA-Z0-9_]+)\}/g, (_, n) => { const v = propValue(r, props, n); return Array.isArray(v) ? '' : String(v); })
    .replace(/\{item\.([a-zA-Z0-9_]+)\}/g, (_, n) => item?.[n] ?? '');
}

export const pickedOption = (r: Recipe, picks: OptionPicks | undefined, axis: string) => {
  const a = r.variants.find((v) => v.name === axis);
  const p = picks?.[axis];
  return a ? (p && a.options[p] ? p : a.default) : '';
};

const FOCUSABLE_KINDS = new Set<PartKind>(['button', 'link', 'input', 'textarea', 'checkbox', 'radio', 'select', 'summary']);

// Attributes for the root element: data-<axis>, plus disabled / invalid flags from props
export function rootAttrs(r: Recipe, props?: PropValues, picks?: OptionPicks): Record<string, string | boolean> {
  const attrs: Record<string, string | boolean> = {};
  for (const a of r.variants) attrs[`data-${a.name}`] = pickedOption(r, picks, a.name);
  const focusable = FOCUSABLE_KINDS.has(r.anatomy.kind);
  if (propValue(r, props, 'disabled') === true) attrs[focusable ? 'disabled' : 'data-disabled'] = true;
  if (propValue(r, props, 'error')) attrs[focusable ? 'aria-invalid' : 'data-invalid'] = focusable ? 'true' : true;
  // Behaviors: data-behavior="carousel …" + each setting as data-<name> for the runtime to read
  if (r.behaviors?.length) {
    attrs['data-behavior'] = r.behaviors.map((b) => b.type).join(' ');
    for (const b of r.behaviors) for (const [k, v] of Object.entries(b.params ?? {})) attrs[`data-${k}`] = bind(r, props, v);
  }
  return attrs;
}

export function partAttrs(r: Recipe, p: Part, props?: PropValues, item?: ListItem): Record<string, string | boolean> {
  const attrs: Record<string, string | boolean> = {};
  if (p.kind === 'checkbox') attrs.type = 'checkbox';
  if (p.kind === 'radio')    attrs.type = 'radio';
  for (const [k, v] of Object.entries(p.attrs ?? {})) attrs[k === 'inputType' ? 'type' : k] = bind(r, props, v, item);
  if (p.untilReady) attrs.hidden = true;
  if (p.id !== r.anatomy.id) {
    // inner form controls follow the component's disabled prop
    if (['input', 'textarea', 'checkbox', 'radio', 'select', 'button'].includes(p.kind) && propValue(r, props, 'disabled') === true) attrs.disabled = true;
  }
  return attrs;
}

// `when: "help"` checks a prop; `when: "item.cta"` checks the current repeated item's field
export const shown = (r: Recipe, p: Part, props?: PropValues, item?: ListItem) => {
  if (!p.when) return true;
  if (p.when.startsWith('item.')) return Boolean(item?.[p.when.slice(5)]);
  const v = propValue(r, props, p.when);
  return Array.isArray(v) ? v.length > 0 : Boolean(v);
};

// One entry per render of a part: a single undefined item, or one per list item when repeating
export const renderItems = (r: Recipe, p: Part, props?: PropValues, inherited?: ListItem): (ListItem | undefined)[] =>
  p.repeat ? listItems(r, props, p.repeat) : [inherited];

// ── Exported code ────────────────────────────────────────────────
// JSX-compatible HTML (className, self-closed void elements), or with `html` plain HTML (class, entities, <!-- -->).
// Slots emit a comment placeholder.

const escJsx  = (s: string) => s.replace(/[{}<>]/g, (c) => `{'${c}'}`);
const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (k: string, v: string | boolean) => (v === true ? k : `${k}="${String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`);

export function recipeToMarkup(r: Recipe, props?: PropValues, picks?: OptionPicks, indent = '', html = false): string {
  const render = (p: Part, pad: string, item?: ListItem): string[] => {
    return renderItems(r, p, props, item).filter((it) => shown(r, p, props, it)).map((it) => {
      const tag    = NATIVE[p.kind];
      const isRoot = p.id === r.anatomy.id;
      const all    = { [html ? 'class' : 'className']: partClass(r, p.id), ...(isRoot ? rootAttrs(r, props, picks) : {}), ...partAttrs(r, p, props, it) };
      const open   = `${tag} ${Object.entries(all).map(([k, v]) => attr(k, v)).join(' ')}`;
      if (VOID.has(tag)) return html ? `${pad}<${open}>` : `${pad}<${open} />`;
      if (p.kind === 'slot') return html ? `${pad}<${open}><!-- ${p.slot?.label ?? p.id} --></${tag}>` : `${pad}<${open}>{/* ${p.slot?.label ?? p.id} */}</${tag}>`;
      const text = (html ? escHtml : escJsx)(bind(r, props, p.text, it));
      const kids = (p.children ?? []).flatMap((c) => render(c, pad + '  ', it));
      if (!kids.length) return `${pad}<${open}>${text}</${tag}>`;
      return [`${pad}<${open}>`, ...(text ? [`${pad}  ${text}`] : []), ...kids, `${pad}</${tag}>`].join('\n');
    });
  };
  return render(r.anatomy, indent).join('\n');
}

export { rootClass };
