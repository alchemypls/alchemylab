import type { Recipe } from '../recipe';

// ── Navigation set ────────────────────────────────────────────────
// Box art: Nav Bar. Cards: Brand and Nav Link — usable on their own anywhere (footers, sidebars).
// Nav Bar is responsive by itself: links inline from tablet up; on phones they fold into a
// native <details> menu (no JavaScript).

const LINKS = [
  { label: 'Home',    href: '/' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'About',   href: '/about' },
];

export const brand: Recipe = {
  format: 2, key: 'brand', version: 1, set: 'navigation',
  name: 'Brand', category: 'basics',
  description: 'Logo mark + site name, linking home.',
  behavior: 'navigate',
  props: [
    { name: 'name', type: 'text', default: 'Acme' },
    { name: 'mark', type: 'text', default: '◆' },
    { name: 'href', type: 'text', default: '/' },
  ],
  anatomy: {
    id: 'root', kind: 'link', attrs: { href: '{prop.href}' },
    style: { layout: 'inline', align: 'center', gap: '{space.2}', font: '{font.sans}', fontWeight: '{weight.bold}', color: '{color.text}' },
    children: [
      { id: 'mark', kind: 'icon', when: 'mark', text: '{prop.mark}', style: { color: '{color.primary}' } },
      { id: 'label', kind: 'text', text: '{prop.name}' },
    ],
  },
  variants: [
    { name: 'size', default: 'md', options: {
      sm: { root: { fontSize: '{text.md}' } },
      md: { root: { fontSize: '{text.lg}' } },
      lg: { root: { fontSize: '{text.xl}' } },
    } },
  ],
  states: {
    focus: { root: { outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: 4 } },
  },
};

export const navLink: Recipe = {
  format: 2, key: 'nav-link', version: 1, set: 'navigation',
  name: 'Nav Link', category: 'basics',
  description: 'A navigation link with hover and a "current page" look.',
  behavior: 'navigate',
  props: [
    { name: 'label', type: 'text', default: 'Pricing' },
    { name: 'href',  type: 'text', default: '/pricing' },
  ],
  anatomy: {
    id: 'root', kind: 'link', text: '{prop.label}', attrs: { href: '{prop.href}' },
    style: {
      layout: 'inline', align: 'center', paddingX: '{space.3}', paddingY: '{space.2}', radius: '{radius.md}',
      font: '{font.sans}', fontSize: '{text.md}', fontWeight: '{weight.medium}', color: '{color.text-muted}', cursor: 'pointer',
    },
  },
  variants: [
    { name: 'current', default: 'no', options: {
      no:  {},
      yes: { root: { color: '{color.text}', background: '{color.surface-raised}' } },
    } },
  ],
  states: {
    hover: { root: { color: '{color.text}', background: '{color.surface-raised}' } },
    focus: { root: { outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: 2 } },
  },
  transition: { duration: '{motion.fast}', ease: '{motion.ease}' },
};

