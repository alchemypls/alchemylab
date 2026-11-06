import type { Recipe } from '../recipe';

// Container with slots — media on top, a header, free content, and an actions row.
// Proves slots: named holes that other components are placed into.
export const card: Recipe = {
  format: 2, key: 'card', version: 1,
  name: 'Card', category: 'containers',
  description: 'A surface that groups related content: optional media, a title, body content and actions.',
  behavior: 'none',
  props: [
    { name: 'title',       type: 'text', default: 'Card title' },
    { name: 'description', type: 'text', default: '' },
  ],
  anatomy: {
    id: 'root', kind: 'box',
    style: {
      layout: 'column', width: 'fill', overflow: 'hidden',
      background: '{color.surface}', color: '{color.text}', font: '{font.sans}',
      borderWidth: 1, borderColor: '{color.border}', radius: '{radius.lg}',
    },
    children: [
      { id: 'media', kind: 'slot', slot: { label: 'Media', accepts: ['image'] } },
      { id: 'header', kind: 'box', style: { layout: 'column', gap: '{space.1}' },
        children: [
          { id: 'title', kind: 'heading', text: '{prop.title}',
            style: { fontSize: '{text.lg}', fontWeight: '{weight.bold}' } },
          { id: 'description', kind: 'text', when: 'description', text: '{prop.description}',
            style: { fontSize: '{text.sm}', color: '{color.text-muted}' } },
        ] },
      { id: 'content', kind: 'slot', slot: { label: 'Content', accepts: 'any', multiple: true },
        style: { layout: 'column', gap: '{space.3}' } },
      { id: 'actions', kind: 'slot', slot: { label: 'Actions', accepts: ['button', 'link'], multiple: true },
        style: { layout: 'row', gap: '{space.2}', justify: 'end' } },
    ],
  },
  variants: [
    {
      name: 'elevation', default: 'flat',
      options: {
        flat:   { root: { shadow: 'none' } },
        raised: { root: { shadow: '{shadow.md}', background: '{color.surface-raised}' } },
      },
    },
    {
      name: 'padding', default: 'md',
      options: {
        sm: { header: { padding: '{space.3}' }, content: { paddingX: '{space.3}' }, actions: { padding: '{space.3}' } },
        md: { header: { padding: '{space.4}' }, content: { paddingX: '{space.4}' }, actions: { padding: '{space.4}' } },
      },
    },
  ],
  states: {},
};
