"use client";

import { useEffect, useRef, useState } from 'react';
import { TextInput } from './TextInput';
import { SectionLabel } from './SectionLabel';
import { Toggle } from './Toggle';
import { STATUS_COLOR } from './DesignArtboard';
import {
  BLOCK_LABELS, addBlock, addKnowledge, duplicateBlock, moveBlock, removeBlock, removeKnowledge,
  resizeBlock, setPageField, updateBlock, updateKnowledge, updateTopic,
} from '@/lib/design/ops';
import {
  GRID_COLUMNS,
  type Bible, type Block, type BlockType, type DesignPage, type KnowledgeKind, type TopicStatus,
} from '@/lib/design/types';

// Block page editor side panel. Every change goes through lib/design/ops.ts and comes back as a new page
// via `apply` (useDesignEditor owns undo + saving). `key` groups keystrokes on one field into one undo step.

type Apply = (next: DesignPage, key?: string) => void;

interface Props {
  page:      DesignPage;
  bible:     Bible | null;
  selected:  string | null;
  apply:     Apply;
  select:    (id: string | null) => void;
  saveBible: (b: Bible) => void;
}

const KINDS: KnowledgeKind[] = ['decision', 'hypothesis', 'question', 'evidence'];
const STATUSES: TopicStatus[] = ['blank', 'hypothesis', 'decided'];
const AREA = 'w-full bg-neutral-800 text-neutral-200 text-xs px-2 py-1.5 rounded border border-neutral-700 focus:outline-none focus:border-amber-700 resize-y font-sans leading-snug';
const SEL  = 'bg-neutral-800 text-neutral-200 text-xs px-1.5 py-1 rounded border border-neutral-700 focus:outline-none';
const BTN  = 'text-[11px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30';

export function DesignInspector(props: Props) {
  const block = props.page.blocks.find((b) => b.id === props.selected);
  return (
    <div className="p-3 flex flex-col gap-4 text-xs text-neutral-300">
      {block ? <BlockPanel {...props} block={block} /> : <PagePanel {...props} />}
    </div>
  );
}

// ── Page (nothing selected) ─────────────────────────────────────

function PagePanel({ page, apply, select, selected }: Props) {
  return (
    <>
      <Field label="Page title">
        <TextInput className="w-full" value={page.title} onChange={(v) => apply(setPageField(page, { title: v }), 'page:title')} />
      </Field>
      <Field label="Kicker">
        <TextInput className="w-full" value={page.kicker ?? ''} placeholder="defaults to the topic group" onChange={(v) => apply(setPageField(page, { kicker: v || undefined }), 'page:kicker')} />
      </Field>
      <AddBlock page={page} apply={apply} select={select} after={selected} />
      <KnowledgeEditor page={page} apply={apply} />
      <p className="text-[10px] text-neutral-500 leading-relaxed">Click a block on the page to edit it. Drag the orange grip on its right edge to resize.</p>
    </>
  );
}

function AddBlock({ page, apply, select, after }: { page: DesignPage; apply: Apply; select: (id: string) => void; after?: string | null }) {
  return (
    <Field label={after ? 'Add block after this' : 'Add block'}>
      <div className="grid grid-cols-3 gap-1">
        {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => (
          <button key={t} className={BTN} onClick={() => { const r = addBlock(page, t, after ?? undefined); apply(r.page); select(r.id); }}>
            {BLOCK_LABELS[t]}
          </button>
        ))}
      </div>
    </Field>
  );
}

function KnowledgeEditor({ page, apply }: { page: DesignPage; apply: Apply }) {
  const entries = page.knowledge ?? [];
  return (
    <Field label={`Knowledge (${entries.length})`}>
      <div className="flex flex-col gap-2">
        {entries.map((k) => (
          <div key={k.id} className="flex flex-col gap-1 border border-neutral-800 rounded p-1.5">
            <div className="flex gap-1">
              <select className={`${SEL} flex-1`} value={k.kind} onChange={(e) => apply(updateKnowledge(page, k.id, { kind: e.target.value as KnowledgeKind }))}>
                {KINDS.map((x) => <option key={x}>{x}</option>)}
              </select>
              <button className={BTN} onClick={() => apply(removeKnowledge(page, k.id))}>✕</button>
            </div>
            <textarea className={AREA} rows={2} value={k.text} placeholder="statement" onChange={(e) => apply(updateKnowledge(page, k.id, { text: e.target.value }), `k:${k.id}:text`)} />
            <textarea className={AREA} rows={1} value={k.why ?? ''} placeholder="why / what would change it" onChange={(e) => apply(updateKnowledge(page, k.id, { why: e.target.value || undefined }), `k:${k.id}:why`)} />
          </div>
        ))}
        <div className="flex gap-1 flex-wrap">
          {KINDS.map((x) => <button key={x} className={BTN} onClick={() => apply(addKnowledge(page, x))}>+ {x}</button>)}
        </div>
      </div>
    </Field>
  );
}

