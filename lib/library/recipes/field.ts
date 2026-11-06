import type { Recipe } from '../recipe';

// Label + text input + optional help / error line. Proves multi-part anatomy and part-level states.
export const field: Recipe = {
  format: 2, key: 'field', version: 1,
  name: 'Field', category: 'forms',
  description: 'A labelled text input with optional help text and an error message.',
  behavior: 'text-entry',
  props: [
    { name: 'label',       type: 'text',    default: 'Email' },
    { name: 'placeholder', type: 'text',    default: 'you@example.com' },
    { name: 'type',        type: 'choice',  default: 'text', options: ['text', 'email', 'password', 'number', 'search', 'tel', 'url'] },
    { name: 'help',        type: 'text',    default: '' },
    { name: 'error',       type: 'text',    default: '' },
    { name: 'disabled',    type: 'boolean', default: false },
  ],
  anatomy: {
    id: 'root', kind: 'box',
    style: { layout: 'column', gap: '{space.1}', width: 'fill', font: '{font.sans}' },
    children: [
      { id: 'label', kind: 'text', text: '{prop.label}',
        style: { fontSize: '{text.sm}', fontWeight: '{weight.medium}', color: '{color.text-muted}' } },
      { id: 'control', kind: 'input',
        attrs: { inputType: '{prop.type}', placeholder: '{prop.placeholder}' },
        style: {
          width: 'fill', paddingX: '{space.3}', radius: '{radius.md}',
          background: '{color.surface}', color: '{color.text}',
          borderWidth: 1, borderColor: '{color.border}', font: '{font.sans}',
        } },
      { id: 'help',  kind: 'text', when: 'help',  text: '{prop.help}',
        style: { fontSize: '{text.sm}', color: '{color.text-muted}' } },
      { id: 'error', kind: 'text', when: 'error', text: '{prop.error}',
        style: { fontSize: '{text.sm}', color: '{color.danger}' } },
    ],
  },
  variants: [
    {
      name: 'size', default: 'md',
      options: {
        sm: { control: { minHeight: 32,             fontSize: '{text.sm}' } },
        md: { control: { minHeight: 40,             fontSize: '{text.md}' } },
        lg: { control: { minHeight: '{size.touch}', fontSize: '{text.lg}' } },
      },
    },
  ],
  states: {
    focus:    { control: { borderColor: '{color.focus}', outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: 0 } },
    invalid:  { control: { borderColor: '{color.danger}' } },
    disabled: { root: { opacity: 0.5 }, control: { cursor: 'not-allowed' } },
  },
  transition: { duration: '{motion.fast}', ease: '{motion.ease}' },
};
