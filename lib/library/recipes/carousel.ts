import type { Recipe, Part, PropDef } from '../recipe';

// ── Carousel set ──────────────────────────────────────────────────
// Box art: Carousel. Also: Hero Slider, and the Media Card card (a carousel slide on its own).
// Native-first: tracks are plain horizontal scrollers with CSS scroll-snap — swipe on touch,
// trackpad / shift+wheel on desktop, arrow keys once focused. No JavaScript.

// Offline placeholder art (SVG data URIs) so previews look like slides without external images.
// Replace per use with real image URLs.
const art = (label: string, a: string, b: string) =>
  'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
    `<rect width="800" height="450" fill="url(#g)"/>` +
    `<text x="40" y="410" font-family="system-ui,sans-serif" font-size="36" fill="rgba(255,255,255,0.55)">${label}</text></svg>`,
  );

const SLIDES = [
  { image: art('01', '#4f46e5', '#0ea5e9'), title: 'Design once',      text: 'Sketch it, block it out, ship it everywhere.' },
  { image: art('02', '#db2777', '#f59e0b'), title: 'Mobile first',     text: 'Every layout starts on the phone and grows from there.' },
  { image: art('03', '#059669', '#14b8a6'), title: 'Native output',    text: 'Real HTML elements and CSS — no runtime to ship.' },
  { image: art('04', '#7c3aed', '#ec4899'), title: 'Copy and own',     text: 'Your components are yours to bend however you like.' },
  { image: art('05', '#0f766e', '#84cc16'), title: 'Sets, not pieces', text: 'Whole families of parts that work together.' },
];

const HERO_SLIDES = [
  { image: art('A', '#1e1b4b', '#4f46e5'), title: 'Build the foundation', text: 'A library of parts you actually own.', cta: 'Start building', href: '/start' },
  { image: art('B', '#4a044e', '#db2777'), title: 'Every screen, one design', text: 'Phone, tablet and desktop from one layout.', cta: 'See how', href: '/tour' },
  { image: art('C', '#022c22', '#059669'), title: 'Ship plain, fast pages', text: 'Native elements. Zero runtime.', cta: '', href: '' },
];

const SLIDE_FIELDS = ['image', 'title', 'text'];

// ── Shared controls (driven by the `carousel` behavior) ──────────
// Arrows + dots ship `hidden` (untilReady) and the runtime reveals them, so without JavaScript
// the track is still a plain swipeable row. Each carries the data-role the runtime looks for.

const CONTROL_PROPS: PropDef[] = [
  { name: 'arrows', type: 'boolean', default: true },
  { name: 'dots',   type: 'boolean', default: true },
  { name: 'loop',   type: 'boolean', default: false },
  // seconds between slides; 'off' disables (and it never runs for reduced-motion users)
  { name: 'autoplay', type: 'choice', default: 'off', options: ['off', '3', '5', '8'] },
];

const arrow = (dir: 'prev' | 'next'): Part => ({
  id: dir, kind: 'button', when: 'arrows', untilReady: true, text: dir === 'prev' ? '‹' : '›',
  attrs: { type: 'button', 'data-role': dir, 'aria-label': dir === 'prev' ? 'Previous slide' : 'Next slide' },
  style: {
    position: 'absolute', top: 'calc(50% - 20px)', [dir === 'prev' ? 'left' : 'right']: '{space.2}', zIndex: 2,
    layout: 'inline', align: 'center', justify: 'center', width: 40, height: 40, radius: '{radius.full}',
    background: '{color.surface-raised}', color: '{color.text}', borderWidth: 1, borderColor: '{color.border}',
    fontSize: '{text.xl}', lineHeight: 1, shadow: '{shadow.md}', cursor: 'pointer',
  },
  states: {
    hover:    { background: '{color.border}' },
    focus:    { outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: 2 },
    disabled: { opacity: 0.35, cursor: 'not-allowed' },
  },
});

const dotsPart: Part = {
  id: 'dots', kind: 'box', when: 'dots', untilReady: true, attrs: { 'data-role': 'dots' },
  style: { layout: 'row', justify: 'center', align: 'center', gap: '{space.2}', paddingY: '{space.1}' },
  children: [
    { id: 'dot', kind: 'button', repeat: 'slides',
      attrs: { type: 'button', 'data-role': 'dot', 'aria-label': 'Go to slide: {item.title}' },
      style: { width: 8, height: 8, padding: 0, borderWidth: 0, radius: '{radius.full}', background: '{color.border}', cursor: 'pointer' },
      states: {
        current: { background: '{color.primary}', width: 20 },
        hover:   { background: '{color.text-muted}' },
        focus:   { outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: 2 },
      } },
  ],
};

