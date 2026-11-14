// Design bible — files on disk (design/<bible>/), shared by the agent and the workbench.
//
//   design/<bible>/bible.json        — Bible: template + topic skeleton (status per topic)
//   design/<bible>/pages/<page>.json — DesignPage: knowledge layer + semantic blocks. "index" is the bible's one-pager
//   design/<bible>/assets/*          — images referenced by image blocks
//   design/<bible>/log.md            — per-session handoff (agent-written; not rendered)
//   design/<bible>/.render.json      — fit report written back by the canvas: does each page fit the artboard?
//
// Hand edits go through lib/design/ops.ts; every write (canvas or API) is checked by lib/design/validate.ts,
// and `npm run design:check` runs the same checks from the CLI.
//
// Pages hold MEANING (knowledge) and PRESENTATION separately. Presentation is either blocks (no x/y; the renderer
// lays them out on a 12-column grid inside the fixed artboard) or vector elements (lib/design/vector.ts).

import type { VElement } from './vector';
import type { VLayer } from './layers';

export const ARTBOARD = { width: 1920, height: 1080 } as const;
export const GRID_COLUMNS = 12;
export const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export type TopicStatus = 'blank' | 'hypothesis' | 'decided';

export interface Topic {
  id:      string;      // slug; also the page id once the topic gets a page
  group:   string;      // e.g. "Vision", "Play" — groups render in first-seen order
  title:   string;
  status:  TopicStatus;
  summary: string;      // one or two lines — the skeleton answer
  page?:   string;      // page id once a topic session has built it
}

export interface Bible {
  title:    string;
  template: 'game';
  pitch:    string;
  created:  string;     // ISO date
  topics:   Topic[];
}

// Where an element's `link` goes: a topic's id opens that topic's page, and goes nowhere until it has one; any other
// id is a page. Without a bible (a vault sheet) a link is taken as it is
export function linkTarget(link: string | undefined, bible: Bible | null | undefined): string | undefined {
  if (!link) return undefined;
  const topic = bible?.topics.find((t) => t.id === link);
  return topic ? topic.page : link;
}

export type KnowledgeKind = 'decision' | 'hypothesis' | 'question' | 'evidence';

export interface Knowledge {
  id:    string;
  kind:  KnowledgeKind;
  text:  string;
  why?:  string;        // rationale / what would change it
}

// Agent-facing recipe: what an agent working on this part of the project must know and obey
export interface AgentBrief {
  brief:  string;
  rules?: string[];
  open?:  string[];
}

interface BlockBase {
  id:     string;
  span?:  number;       // grid columns, 1–12 (default 12)
  rows?:  number;       // grid rows to span (default 1) — for a tall side column
  title?: string;
}

export type Block = BlockBase & (
  | { type: 'text';      body: string }                                     // blank line = new paragraph
  | { type: 'bullets';   items: string[] }
  | { type: 'callout';   text: string; tone?: 'pillar' | 'note' | 'risk' }
  | { type: 'cards';     items: { title: string; body: string }[] }         // pillars, options, characters…
  | { type: 'flow';      steps: string[]; loop?: boolean }                  // core loop, a pipeline, a beat sheet
  | { type: 'stats';     items: { label: string; value: string }[] }
  | { type: 'knowledge'; kinds?: KnowledgeKind[]; ids?: string[] }          // renders entries from page.knowledge
  | { type: 'topics';    groups?: string[]; compact?: boolean }             // the bible skeleton (index page); compact = titles only, summary on hover
  | { type: 'links';     items: { page: string; label: string; note?: string }[] }
  | { type: 'image';     src: string; caption?: string; fit?: 'cover' | 'contain'; height?: number }  // src: file in assets/
);

export type BlockType = Block['type'];

export interface DesignPage {
  title:      string;
  kicker?:    string;   // small label above the title (e.g. topic group)
  topic?:     string;   // topic id this page expands
  updated?:   string;
  knowledge?: Knowledge[];
  agent?:     AgentBrief;
  blocks:     Block[];  // [] on a vector page
  elements?:  VElement[];  // present = vector page: renders full-bleed as SVG, blocks ignored (lib/design/vector.ts)
  background?: string;  // vector page only; default paper
  size?:      { width: number; height: number };  // vector page only; default ARTBOARD. Large for big maps
  grid?:      { cell?: number; flat?: boolean };  // vector page only; placement grid new floor zones land on. Default 32px, isometric
  layers?:    VLayer[];  // vector page only; named layers, bottom to top (lib/design/layers.ts). Default one layer
}

// A vector page can be larger than the standard artboard. Block pages are always the artboard.
export const pageSize = (p?: Pick<DesignPage, 'size' | 'elements'> | null): { width: number; height: number } =>
  (p?.elements && p.size) || ARTBOARD;

export interface BibleSummary {
  id:    string;
  title: string;
  pages: { id: string; title: string }[];
}

export interface FitReport {
  fits:        boolean;
  overflowPx:  number;
  overflowing: string[];  // block ids that cross the bottom edge
  hash:        string;    // pageHash() of the page that was measured
  at:          string;
}
