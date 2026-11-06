import type { Recipe } from '../recipe';

// One Button, four looks × three sizes — replaces the four separate Alembic button templates.
export const button: Recipe = {
  format: 2, key: 'button', version: 1,
  name: 'Button', category: 'basics',
  description: 'Triggers an action. Label with an optional leading icon.',
  behavior: 'action',
  props: [
    { name: 'label',    type: 'text',    default: 'Button' },
    { name: 'icon',     type: 'text',    default: '' },
    { name: 'disabled', type: 'boolean', default: false },
  ],
  anatomy: {
    id: 'root', kind: 'button',
    style: {
      layout: 'inline', align: 'center', justify: 'center', gap: '{space.2}',
      radius: '{radius.md}', borderWidth: 1, borderColor: 'transparent',
      font: '{font.sans}', fontWeight: '{weight.medium}', lineHeight: 1, cursor: 'pointer',
    },
    children: [
      { id: 'icon',  kind: 'icon', when: 'icon', text: '{prop.icon}' },
      { id: 'label', kind: 'text', text: '{prop.label}' },
    ],
  },
  variants: [
    {
      name: 'variant', default: 'primary',
      options: {
        primary:   { root: { background: '{color.primary}',        color: '{color.primary-text}' } },
        secondary: { root: { background: '{color.surface-raised}', color: '{color.text}', borderColor: '{color.border}' } },
        ghost:     { root: { background: 'transparent',            color: '{color.text}' } },
        danger:    { root: { background: '{color.danger}',         color: '{color.danger-text}' } },
      },
    },
    {
      name: 'size', default: 'md',
      options: {
        sm: { root: { minHeight: 32,             paddingX: '{space.3}', fontSize: '{text.sm}' } },
        md: { root: { minHeight: 40,             paddingX: '{space.4}', fontSize: '{text.md}' } },
        lg: { root: { minHeight: '{size.touch}', paddingX: '{space.5}', fontSize: '{text.lg}' } },
      },
    },
  ],
  states: {
    hover:    { root: { opacity: 0.9 } },
    press:    { root: { scale: 0.97 } },
    focus:    { root: { outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: 2 } },
    disabled: { root: { opacity: 0.45, cursor: 'not-allowed' } },
  },
  transition: { duration: '{motion.fast}', ease: '{motion.ease}' },
};