// ── Media Card — the card ─────────────────────────────────────────

export const mediaCard: Recipe = {
  format: 2, key: 'media-card', version: 1, set: 'carousel',
  name: 'Media Card', category: 'containers',
  description: 'Image on top, title and text below. The Carousel’s slide, usable on its own.',
  behavior: 'none',
  props: [
    { name: 'image', type: 'text', default: SLIDES[0].image },
    { name: 'title', type: 'text', default: SLIDES[0].title },
    { name: 'text',  type: 'text', default: SLIDES[0].text },
  ],
  anatomy: {
    id: 'root', kind: 'box',
    style: {
      layout: 'column', width: 'fill', overflow: 'hidden', font: '{font.sans}', color: '{color.text}',
      background: '{color.surface}', radius: '{radius.lg}', borderWidth: 1, borderColor: '{color.border}',
    },
    children: [
      { id: 'media', kind: 'image', attrs: { src: '{prop.image}', alt: '{prop.title}' },
        style: { width: 'fill', aspect: '16 / 9', objectFit: 'cover' } },
      { id: 'body', kind: 'box', style: { layout: 'column', gap: '{space.1}', padding: '{space.4}' },
        children: [
          { id: 'title', kind: 'heading', text: '{prop.title}', style: { fontSize: '{text.md}', fontWeight: '{weight.bold}' } },
          { id: 'text', kind: 'text', when: 'text', text: '{prop.text}', style: { fontSize: '{text.sm}', color: '{color.text-muted}' } },
        ] },
    ],
  },
  variants: [
    { name: 'elevation', default: 'flat', options: {
      flat:   {},
      raised: { root: { shadow: '{shadow.md}', background: '{color.surface-raised}' } },
    } },
  ],
  states: {},
};

// ── Carousel — the box art ────────────────────────────────────────
// Phones: one slide with the next peeking in. Tablet: two. Desktop: three. `show` pins a fixed
// count at every width (variants out-rank the responsive rules).

export const carousel: Recipe = {
  format: 2, key: 'carousel', version: 3, set: 'carousel',
  name: 'Carousel', category: 'containers',
  description: 'A swipeable row of cards. Shows more slides on wider screens.',
  behavior: 'none',
  props: [
    { name: 'title',  type: 'text', default: 'Featured' },
    { name: 'hint',   type: 'text', default: 'Swipe →' },
    { name: 'slides', type: 'list', default: SLIDES, fields: SLIDE_FIELDS },
    ...CONTROL_PROPS,
  ],
  behaviors: [{ type: 'carousel', params: { loop: '{prop.loop}', autoplay: '{prop.autoplay}' } }],
  anatomy: {
    id: 'root', kind: 'box',
    style: { layout: 'column', gap: '{space.3}', width: 'fill', font: '{font.sans}', color: '{color.text}' },
    children: [
      { id: 'header', kind: 'box', style: { layout: 'row', align: 'end', justify: 'between', gap: '{space.3}' },
        children: [
          { id: 'title', kind: 'heading', when: 'title', text: '{prop.title}', style: { fontSize: '{text.lg}', fontWeight: '{weight.bold}' } },
          { id: 'hint', kind: 'text', when: 'hint', text: '{prop.hint}', style: { fontSize: '{text.sm}', color: '{color.text-muted}' } },
        ] },
      { id: 'viewport', kind: 'box', style: { position: 'relative' }, children: [
      arrow('prev'),
      { id: 'track', kind: 'list', attrs: { tabIndex: '0', 'aria-label': '{prop.title}', 'data-role': 'track' },
        style: {
          layout: 'row', gap: '{space.3}', scroll: 'x-snap', scrollbar: 'hidden', paddingY: '{space.1}',
          outlineColor: 'transparent', outlineWidth: 0,
        },
        states: { focus: { outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: 2 } },
        children: [
          { id: 'slide', kind: 'item', repeat: 'slides',
            style: {
              layout: 'column', basis: '85%', snapAlign: 'start', overflow: 'hidden',
              background: '{color.surface}', radius: '{radius.lg}', borderWidth: 1, borderColor: '{color.border}',
            },
            children: [
              { id: 'media', kind: 'image', attrs: { src: '{item.image}', alt: '{item.title}' },
                style: { width: 'fill', aspect: '16 / 9', objectFit: 'cover' } },
              { id: 'caption', kind: 'box', style: { layout: 'column', gap: '{space.1}', padding: '{space.4}' },
                children: [
                  { id: 'slideTitle', kind: 'heading', text: '{item.title}', style: { fontSize: '{text.md}', fontWeight: '{weight.bold}' } },
                  { id: 'slideText', kind: 'text', when: 'item.text', text: '{item.text}', style: { fontSize: '{text.sm}', color: '{color.text-muted}' } },
                ] },
            ] },
        ] },
      arrow('next'),
      ] },
      dotsPart,
    ],
  },
  variants: [
    { name: 'show', default: 'auto', options: {
      auto: {},
      one:  { slide: { basis: '100%' } },
      peek: { slide: { basis: '85%' } },
    } },
  ],
  states: {},
  responsive: {
    tablet:  { slide: { basis: 'calc(50% - 6px)' } },        // 2 per view (gap 12px)
    desktop: { slide: { basis: 'calc(33.333% - 8px)' } },    // 3 per view
  },
};

