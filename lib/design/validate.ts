// Design bible validation — shared by the API (rejects bad writes) and scripts/design-check.ts (agent self-check).
// Imports stay relative: the CLI runs this outside Next's `@/` alias.
// errors = the renderer would break or the data is wrong; warnings = dangling references, likely mistakes.

import { ARTBOARD, GRID_COLUMNS, SLUG, type BlockType, type KnowledgeKind, type TopicStatus } from './types';
import { outOfBounds, overlaps, PLANAR, ROTATABLE, visualBounds, type VElement, type VType } from './vector';
import { ASSET_KINDS, FOOTPRINT_MAX, type AssetKind } from './vault';
import { validateLayers } from './layers';

export interface Issues { errors: string[]; warnings: string[] }

// What the cross-file checks need to know about the rest of the bible
export interface BibleContext { pages: string[]; assets: string[]; topics?: string[]; vault?: string[] }

const STATUSES: TopicStatus[] = ['blank', 'hypothesis', 'decided'];
const KINDS: KnowledgeKind[] = ['decision', 'hypothesis', 'question', 'evidence'];
const TONES = ['pillar', 'note', 'risk'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const strArr = (v: unknown) => Array.isArray(v) && v.every(isStr);
const objArr = (v: unknown, keys: string[]) =>
  Array.isArray(v) && v.every((it) => isObj(it) && keys.every((k) => isStr(it[k])));

// Required fields per block type: [field, check, expected-shape description]
const SHAPES: Record<BlockType, [string, (v: unknown) => boolean, string][]> = {
  text:      [['body', isStr, 'string']],
  bullets:   [['items', strArr, 'string[]']],
  callout:   [['text', isStr, 'string']],
  cards:     [['items', (v) => objArr(v, ['title', 'body']), '{title, body}[]']],
  flow:      [['steps', strArr, 'string[]']],
  stats:     [['items', (v) => objArr(v, ['label', 'value']), '{label, value}[]']],
  knowledge: [],
  topics:    [],
  links:     [['items', (v) => objArr(v, ['page', 'label']), '{page, label, note?}[]']],
  image:     [['src', isStr, 'string']],
};

export function validatePage(raw: unknown, ctx?: BibleContext): Issues {
  const errors: string[] = [], warnings: string[] = [];
  if (!isObj(raw)) return { errors: ['page is not an object'], warnings };
  if (!isStr(raw.title) || !raw.title.trim()) errors.push('title: required string');
  if (!Array.isArray(raw.blocks)) return { errors: [...errors, 'blocks: required array'], warnings };

  const kIds = new Set<string>();
  if (raw.knowledge !== undefined) {
    if (!Array.isArray(raw.knowledge)) errors.push('knowledge: must be an array');
    else raw.knowledge.forEach((k, i) => {
      const at = `knowledge[${i}]`;
      if (!isObj(k)) return errors.push(`${at}: not an object`);
      if (!isStr(k.id)) errors.push(`${at}.id: required string`);
      else if (kIds.has(k.id)) errors.push(`${at}.id: duplicate "${k.id}"`);
      else kIds.add(k.id);
      if (!KINDS.includes(k.kind as KnowledgeKind)) errors.push(`${at}.kind: one of ${KINDS.join(' | ')}`);
      if (!isStr(k.text)) errors.push(`${at}.text: required string`);
    });
  }

  const ids = new Set<string>();
  raw.blocks.forEach((b, i) => {
    const at = `blocks[${i}]`;
    if (!isObj(b)) return errors.push(`${at}: not an object`);
    const name = isStr(b.id) ? `${at} "${b.id}"` : at;
    if (!isStr(b.id) || !b.id) errors.push(`${at}.id: required string`);
    else if (ids.has(b.id)) errors.push(`${name}: duplicate id`);
    else ids.add(b.id);

    const shape = SHAPES[b.type as BlockType];
    if (!shape) return errors.push(`${name}.type: unknown "${String(b.type)}" (${Object.keys(SHAPES).join(', ')})`);
    for (const [field, ok, desc] of shape) if (!ok(b[field])) errors.push(`${name}.${field}: must be ${desc}`);

    if (b.span !== undefined && !(Number.isInteger(b.span) && (b.span as number) >= 1 && (b.span as number) <= GRID_COLUMNS))
      errors.push(`${name}.span: integer 1–${GRID_COLUMNS}`);
    if (b.rows !== undefined && !(Number.isInteger(b.rows) && (b.rows as number) >= 1)) errors.push(`${name}.rows: integer ≥ 1`);
    if (b.title !== undefined && !isStr(b.title)) errors.push(`${name}.title: must be string`);
    if (b.type === 'callout' && b.tone !== undefined && !TONES.includes(b.tone as string)) errors.push(`${name}.tone: one of ${TONES.join(' | ')}`);

    if (b.type === 'knowledge' && strArr(b.ids)) {
      for (const k of b.ids as string[]) if (!kIds.has(k)) warnings.push(`${name}: knowledge id "${k}" not on this page`);
    }
    if (b.type === 'knowledge' && !kIds.size) warnings.push(`${name}: page has no knowledge entries to show`);
    if (ctx && b.type === 'links' && Array.isArray(b.items)) {
      for (const it of b.items as Obj[]) if (isStr(it.page) && !ctx.pages.includes(it.page)) warnings.push(`${name}: links to unbuilt page "${it.page}"`);
    }
    if (ctx && b.type === 'image' && isStr(b.src) && !ctx.assets.includes(b.src)) warnings.push(`${name}: asset "${b.src}" not in assets/`);
  });
  const pos = (v: unknown) => num(v) && (v as number) > 0;
  const size = isObj(raw.size) && pos(raw.size.width) && pos(raw.size.height) ? raw.size as { width: number; height: number } : null;
  if (raw.size !== undefined && !size) errors.push('size: {width, height}, both positive');
  if (raw.grid !== undefined && !(isObj(raw.grid) && (raw.grid.cell === undefined || pos(raw.grid.cell)))) errors.push('grid: {cell?, flat?}');
  if (raw.elements !== undefined) validateElements(raw.elements, ctx, errors, warnings, size ?? ARTBOARD);
  validateLayers(raw, errors, warnings);
  return { errors, warnings };
}

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const BOX = ['x', 'y', 'w', 'h'];
const NUMERIC: Record<VType, string[]> = { rect: BOX, ellipse: BOX, capsule: BOX, poly: BOX, text: BOX, image: BOX, line: [], stroke: [], status: ['x', 'y'], zone: ['x', 'y', 'cols', 'rows', 'cell'], asset: BOX };

function validateElements(raw: unknown, ctx: BibleContext | undefined, errors: string[], warnings: string[], sheet: { width: number; height: number }) {
  if (!Array.isArray(raw)) { errors.push('elements: must be an array'); return; }
  const ids = new Set<string>();
  raw.forEach((e) => { if (isObj(e) && isStr(e.id)) ids.add(e.id); });
  const seen = new Set<string>();
  let shapesOk = true;

  raw.forEach((e, i) => {
    const at = `elements[${i}]`;
    if (!isObj(e)) { shapesOk = false; return errors.push(`${at}: not an object`); }
    const name = isStr(e.id) ? `${at} "${e.id}"` : at;
    const before = errors.length;
    if (!isStr(e.id) || !e.id) errors.push(`${at}.id: required string`);
    else if (seen.has(e.id)) errors.push(`${name}: duplicate id`);
    else seen.add(e.id);

    const fields = NUMERIC[e.type as VType];
    if (!fields) { shapesOk = false; return errors.push(`${name}.type: unknown "${String(e.type)}" (${Object.keys(NUMERIC).join(', ')})`); }
    for (const f of fields) if (!num(e[f])) errors.push(`${name}.${f}: required number`);
    if (e.name !== undefined && !isStr(e.name)) errors.push(`${name}.name: string`);
    if (e.rotate !== undefined && !num(e.rotate)) errors.push(`${name}.rotate: number of degrees`);
    else if (e.rotate && !ROTATABLE.includes(e.type as VType)) warnings.push(`${name}.rotate: ${String(e.type)} can't rotate (ignored)`);

    if (e.plane !== undefined) {
      if (!['floor', 'roof', 'left', 'right'].includes(e.plane as string)) errors.push(`${name}.plane: floor | roof | left | right`);
      else if (!PLANAR.includes(e.type as VType)) warnings.push(`${name}.plane: ${String(e.type)} can't lie in a plane (ignored)`);
    }
    if (e.on !== undefined && (typeof e.on !== 'string' || !raw.some((z) => isObj(z) && z.type === 'zone' && z.id === e.on))) warnings.push(`${name}.on: id of a zone on this page`);
    if (e.upright !== undefined && typeof e.upright !== 'boolean') errors.push(`${name}.upright: boolean`);
    if (e.base !== undefined && !num(e.base)) errors.push(`${name}.base: px above the floor`);
    if (e.mirror !== undefined && typeof e.mirror !== 'boolean') errors.push(`${name}.mirror: boolean`);
    if (e.turn !== undefined && !num(e.turn)) errors.push(`${name}.turn: degrees`);
    if (e.height !== undefined && !(num(e.height) && (e.height as number) >= 0)) errors.push(`${name}.height: px of extrusion, 0 or more`);
    else if (e.height && !(['rect', 'ellipse', 'capsule', 'poly'].includes(e.type as string) && (e.plane === 'floor' || e.plane === 'roof'))) warnings.push(`${name}.height: only a rect, ellipse, capsule or polygon on the floor or a roof extrudes (ignored)`);
    if (e.lift !== undefined && !num(e.lift)) errors.push(`${name}.lift: number of px above the floor`);
    if (e.slope !== undefined && !(num(e.slope) && Math.abs(e.slope as number) < 1)) errors.push(`${name}.slope: number between -1 and 1 (rise per px)`);
    if (e.slopeAlong !== undefined && e.slopeAlong !== 'w' && e.slopeAlong !== 'h') errors.push(`${name}.slopeAlong: w | h`);
    if (e.type === 'ellipse' && e.n !== undefined && !(num(e.n) && (e.n as number) > 0)) errors.push(`${name}.n: positive number (2 = ellipse)`);
    if (e.type === 'poly' && !(Array.isArray(e.pts) && e.pts.length >= 2 && e.pts.every((p) => Array.isArray(p) && num(p[0]) && num(p[1]) && p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1)))
      errors.push(`${name}.pts: at least 2 [x, y] corners, each a fraction 0–1 of the box`);
    if (e.type === 'capsule' && e.taper !== undefined && !(num(e.taper) && (e.taper as number) > 0 && (e.taper as number) <= 1)) errors.push(`${name}.taper: number in (0, 1]`);
    if (e.type === 'text') {
      if (!isStr(e.text)) errors.push(`${name}.text: required string`);
      if (e.bind !== undefined) {
        if (!isObj(e.bind) || !isStr(e.bind.topic) || !['title', 'summary'].includes(e.bind.field as string)) errors.push(`${name}.bind: {topic, field: title | summary}`);
        else if (ctx?.topics && !ctx.topics.includes(e.bind.topic)) warnings.push(`${name}: bound to unknown topic "${e.bind.topic}"`);
      }
    }
    if (e.type === 'image') {
      if (!isStr(e.src)) errors.push(`${name}.src: required string`);
      else if (ctx && !ctx.assets.includes(e.src)) warnings.push(`${name}: asset "${e.src}" not in assets/`);
    }
    if (e.type === 'asset') {
      if (!isStr(e.asset)) errors.push(`${name}.asset: required string`);
      else if (ctx?.vault && !ctx.vault.includes(e.asset)) warnings.push(`${name}: "${e.asset}" not in vault/assets/`);
      if (e.layers !== undefined && !strArr(e.layers)) errors.push(`${name}.layers: string[] of the asset's layer ids`);
    }
    if (e.type === 'status') {
      if (!isStr(e.topic)) errors.push(`${name}.topic: required string`);
      else if (ctx?.topics && !ctx.topics.includes(e.topic)) warnings.push(`${name}: unknown topic "${e.topic}"`);
    }
    if (e.type === 'stroke' && !(Array.isArray(e.points) && e.points.length > 0 && e.points.every((p) => Array.isArray(p) && num(p[0]) && num(p[1])))) {
      errors.push(`${name}.points: non-empty [x, y][]`);
    }
    if (e.type === 'zone') {
      for (const f of ['cols', 'rows'] as const) if (!(Number.isInteger(e[f]) && (e[f] as number) >= 1)) errors.push(`${name}.${f}: whole number, at least 1`);
      if (!(num(e.cell) && (e.cell as number) > 0)) errors.push(`${name}.cell: positive number`);
    }
    if (e.type === 'line') {
      for (const end of ['from', 'to'] as const) {
        const a = e[end];
        if (isObj(a) && isStr(a.el)) { if (!ids.has(a.el)) warnings.push(`${name}.${end}: attached to missing element "${a.el}"`); }
        else if (!(isObj(a) && num(a.x) && num(a.y))) errors.push(`${name}.${end}: {x, y} or {el}`);
      }
    }
    if (e.link !== undefined) {
      if (!isStr(e.link) || !SLUG.test(e.link)) errors.push(`${name}.link: page id`);
      else if (ctx && !ctx.pages.includes(e.link) && !ctx.topics?.includes(e.link)) warnings.push(`${name}: links to unknown page "${e.link}"`);  // a topic is a page still to come
    }
    if (errors.length > before) shapesOk = false;
  });
  if (!shapesOk) return;

  // Geometry checks stand in for eyes: the agent can't see the page, so report what would look wrong
  const els = raw as VElement[];
  const box = new Map(els.map((e) => [e.id, visualBounds(e, els)]));
  for (const e of els) if (e.type !== 'line' && outOfBounds(box.get(e.id)!, sheet)) warnings.push(`"${e.id}": outside the page`);
  const texts = els.filter((e) => e.type === 'text');
  texts.forEach((a, i) => texts.slice(i + 1).forEach((b) => {
    if (overlaps(box.get(a.id)!, box.get(b.id)!)) warnings.push(`text "${a.id}" overlaps text "${b.id}"`);
  }));
}

// A vault asset is a vector page with a kind. It can't hold anything that needs a bible or another asset.
const NOT_IN_ASSET: VType[] = ['asset', 'image', 'status'];

export function validateAsset(raw: unknown): Issues {
  const { errors, warnings } = validatePage(raw);
  if (!isObj(raw)) return { errors, warnings };
  if (!ASSET_KINDS.includes(raw.kind as AssetKind)) errors.push(`kind: one of ${ASSET_KINDS.join(' | ')}`);
  const tiles = (v: unknown) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= FOOTPRINT_MAX;
  if (raw.footprint !== undefined && !(isObj(raw.footprint) && tiles(raw.footprint.cols) && tiles(raw.footprint.rows)))
    errors.push(`footprint: {cols, rows}, whole numbers 1–${FOOTPRINT_MAX}`);
  if (raw.dims !== undefined) {
    const d = raw.dims, list = (v: unknown) => Array.isArray(v) && v.length >= 1 && v.length <= 3 && v.every((n) => num(n) && n > 0);
    if (!isObj(d) || !list(d.in) || (d.mm !== undefined && !list(d.mm)) || (d.estimated !== undefined && typeof d.estimated !== 'boolean') || (d.note !== undefined && !isStr(d.note)))
      errors.push('dims: {in: [l, w?, h?], mm?: [...], estimated?: boolean, note?: string}, positive numbers');
  }
  if (!Array.isArray(raw.elements)) errors.push('elements: required array');
  else raw.elements.forEach((e, i) => {
    if (isObj(e) && NOT_IN_ASSET.includes(e.type as VType)) errors.push(`elements[${i}]: a vault asset can't contain "${String(e.type)}"`);
    if (isObj(e) && e.type === 'text' && e.bind !== undefined) errors.push(`elements[${i}].bind: a vault asset isn't part of a bible`);
    if (isObj(e) && e.link !== undefined) errors.push(`elements[${i}].link: a vault asset can't link to a page`);
  });
  return { errors, warnings };
}

export function validateBible(raw: unknown, ctx?: BibleContext): Issues {
  const errors: string[] = [], warnings: string[] = [];
  if (!isObj(raw)) return { errors: ['bible is not an object'], warnings };
  for (const f of ['title', 'pitch', 'created'] as const) if (!isStr(raw[f])) errors.push(`${f}: required string`);
  if (raw.template !== 'game') errors.push('template: "game"');
  if (!Array.isArray(raw.topics)) return { errors: [...errors, 'topics: required array'], warnings };

  const ids = new Set<string>();
  raw.topics.forEach((t, i) => {
    const at = `topics[${i}]`;
    if (!isObj(t)) return errors.push(`${at}: not an object`);
    const name = isStr(t.id) ? `${at} "${t.id}"` : at;
    if (!isStr(t.id) || !SLUG.test(t.id)) errors.push(`${at}.id: kebab-case slug`);
    else if (ids.has(t.id)) errors.push(`${name}: duplicate id`);
    else ids.add(t.id);
    for (const f of ['group', 'title', 'summary'] as const) if (!isStr(t[f])) errors.push(`${name}.${f}: required string`);
    if (!STATUSES.includes(t.status as TopicStatus)) errors.push(`${name}.status: one of ${STATUSES.join(' | ')}`);
    if (t.page !== undefined && t.page !== null) {
      if (!isStr(t.page) || !SLUG.test(t.page)) errors.push(`${name}.page: slug`);
      else if (ctx && !ctx.pages.includes(t.page)) warnings.push(`${name}: page "${t.page}" not built`);
    }
  });
  if (ctx && !ctx.pages.includes('index')) warnings.push('no pages/index.json yet');
  return { errors, warnings };
}

// Content fingerprint (FNV-1a over the JSON) — ties a fit report to the exact page it measured,
// so a report for an older version of the page can't pass as current.
export function pageHash(page: unknown): string {
  const s = JSON.stringify(page);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}
