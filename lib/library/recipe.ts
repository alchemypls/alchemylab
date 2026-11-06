import type { TokenRef } from './theme';

// ── Recipe — the component format (v2) ───────────────────────────
// A recipe describes a component as data:
//   anatomy   a small tree of named parts (what it's made of)
//   props     what a user of the component fills in (label text, disabled, …)
//   variants  option axes — variant: primary|ghost, size: sm|md|lg — as style deltas per part
//   states    hover / press / focus / disabled / checked / open / invalid, as style deltas
//   behavior  a NAMED interaction type; generators map it to native elements first
//
// Everything is a raw value, a token reference, or a named choice — no framework identifiers.
// Generators (lib/library/css.ts, later React/HTML) are the only place that knows a target.

// Semantic element kinds. Generators pick the native element (button → <button>, …).
export type PartKind =
  | 'box' | 'text' | 'heading' | 'button' | 'link' | 'image' | 'icon'
  | 'input' | 'textarea' | 'checkbox' | 'radio' | 'select'
  | 'nav'         // <nav> — a navigation landmark
  | 'list' | 'item'           // <ul> / <li>
  | 'disclosure' | 'summary'  // <details> / <summary> — native open/close, no JavaScript
  | 'slot';    // a named hole other components are placed into

type V = string | number | TokenRef;

// Style vocabulary — a deliberately small, generator-neutral set. Numbers are px unless noted.
export interface Style {
  layout?:     'row' | 'column' | 'inline';
  align?:      'start' | 'center' | 'end' | 'stretch';       // cross axis
  justify?:    'start' | 'center' | 'end' | 'between';       // main axis
  gap?: V; padding?: V; paddingX?: V; paddingY?: V;
  width?: V | 'fill' | 'hug'; height?: V | 'fill' | 'hug';
  minWidth?: V; minHeight?: V; maxWidth?: V;
  background?: V; color?: V;
  borderColor?: V; borderWidth?: V; radius?: V; shadow?: V;
  font?: V; fontSize?: V; fontWeight?: V; letterSpacing?: V; lineHeight?: V; textAlign?: 'start' | 'center' | 'end';
  opacity?: number; scale?: number;                          // scale → transform
  outlineColor?: V; outlineWidth?: V; outlineOffset?: V;     // focus rings
  cursor?: 'pointer' | 'text' | 'not-allowed' | 'default';
  overflow?: 'hidden' | 'visible';
  hide?: boolean;                                            // display: none (re-show by setting layout)
  position?: 'relative' | 'absolute';
  top?: V; right?: V; bottom?: V; left?: V; zIndex?: number;
  // Scrolling tracks (carousels): native horizontal scroll, optionally snapping slide-to-slide
  scroll?:    'x' | 'x-snap';
  scrollbar?: 'thin' | 'hidden';
  snapAlign?: 'start' | 'center';                            // where a child snaps in a snapping track
  basis?:     V;                                             // fixed share of a row/track: '85%', 280
  aspect?:    string;                                        // aspect ratio, e.g. '16 / 9'
  objectFit?: 'cover' | 'contain';                           // images
}

export interface Part {
  id:        string;                 // unique in the recipe — 'root', 'label', 'icon', …
  kind:      PartKind;
  style?:    Style;
  text?:     string;                 // literal, or "{prop.label}" to bind a prop
  when?:     string;                 // prop name — part only renders when that prop is truthy
  attrs?:    Record<string, string>; // element attributes: inputType, placeholder ("{prop.…}" allowed)
  slot?:     { label: string; accepts?: PartKind[] | 'any'; multiple?: boolean; required?: boolean };
  untilReady?: boolean;              // rendered `hidden` until its behavior's runtime attaches (progressive
                                     // enhancement: without JavaScript these controls simply never show)
  repeat?:   string;                 // name of a 'list' prop — this part renders once per item;
                                     // inside it (and its children) "{item.field}" binds that item
  states?:   Partial<Record<StateName, Style>>;  // this part's OWN states (e.g. a link's hover)
  children?: Part[];
}

export type ListItem = Record<string, string>;

export interface PropDef {
  name:     string;
  type:     'text' | 'boolean' | 'choice' | 'list';
  default:  string | boolean | ListItem[];
  options?: string[];                // for 'choice'
  fields?:  string[];                // for 'list' — each item's fields, e.g. ['label', 'href']
}

// Style deltas keyed by part id
export type PartStyles = Record<string, Style>;

export interface VariantAxis {
  name:    string;                   // 'variant', 'size'
  default: string;
  options: Record<string, PartStyles>;
}

export type StateName = 'hover' | 'press' | 'focus' | 'disabled' | 'checked' | 'open' | 'invalid' | 'current' | 'selected';

// Named interaction types. 'none' = static. Native-first: each maps to a built-in element
// (toggle → checkbox, disclosure → <details>, dialog → <dialog>, popover → popover attribute).
export type Behavior = 'none' | 'action' | 'navigate' | 'text-entry' | 'toggle' | 'choose-one'
                     | 'disclosure' | 'dialog' | 'popover' | 'tabs';

export interface BehaviorUse {
  type:    string;                         // key in lib/library/behaviors BEHAVIORS
  params?: Record<string, string>;         // emitted as data-<name> on the root; "{prop.x}" allowed
}

export type RecipeCategory = 'basics' | 'forms' | 'containers' | 'feedback' | 'overlays';

export interface Recipe {
  format:      2;
  key:         string;               // 'button' — stable id in the library
  version:     number;               // bumped when the library recipe changes
  name:        string;
  category:    RecipeCategory;
  description: string;
  behavior:    Behavior;
  props:       PropDef[];
  anatomy:     Part;                 // root part
  variants:    VariantAxis[];
  states:      Partial<Record<StateName, PartStyles>>;
  transition?: { duration: V; ease: V };   // applied to state changes
  // Mobile-first style deltas per wider tier (same tiers as layouts: ≥600 / ≥1024)
  responsive?: Partial<Record<'tablet' | 'desktop', PartStyles>>;
  // Runtime behaviors (lib/library/behaviors) — the JSON names a behavior + its settings, never code.
  // Settings may bind props ("{prop.loop}"); parts the runtime needs carry a `data-role` attr.
  behaviors?:  BehaviorUse[];
  set?:        string;               // which library set it ships in (see sets.ts)
}

// A project's own copy of a recipe. Owned by the project: edits never reach the library or
// other projects. `origin` allows an opt-in "update from library" later. Every placement of
// this component inside the project references this one copy.
export interface ProjectComponent {
  id:        string;
  projectId: string;
  origin:    { recipe: string; version: number; fromProject?: string };
  recipe:    Recipe;
  tags:      string[];
}

export function walkParts(part: Part, visit: (p: Part, parent: Part | null) => void, parent: Part | null = null) {
  visit(part, parent);
  part.children?.forEach((c) => walkParts(c, visit, part));
}
