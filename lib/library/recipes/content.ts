import type { Recipe } from '../recipe';

// ── Content set ───────────────────────────────────────────────────
// Ways to split content into sections. Box art: Tabs (behavior: tabs). Card: Accordion (native
// <details> — no script at all).

const SECTIONS = [
  { label: 'Overview', content: 'What it is and who it is for, in a sentence or two.' },
  { label: 'Features', content: 'The three things that make it worth using.' },
  { label: 'Pricing',  content: 'Plans, what each includes, and how billing works.' },
];

const FAQ = [
  { title: 'Can I use it on my phone?',        content: 'Yes — every layout starts mobile-first and grows to tablet and desktop.' },
  { title: 'Do I need to install anything?',   content: 'No. The output is plain HTML and CSS with a tiny optional script.' },
  { title: 'Can I change the colours?',        content: 'Edit your project theme once and every component follows.' },
];

// ── Tabs — the box art ────────────────────────────────────────────
// No script: every section shows stacked under its own heading. With the `tabs` runtime: a tab
// row appears, one panel shows at a time, and the per-section headings hide.

export const tabs: Recipe = {
  format: 2, key: 'tabs', version: 1, set: 'content',
  name: 'Tabs', category: 'containers',
  description: 'Sections behind a row of tabs. Without JavaScript they simply show stacked.',
  behavior: 'tabs',
  props: [
    { name: 'label', type: 'text',   default: 'Sections' },
    { name: 'tabs',  type: 'list',   default: SECTIONS, fields: ['label', 'content'] },
    { name: 'start', type: 'choice', default: '1', options: ['1', '2', '3', '4', '5'] },
  ],
  behaviors: [{ type: 'tabs', params: { start: '{prop.start}' } }],
  anatomy: {
    id: 'root', kind: 'box',
    style: { layout: 'column', gap: '{space.3}', width: 'fill', font: '{font.sans}', color: '{color.text}' },
    children: [
      { id: 'tablist', kind: 'box', untilReady: true, attrs: { 'data-role': 'tablist', 'aria-label': '{prop.label}' },
        style: { layout: 'row', gap: '{space.1}', padding: '{space.1}', width: 'hug', background: '{color.surface}', radius: '{radius.lg}', borderWidth: 1, borderColor: '{color.border}' },
        children: [
          { id: 'tab', kind: 'button', repeat: 'tabs', text: '{item.label}', attrs: { type: 'button', 'data-role': 'tab' },
            style: {
              paddingX: '{space.3}', paddingY: '{space.2}', radius: '{radius.md}', borderWidth: 0, background: 'transparent',
              font: '{font.sans}', fontSize: '{text.sm}', fontWeight: '{weight.medium}', color: '{color.text-muted}', cursor: 'pointer',
            },
            states: {
              hover:    { color: '{color.text}' },
              selected: { background: '{color.surface-raised}', color: '{color.text}', shadow: '{shadow.sm}' },
              focus:    { outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: 2 },
            } },
        ] },
      { id: 'panels', kind: 'box', style: { layout: 'column', gap: '{space.5}' },
        children: [
          { id: 'panel', kind: 'box', repeat: 'tabs', attrs: { 'data-role': 'panel' },
            style: { layout: 'column', gap: '{space.2}', radius: '{radius.md}' },
            states: { focus: { outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: 4 } },
            children: [
              { id: 'panelHeading', kind: 'heading', text: '{item.label}', attrs: { 'data-role': 'panel-heading' },
                style: { fontSize: '{text.md}', fontWeight: '{weight.bold}' } },
              { id: 'panelBody', kind: 'text', text: '{item.content}',
                style: { fontSize: '{text.md}', color: '{color.text-muted}', lineHeight: 1.6 } },
            ] },
        ] },
    ],
  },
  variants: [
    { name: 'tabWidth', default: 'hug', options: {
      hug:  {},
      fill: { tablist: { width: 'fill' }, tab: { width: 'fill' } },   // equal shares: 100% each, flex-shrink evens them
    } },
  ],
  states: {},
  transition: { duration: '{motion.fast}', ease: '{motion.ease}' },
};

// ── Accordion — the card ─────────────────────────────────────────
// Native <details>/<summary>: opens and closes with no script. Items sharing a `group` name are
// exclusive — opening one closes the others (browser-native; clear `group` to allow many open).

export const accordion: Recipe = {
  format: 2, key: 'accordion', version: 1, set: 'content',
  name: 'Accordion', category: 'containers',
  description: 'Questions that expand to answers. Native, no JavaScript; one open at a time by default.',
  behavior: 'disclosure',
  props: [
    { name: 'items', type: 'list', default: FAQ, fields: ['title', 'content'] },
    { name: 'group', type: 'text', default: 'faq' },
  ],
  anatomy: {
    id: 'root', kind: 'box',
    style: { layout: 'column', gap: '{space.2}', width: 'fill', font: '{font.sans}', color: '{color.text}' },
    children: [
      { id: 'item', kind: 'disclosure', repeat: 'items', attrs: { name: '{prop.group}' },
        style: { overflow: 'hidden', background: '{color.surface}', radius: '{radius.lg}', borderWidth: 1, borderColor: '{color.border}' },
        states: { open: { borderColor: '{color.primary}' } },
        children: [
          { id: 'question', kind: 'summary', text: '{item.title}',
            style: { layout: 'row', align: 'center', justify: 'between', gap: '{space.3}', padding: '{space.4}', fontWeight: '{weight.medium}' },
            states: {
              hover: { background: '{color.surface-raised}' },
              focus: { outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: -2 },
            },
            children: [
              { id: 'icon', kind: 'icon', text: '+', style: { color: '{color.text-muted}', fontSize: '{text.lg}', lineHeight: 1 } },
            ] },
          { id: 'answer', kind: 'text', text: '{item.content}',
            style: { layout: 'column', padding: '0 var(--space-4) var(--space-4)', color: '{color.text-muted}', lineHeight: 1.6 } },
        ] },
    ],
  },
  variants: [
    { name: 'style', default: 'cards', options: {
      cards: {},
      plain: { root: { gap: 0 }, item: { radius: 0, background: 'transparent', borderWidth: 0, shadow: 'inset 0 -1px 0 0 var(--color-border)' } },
    } },
  ],
  states: {},
};
