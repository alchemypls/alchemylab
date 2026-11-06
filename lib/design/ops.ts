// Design page edit operations — pure DesignPage/Bible → new copy. The Ideation canvas's editor is built
// only from these, so every hand edit is one of a small, named set (and an agent could replay the same ops).

import { GRID_COLUMNS, type Bible, type Block, type BlockType, type DesignPage, type Knowledge, type Topic } from './types';

const rid = () => Math.random().toString(36).slice(2, 6);

// Smallest valid block of each type — what "Add block" inserts
export const BLOCK_DEFAULTS: { [T in BlockType]: Omit<Extract<Block, { type: T }>, 'id'> } = {
  text:      { type: 'text', body: 'Write something.' },
  bullets:   { type: 'bullets', items: ['First point'] },
  callout:   { type: 'callout', text: 'One key statement.', tone: 'pillar' },
  cards:     { type: 'cards', items: [{ title: 'Card', body: 'Description' }] },
  flow:      { type: 'flow', steps: ['Start', 'Then', 'End'] },
  stats:     { type: 'stats', items: [{ label: 'Label', value: '0' }] },
  knowledge: { type: 'knowledge' },
  topics:    { type: 'topics' },
  links:     { type: 'links', items: [] },
  image:     { type: 'image', src: '' },
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  text: 'Text', bullets: 'Bullets', callout: 'Callout', cards: 'Cards', flow: 'Flow', stats: 'Stats',
  knowledge: 'Knowledge', topics: 'Topics', links: 'Links', image: 'Image',
};

const blocks = (p: DesignPage, fn: (b: Block[]) => Block[]): DesignPage => ({ ...p, blocks: fn(p.blocks) });

export function setPageField(p: DesignPage, patch: Partial<Pick<DesignPage, 'title' | 'kicker'>>): DesignPage {
  return { ...p, ...patch };
}

// Inserts after `afterId` (or at the end); returns the new block's id with the page
export function addBlock(p: DesignPage, type: BlockType, afterId?: string): { page: DesignPage; id: string } {
  const id = `${type}-${rid()}`;
  const block = { ...structuredClone(BLOCK_DEFAULTS[type]), id } as Block;
  const i = afterId ? p.blocks.findIndex((b) => b.id === afterId) : -1;
  return { id, page: blocks(p, (bs) => (i < 0 ? [...bs, block] : [...bs.slice(0, i + 1), block, ...bs.slice(i + 1)])) };
}

export function updateBlock(p: DesignPage, id: string, patch: Partial<Block>): DesignPage {
  return blocks(p, (bs) => bs.map((b) => (b.id === id ? ({ ...b, ...patch, id, type: b.type } as Block) : b)));
}

export function resizeBlock(p: DesignPage, id: string, span: number): DesignPage {
  return updateBlock(p, id, { span: Math.max(1, Math.min(GRID_COLUMNS, Math.round(span))) });
}

export function moveBlock(p: DesignPage, id: string, delta: -1 | 1): DesignPage {
  const i = p.blocks.findIndex((b) => b.id === id), j = i + delta;
  if (i < 0 || j < 0 || j >= p.blocks.length) return p;
  return blocks(p, (bs) => { const out = [...bs]; [out[i], out[j]] = [out[j], out[i]]; return out; });
}

export function duplicateBlock(p: DesignPage, id: string): { page: DesignPage; id: string } {
  const i = p.blocks.findIndex((b) => b.id === id);
  if (i < 0) return { page: p, id };
  const copy = { ...structuredClone(p.blocks[i]), id: `${p.blocks[i].type}-${rid()}` };
  return { id: copy.id, page: blocks(p, (bs) => [...bs.slice(0, i + 1), copy, ...bs.slice(i + 1)]) };
}

export function removeBlock(p: DesignPage, id: string): DesignPage {
  return blocks(p, (bs) => bs.filter((b) => b.id !== id));
}

// ── Knowledge layer ─────────────────────────────────────────────

export function addKnowledge(p: DesignPage, kind: Knowledge['kind']): DesignPage {
  return { ...p, knowledge: [...(p.knowledge ?? []), { id: `k-${rid()}`, kind, text: '' }] };
}

export function updateKnowledge(p: DesignPage, id: string, patch: Partial<Knowledge>): DesignPage {
  return { ...p, knowledge: (p.knowledge ?? []).map((k) => (k.id === id ? { ...k, ...patch, id } : k)) };
}

export function removeKnowledge(p: DesignPage, id: string): DesignPage {
  return { ...p, knowledge: (p.knowledge ?? []).filter((k) => k.id !== id) };
}

// ── Bible ───────────────────────────────────────────────────────

export function updateTopic(b: Bible, id: string, patch: Partial<Omit<Topic, 'id'>>): Bible {
  return { ...b, topics: b.topics.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
}