export const navBar: Recipe = {
  format: 2, key: 'nav-bar', version: 1, set: 'navigation',
  name: 'Nav Bar', category: 'containers',
  description: 'Site header: brand, links, a call to action. Links fold into a menu on phones.',
  behavior: 'navigate',
  props: [
    { name: 'brand',    type: 'text', default: 'Acme' },
    { name: 'mark',     type: 'text', default: '◆' },
    { name: 'links',    type: 'list', default: LINKS, fields: ['label', 'href'] },
    { name: 'cta',      type: 'text', default: 'Get started' },
    { name: 'ctaHref',  type: 'text', default: '/signup' },
    { name: 'menuIcon', type: 'text', default: '☰' },
  ],
  anatomy: {
    id: 'root', kind: 'nav',
    style: {
      layout: 'row', align: 'center', justify: 'between', gap: '{space.4}', width: 'fill',
      paddingX: '{space.4}', minHeight: 56, position: 'relative',
      font: '{font.sans}', color: '{color.text}', shadow: '{shadow.sm}',
    },
    children: [
      { id: 'brand', kind: 'link', attrs: { href: '/' },
        style: { layout: 'inline', align: 'center', gap: '{space.2}', fontWeight: '{weight.bold}', fontSize: '{text.lg}' },
        children: [
          { id: 'mark', kind: 'icon', when: 'mark', text: '{prop.mark}', style: { color: '{color.primary}' } },
          { id: 'brandName', kind: 'text', text: '{prop.brand}' },
        ] },

      // Inline links — hidden on phones, shown from tablet up (responsive below)
      { id: 'links', kind: 'list', style: { hide: true, align: 'center', gap: '{space.1}' },
        children: [
          { id: 'linkItem', kind: 'item', repeat: 'links',
            children: [
              { id: 'link', kind: 'link', text: '{item.label}', attrs: { href: '{item.href}' },
                style: { layout: 'inline', paddingX: '{space.3}', paddingY: '{space.2}', radius: '{radius.md}',
                         fontSize: '{text.md}', fontWeight: '{weight.medium}', color: '{color.text-muted}' },
                states: {
                  hover: { color: '{color.text}', background: '{color.surface-raised}' },
                  focus: { outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: 2 },
                } },
            ] },
        ] },

      { id: 'actions', kind: 'box', style: { layout: 'row', align: 'center', gap: '{space.2}' },
        children: [
          { id: 'cta', kind: 'link', when: 'cta', text: '{prop.cta}', attrs: { href: '{prop.ctaHref}' },
            style: { layout: 'inline', align: 'center', paddingX: '{space.4}', paddingY: '{space.2}', radius: '{radius.md}',
                     background: '{color.primary}', color: '{color.primary-text}', fontSize: '{text.sm}', fontWeight: '{weight.medium}' },
            states: {
              hover: { opacity: 0.9 },
              focus: { outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: 2 },
            } },

          // Phone menu — native <details>; hidden from tablet up
          { id: 'menu', kind: 'disclosure',
            children: [
              { id: 'menuButton', kind: 'summary', text: '{prop.menuIcon}',
                style: { layout: 'inline', align: 'center', justify: 'center', minWidth: '{size.touch}', minHeight: '{size.touch}',
                         radius: '{radius.md}', fontSize: '{text.lg}' },
                states: {
                  hover: { background: '{color.surface-raised}' },
                  focus: { outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: 2 },
                } },
              { id: 'menuPanel', kind: 'list',
                style: { layout: 'column', gap: '{space.1}', padding: '{space.3}', position: 'absolute', top: '100%', left: 0, right: 0,
                         zIndex: 20, background: '{color.surface}', borderWidth: 1, borderColor: '{color.border}', shadow: '{shadow.md}' },
                children: [
                  { id: 'menuItem', kind: 'item', repeat: 'links',
                    children: [
                      { id: 'menuLink', kind: 'link', text: '{item.label}', attrs: { href: '{item.href}' },
                        style: { layout: 'row', width: 'fill', padding: '{space.3}', radius: '{radius.md}', fontSize: '{text.md}' },
                        states: {
                          hover: { background: '{color.surface-raised}' },
                          focus: { outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: -2 },
                        } },
                    ] },
                ] },
            ] },
        ] },
    ],
  },
  variants: [
    { name: 'tone', default: 'surface', options: {
      surface:     { root: { background: '{color.surface}' } },
      transparent: { root: { background: 'transparent', shadow: 'none' } },
      primary:     { root: { background: '{color.primary}', color: '{color.primary-text}' },
                     link: { color: '{color.primary-text}' } },
    } },
  ],
  states: {},
  responsive: {
    tablet: {
      links: { layout: 'row' },   // re-show the inline links (overrides hide)
      menu:  { hide: true },      // and fold away the phone menu
      root:  { paddingX: '{space.5}' },
    },
  },
  transition: { duration: '{motion.fast}', ease: '{motion.ease}' },
};