// ── Hero Slider ───────────────────────────────────────────────────
// Full-width image slides with an overlaid headline, text and optional button (a slide's
// button only shows when it has `cta` text). Portrait on phones, widescreen from tablet up.

export const heroSlider: Recipe = {
  format: 2, key: 'hero-slider', version: 3, set: 'carousel',
  name: 'Hero Slider', category: 'containers',
  description: 'Full-width swipeable hero: image slides with headline, text and a button.',
  behavior: 'none',
  props: [
    { name: 'label',  type: 'text', default: 'Highlights' },
    { name: 'slides', type: 'list', default: HERO_SLIDES, fields: ['image', 'title', 'text', 'cta', 'href'] },
    ...CONTROL_PROPS,
  ],
  behaviors: [{ type: 'carousel', params: { loop: '{prop.loop}', autoplay: '{prop.autoplay}' } }],
  anatomy: {
    id: 'root', kind: 'box', style: { layout: 'column', gap: '{space.2}', width: 'fill', font: '{font.sans}', color: '{color.text}' },
    children: [
      { id: 'viewport', kind: 'box', style: { position: 'relative' }, children: [
      arrow('prev'),
      { id: 'track', kind: 'list', attrs: { tabIndex: '0', 'aria-label': '{prop.label}', 'data-role': 'track' },
        style: { layout: 'row', scroll: 'x-snap', scrollbar: 'hidden', radius: '{radius.lg}', outlineColor: 'transparent', outlineWidth: 0 },
        states: { focus: { outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: 2 } },
        children: [
          { id: 'slide', kind: 'item', repeat: 'slides',
            style: { basis: '100%', snapAlign: 'start', position: 'relative', aspect: '4 / 5', overflow: 'hidden' },
            children: [
              { id: 'media', kind: 'image', attrs: { src: '{item.image}', alt: '' },
                style: { position: 'absolute', top: 0, left: 0, width: 'fill', height: 'fill', objectFit: 'cover' } },
              { id: 'overlay', kind: 'box',
                style: {
                  position: 'absolute', left: 0, right: 0, bottom: 0, layout: 'column', gap: '{space.2}', padding: '{space.5}',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0))', color: '#ffffff',
                },
                children: [
                  { id: 'headline', kind: 'heading', text: '{item.title}', style: { fontSize: '{text.xl}', fontWeight: '{weight.bold}' } },
                  { id: 'subline', kind: 'text', when: 'item.text', text: '{item.text}', style: { fontSize: '{text.md}', opacity: 0.85 } },
                  { id: 'cta', kind: 'link', when: 'item.cta', text: '{item.cta}', attrs: { href: '{item.href}' },
                    style: {
                      layout: 'inline', width: 'hug', paddingX: '{space.4}', paddingY: '{space.2}', radius: '{radius.md}',
                      background: '{color.primary}', color: '{color.primary-text}', fontSize: '{text.sm}', fontWeight: '{weight.medium}',
                    },
                    states: {
                      hover: { opacity: 0.9 },
                      focus: { outlineColor: '#ffffff', outlineWidth: 2, outlineOffset: 2 },
                    } },
                ] },
            ] },
        ] },
      arrow('next'),
      ] },
      dotsPart,
    ],
  },
  variants: [
    { name: 'shape', default: 'auto', options: {
      auto:   {},
      square: { slide: { aspect: '1 / 1' } },
      wide:   { slide: { aspect: '21 / 9' } },
    } },
  ],
  states: {},
  responsive: {
    tablet:  { slide: { aspect: '16 / 9' } },
    desktop: { slide: { aspect: '21 / 9' } },
  },
};