// ── Selected block ──────────────────────────────────────────────

function BlockPanel({ page, bible, apply, select, saveBible, block: b }: Props & { block: Block }) {
  const set = (patch: Partial<Block>, key?: string) => apply(updateBlock(page, b.id, patch), key && `${b.id}:${key}`);
  const i = page.blocks.indexOf(b);
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-amber-500">{BLOCK_LABELS[b.type]}</span>
        <div className="flex gap-1">
          <button className={BTN} disabled={i === 0} title="Move earlier" onClick={() => apply(moveBlock(page, b.id, -1))}>↑</button>
          <button className={BTN} disabled={i === page.blocks.length - 1} title="Move later" onClick={() => apply(moveBlock(page, b.id, 1))}>↓</button>
          <button className={BTN} title="Duplicate" onClick={() => { const r = duplicateBlock(page, b.id); apply(r.page); select(r.id); }}>⧉</button>
          <button className={BTN} title="Delete" onClick={() => { apply(removeBlock(page, b.id)); select(null); }}>✕</button>
          <button className={BTN} title="Back to page" onClick={() => select(null)}>Done</button>
        </div>
      </div>

      <Field label="Heading">
        <TextInput className="w-full" value={b.title ?? ''} placeholder="none" onChange={(v) => set({ title: v || undefined }, 'title')} />
      </Field>

      <Field label={`Width — ${b.span ?? GRID_COLUMNS} / ${GRID_COLUMNS} columns`}>
        <div className="flex items-center gap-2">
          <input type="range" min={1} max={GRID_COLUMNS} value={b.span ?? GRID_COLUMNS} className="flex-1 accent-amber-600"
            onChange={(e) => apply(resizeBlock(page, b.id, Number(e.target.value)), `${b.id}:span`)} />
          <label className="flex items-center gap-1 text-[10px] text-neutral-500" title="Grid rows this block spans (a tall side column)">
            rows
            <input type="number" min={1} max={6} value={b.rows ?? 1} className={`${SEL} w-11`}
              onChange={(e) => set({ rows: Number(e.target.value) > 1 ? Number(e.target.value) : undefined })} />
          </label>
        </div>
      </Field>

      <TypeFields block={b} set={set} bible={bible} saveBible={saveBible} />
      <AddBlock page={page} apply={apply} select={select} after={b.id} />
    </>
  );
}

