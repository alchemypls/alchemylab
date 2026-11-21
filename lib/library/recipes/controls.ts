import type { Recipe } from '../recipe';

// The orb stick: a round controller for a site and a game (behaviors/orb.ts runs it). A disc in the middle that steers
// and, tapped, is button 1; a press zone at the top of the ring (button 2); a side button left of the ring. All three
// are real buttons, so keys and screen readers reach them; the runtime adds steering, the dial and the events.
// The root fills its block and puts the orb at its right edge (pinned bottom-right, it sits at the page edge); in a
// block narrower than the orb it overflows leftward, so a one-column pin covers no more of the page than the orb.
export const orbStick: Recipe = {
  format: 2, key: 'orb-stick', version: 1,
  name: 'Orb stick', category: 'basics',
  description: 'A round controller: a stick that steers and taps, a ring button and a side button. Dials the page’s sections on a site; sends events to a game.',
  behavior: 'none',
  props: [
    { name: 'mode',      type: 'choice', default: 'site', options: ['site', 'game'] },
    { name: 'b1Label',   type: 'text',   default: 'Next' },
    { name: 'b2Label',   type: 'text',   default: 'Previous' },
    { name: 'sideLabel', type: 'text',   default: 'Help' },
    { name: 'b2Mark',    type: 'text',   default: '▴' },
    { name: 'sideMark',  type: 'text',   default: '?' },
  ],
  anatomy: {
    id: 'root', kind: 'box',
    style: { layout: 'row', justify: 'end', width: 'fill' },
    children: [{
      id: 'orb', kind: 'box', attrs: { 'data-role': 'orb' },
      style: { position: 'relative', width: 'calc(136px + 32px * var(--tier, 0))', basis: 'calc(136px + 32px * var(--tier, 0))', aspect: '1 / 1', color: '{color.text-muted}' },   // never shrinks: a narrow block, it overflows leftward
      children: [
        { id: 'ring', kind: 'box', style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', radius: '50%', borderWidth: 1, borderColor: '{color.border}', background: '{color.surface}' } },
        { id: 'label', kind: 'text', attrs: { 'data-role': 'dial-label', 'aria-live': 'polite' },
          style: { position: 'absolute', bottom: '104%', left: 0, width: '100%', textAlign: 'center', font: '{font.mono}', fontSize: '{text.sm}', color: '{color.primary}' } },
        { id: 'b2', kind: 'button', text: '{prop.b2Mark}', attrs: { type: 'button', 'data-role': 'b2', 'aria-label': '{prop.b2Label}' },
          style: { position: 'absolute', top: '2%', left: '30%', width: '40%', height: '24%', radius: '999px 999px 12px 12px', borderWidth: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', font: '{font.mono}' } },
        { id: 'stick', kind: 'button', attrs: { type: 'button', 'data-role': 'stick', 'aria-label': '{prop.b1Label}' },
          style: { position: 'absolute', top: '30%', left: '30%', width: '40%', height: '40%', radius: '50%', borderWidth: 1, borderColor: '{color.primary}', background: '{color.surface-raised}', cursor: 'pointer' } },
        { id: 'side', kind: 'button', text: '{prop.sideMark}', attrs: { type: 'button', 'data-role': 'side', 'aria-label': '{prop.sideLabel}' },
          style: { position: 'absolute', top: 'calc(50% - 22px)', right: 'calc(100% + 8px)', width: 44, height: 44, radius: '50%', borderWidth: 1, borderColor: '{color.border}', background: '{color.surface}', color: 'inherit', cursor: 'pointer', font: '{font.mono}' } },
      ],
    }],
  },
  variants: [],
  states: {},
  transition: { duration: '{motion.fast}', ease: '{motion.ease}' },
  behaviors: [{ type: 'orb', params: { 'orb-mode': '{prop.mode}' } }],
};

// Pressed or steering: the part lights (the runtime sets data-alive on it for a moment)
orbStick.anatomy.children![0].children!.forEach((p) => {
  if (p.id === 'stick') p.states = { alive: { outlineColor: '{color.primary}', outlineWidth: 2, outlineOffset: 2 }, focus: { outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: 2 } };
  if (p.id === 'b2' || p.id === 'side') p.states = { alive: { color: '{color.primary}' }, hover: { color: '{color.text}' }, focus: { outlineColor: '{color.focus}', outlineWidth: 2, outlineOffset: 2 } };
});
