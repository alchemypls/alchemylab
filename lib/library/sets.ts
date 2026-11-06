import type { Recipe } from './recipe';
import { button } from './recipes/button';
import { field }  from './recipes/field';
import { card }   from './recipes/card';
import { brand, navLink, navBar } from './recipes/navigation';
import { carousel, heroSlider, mediaCard } from './recipes/carousel';
import { tabs, accordion } from './recipes/content';

// ── Library sets ("box sets") ────────────────────────────────────
// The library ships as sets: a themed bundle whose main piece (the box art) is built alongside
// smaller cards that work on their own anywhere. Generated or hand-written, every set plays by
// the same rules — style with the core token names ({color.*}, {space.*}, {radius.*}, …) so
// cards from different sets mix. Later sets may also carry themes, effects, motion and sound.

export interface LibrarySet {
  key:         string;
  name:        string;
  version:     number;
  description: string;
  recipes:     Recipe[];   // box art first, then its cards
}

const tag = (set: string, rs: Recipe[]) => rs.map((r) => ({ ...r, set }));

export const SETS: LibrarySet[] = [
  {
    key: 'core', name: 'Core', version: 1,
    description: 'The basics every project starts from.',
    recipes: tag('core', [button, field, card]),
  },
  {
    key: 'navigation', name: 'Navigation', version: 1,
    description: 'A responsive site header and the pieces it is made of.',
    recipes: tag('navigation', [navBar, brand, navLink]),
  },
  {
    key: 'carousel', name: 'Carousel', version: 1,
    description: 'Swipeable rows: a card carousel, a full-width hero slider, and the media card they are built from.',
    recipes: tag('carousel', [carousel, heroSlider, mediaCard]),
  },
  {
    key: 'content', name: 'Content', version: 1,
    description: 'Split content into sections: tabs (script-enhanced) and a native accordion.',
    recipes: tag('content', [tabs, accordion]),
  },
];