function TypeFields({ block: b, set, bible, saveBible }: {
  block: Block; set: (patch: Partial<Block>, key?: string) => void; bible: Bible | null; saveBible: (b: Bible) => void;
}) {
  switch (b.type) {
    case 'text':
      return <Field label="Body (blank line = new paragraph)"><textarea className={AREA} rows={8} value={b.body} onChange={(e) => set({ body: e.target.value }, 'body')} /></Field>;

    case 'bullets':
      return <Field label="Items — one per line"><LinesField value={b.items.join('\n')} onChange={(v) => set({ items: lines(v) }, 'items')} /></Field>;

    case 'callout':
      return (
        <>
          <Field label="Text"><textarea className={AREA} rows={4} value={b.text} onChange={(e) => set({ text: e.target.value }, 'text')} /></Field>
          <Field label="Tone">
            <select className={SEL} value={b.tone ?? 'pillar'} onChange={(e) => set({ tone: e.target.value as 'pillar' })}>
              <option>pillar</option><option>note</option><option>risk</option>
            </select>
          </Field>
        </>
      );

    case 'cards':
      return (
        <Field label="Cards — Title: body, one per line">
          <LinesField value={b.items.map((c) => `${c.title}: ${c.body}`).join('\n')}
            onChange={(v) => set({ items: lines(v).map((l) => { const [title, body] = splitOnce(l, ':'); return { title, body }; }) }, 'items')} />
        </Field>
      );

    case 'flow':
      return (
        <>
          <Field label="Steps — one per line"><LinesField value={b.steps.join('\n')} onChange={(v) => set({ steps: lines(v) }, 'steps')} /></Field>
          <label className="flex items-center gap-2"><Toggle size="sm" on={!!b.loop} onToggle={() => set({ loop: !b.loop || undefined })} /> Loops back to the first step</label>
        </>
      );

    case 'stats':
      return (
        <Field label="Stats — Label: value, one per line">
          <LinesField value={b.items.map((s) => `${s.label}: ${s.value}`).join('\n')}
            onChange={(v) => set({ items: lines(v).map((l) => { const [label, value] = splitOnce(l, ':'); return { label, value }; }) }, 'items')} />
        </Field>
      );

    case 'knowledge':
      return (
        <>
          <Field label="Show kinds (none ticked = all)">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {KINDS.map((k) => (
                <label key={k} className="flex items-center gap-1">
                  <input type="checkbox" checked={!!b.kinds?.includes(k)} onChange={(e) => {
                    const kinds = e.target.checked ? [...(b.kinds ?? []), k] : (b.kinds ?? []).filter((x) => x !== k);
                    set({ kinds: kinds.length ? kinds : undefined });
                  }} />
                  {k}
                </label>
              ))}
            </div>
          </Field>
          <p className="text-[10px] text-neutral-500">Entries are page-level. Click empty paper to edit them.</p>
        </>
      );

    case 'topics':
      if (!bible) return null;
      return (
        <Field label="Topics (saved to bible.json)">
          <label className="flex items-center gap-2 mb-1"><Toggle size="sm" on={!!b.compact} onToggle={() => set({ compact: !b.compact || undefined })} /> Compact: titles only, summary on hover</label>
          <div className="flex flex-col gap-2">
            {bible.topics.map((t) => (
              <div key={t.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLOR[t.status] }} />
                  <span className="flex-1 truncate" title={`${t.group} / ${t.id}`}>{t.title}</span>
                  <select className={SEL} value={t.status} onChange={(e) => saveBible(updateTopic(bible, t.id, { status: e.target.value as TopicStatus }))}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <BlurArea value={t.summary} placeholder="one-line summary" onCommit={(v) => saveBible(updateTopic(bible, t.id, { summary: v }))} />
              </div>
            ))}
          </div>
        </Field>
      );

    case 'links':
      return (
        <Field label="Links — page | label | note, one per line">
          <LinesField value={b.items.map((l) => [l.page, l.label, l.note].filter(Boolean).join(' | ')).join('\n')}
            onChange={(v) => set({ items: lines(v).map((l) => { const [pg = '', label = '', note] = l.split('|').map((s) => s.trim()); return { page: pg, label: label || pg, ...(note && { note }) }; }) }, 'items')} />
        </Field>
      );

    case 'image':
      return (
        <>
          <Field label="File in assets/"><TextInput className="w-full" value={b.src} onChange={(v) => set({ src: v }, 'src')} /></Field>
          <Field label="Caption"><TextInput className="w-full" value={b.caption ?? ''} onChange={(v) => set({ caption: v || undefined }, 'caption')} /></Field>
          <div className="flex gap-2">
            <Field label="Height px">
              <input type="number" min={60} step={20} className={`${SEL} w-20`} value={b.height ?? 320} onChange={(e) => set({ height: Number(e.target.value) }, 'height')} />
            </Field>
            <Field label="Fit">
              <select className={SEL} value={b.fit ?? 'cover'} onChange={(e) => set({ fit: e.target.value as 'cover' })}><option>cover</option><option>contain</option></select>
            </Field>
          </div>
        </>
      );
  }
}

// ── Bits ────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><SectionLabel size="sm" className="!mb-0">{label}</SectionLabel>{children}</div>;
}

const lines = (v: string) => v.split('\n').map((l) => l.trim()).filter(Boolean);
function splitOnce(s: string, sep: string): [string, string] {
  const i = s.indexOf(sep);
  return i < 0 ? [s.trim(), ''] : [s.slice(0, i).trim(), s.slice(i + 1).trim()];
}

// One-item-per-line textarea. Keeps the raw text while focused, so empty lines and half-typed
// "Title:" survive the parse → serialize round trip; resyncs from the page when not focused.
function LinesField({ value, onChange }: { value: string; onChange: (raw: string) => void }) {
  const [raw, setRaw] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setRaw(value); }, [value]);
  return (
    <textarea
      className={AREA} rows={Math.min(10, Math.max(3, raw.split('\n').length + 1))} value={raw}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setRaw(value); }}
      onChange={(e) => { setRaw(e.target.value); onChange(e.target.value); }}
    />
  );
}

// Saves on blur — bible writes aren't part of page undo, so don't send one per keystroke
function BlurArea({ value, placeholder, onCommit }: { value: string; placeholder?: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <textarea className={AREA} rows={1} value={v} placeholder={placeholder}
      onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onCommit(v); }} />
  );
}
