"use client";

import { useLayoutEffect, useRef } from 'react';
import {
  ARTBOARD, GRID_COLUMNS,
  type Bible, type Block, type DesignPage, type FitReport, type KnowledgeKind, type TopicStatus,
} from '@/lib/design/types';

// Renders a DesignPage at its true artboard size (1920×1080 CSS px) — the parent scales it.
// Blocks carry no coordinates: they flow into a 12-column grid, `span` / `rows` size them.
// Whatever crosses the bottom edge is clipped and reported through onFit — one page means one page.
// With `edit`, clicks select blocks (links don't navigate) and the selected block gets a column-snapping resize handle.

export const INK = '#1f1b16', MUTED = '#6b6257', RULE = '#d8cfc0', PAPER = '#f4efe6', ACCENT = '#b4532a';
export const SERIF = 'Georgia, "Iowan Old Style", "Times New Roman", serif';
export const SANS  = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

export const STATUS_COLOR: Record<TopicStatus, string> = { decided: '#2f7d4f', hypothesis: '#c08a1e', blank: '#a59c8e' };
const KIND_COLOR: Record<KnowledgeKind, string> = { decision: '#2f7d4f', hypothesis: '#c08a1e', question: '#3b6ea8', evidence: '#6d5a8a' };
const TONE_COLOR = { pillar: ACCENT, note: '#3b6ea8', risk: '#a83b3b' } as const;

const PAD = 72, HEADER = 190, FOOTER = 44, COL_GAP = 40;
// Artboard px per grid column (column + gap) — the resize handle snaps to this
const COL_STEP = (ARTBOARD.width - 2 * PAD - (GRID_COLUMNS - 1) * COL_GAP) / GRID_COLUMNS + COL_GAP;

export interface ArtboardEdit {
  selected: string | null;
  onSelect: (blockId: string | null) => void;
  onSpan:   (blockId: string, span: number) => void;
  scale:    number;   // screen px per artboard px — converts handle drags into columns
}

interface Ctx {
  bibleId: string;
  bible:   Bible | null;
  page:    DesignPage;
  onOpen:  (pageId: string) => void;
}

export function DesignArtboard({ onFit, edit, ...ctx }: Ctx & { onFit?: (r: Omit<FitReport, 'at' | 'hash'>) => void; edit?: ArtboardEdit }) {
  const { page, bible } = ctx;
  const bodyRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const topic = page.topic ? bible?.topics.find((t) => t.id === page.topic) : undefined;

  useLayoutEffect(() => {
    const body = bodyRef.current, grid = gridRef.current;
    if (!body || !grid || !onFit) return;
    const measure = () => {
      const limit = body.clientHeight;
      const overflowing = Array.from(grid.children as HTMLCollectionOf<HTMLElement>)
        .filter((el) => el.offsetTop + el.offsetHeight > limit)
        .map((el) => el.dataset.block ?? '?');
      const overflowPx = Math.max(0, grid.scrollHeight - limit);
      onFit({ fits: overflowPx === 0 && overflowing.length === 0, overflowPx, overflowing });
    };
    measure();
    const ro = new ResizeObserver(measure);   // late images / fonts change heights
    ro.observe(grid);
    return () => ro.disconnect();
  }, [page, bible, onFit]);

  return (
    <div
      style={{ width: ARTBOARD.width, height: ARTBOARD.height, background: PAPER, color: INK, fontFamily: SANS, position: 'relative', overflow: 'hidden' }}
      onClick={edit ? () => edit.onSelect(null) : undefined}
    >
      <header style={{ height: HEADER, margin: `0 ${PAD}px`, padding: '56px 0 22px', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `2px solid ${INK}` }}>
        <div>
          {(page.kicker ?? topic?.group) && (
            <div style={{ fontSize: 17, letterSpacing: '0.22em', textTransform: 'uppercase', color: ACCENT, fontWeight: 600, marginBottom: 10 }}>
              {page.kicker ?? topic?.group}
            </div>
          )}
          <h1 style={{ fontFamily: SERIF, fontSize: 68, lineHeight: 1, margin: 0, fontWeight: 600 }}>{page.title}</h1>
        </div>
        <div style={{ textAlign: 'right', color: MUTED, fontSize: 18 }}>
          <div style={{ fontFamily: SERIF, fontSize: 24, color: INK }}>{bible?.title}</div>
          {topic && <StatusPill status={topic.status} />}
        </div>
      </header>

      <div ref={bodyRef} style={{ position: 'absolute', top: HEADER + 36, left: PAD, right: PAD, bottom: FOOTER + 12, overflow: 'hidden' }}>
        <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`, gap: `32px ${COL_GAP}px`, alignItems: 'start', position: 'relative' }}>
          {page.blocks.map((b) => (
            <section
              key={b.id}
              data-block={b.id}
              style={{
                gridColumn: `span ${clamp(b.span ?? GRID_COLUMNS, 1, GRID_COLUMNS)}`, gridRow: b.rows ? `span ${b.rows}` : undefined, minWidth: 0,
                position: 'relative',
                ...(edit && { cursor: 'pointer', outline: edit.selected === b.id ? `4px solid ${ACCENT}` : `2px dashed ${RULE}`, outlineOffset: 10 }),
              }}
              onClickCapture={edit ? (e) => { e.stopPropagation(); e.preventDefault(); edit.onSelect(b.id); } : undefined}
            >
              {edit?.selected === b.id && <SpanHandle block={b} edit={edit} />}
              {b.title && <h3 style={{ fontSize: 15, letterSpacing: '0.18em', textTransform: 'uppercase', color: MUTED, fontWeight: 700, margin: '0 0 14px', paddingBottom: 8, borderBottom: `1px solid ${RULE}` }}>{b.title}</h3>}
              <BlockBody block={b} ctx={ctx} />
            </section>
          ))}
        </div>
      </div>

      <footer style={{ position: 'absolute', left: PAD, right: PAD, bottom: 0, height: FOOTER, borderTop: `1px solid ${RULE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, color: MUTED, letterSpacing: '0.08em' }}>
        <span>{ctx.bibleId} / {topic?.id ?? 'index'}</span>
        <span>{page.updated ?? ''}</span>
      </footer>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

// Right-edge grip: drag sideways to change span, snapped to whole columns
function SpanHandle({ block, edit }: { block: Block; edit: ArtboardEdit }) {
  const start = useRef<{ x: number; span: number } | null>(null);
  return (
    <div
      title={`${block.span ?? GRID_COLUMNS} / ${GRID_COLUMNS} columns — drag to resize`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, span: block.span ?? GRID_COLUMNS };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const cols = Math.round((e.clientX - start.current.x) / (COL_STEP * edit.scale));
        const span = clamp(start.current.span + cols, 1, GRID_COLUMNS);
        if (span !== (block.span ?? GRID_COLUMNS)) edit.onSpan(block.id, span);
      }}
      onPointerUp={() => { start.current = null; }}
      style={{ position: 'absolute', top: '50%', right: -24, transform: 'translateY(-50%)', width: 20, height: 72, borderRadius: 10, background: ACCENT, cursor: 'ew-resize', zIndex: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
    />
  );
}

function StatusPill({ status }: { status: TopicStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '4px 14px', borderRadius: 999, border: `1.5px solid ${c}`, color: c, fontSize: 15, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
      <StatusDot status={status} size={10} /> {status}
    </span>
  );
}

function StatusDot({ status, size = 14 }: { status: TopicStatus; size?: number }) {
  const c = STATUS_COLOR[status];
  const style: React.CSSProperties = { width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'inline-block' };
  if (status === 'decided')    return <span style={{ ...style, background: c }} />;
  if (status === 'hypothesis') return <span style={{ ...style, border: `2px solid ${c}`, background: `linear-gradient(90deg, ${c} 50%, transparent 50%)` }} />;
  return <span style={{ ...style, border: `2px dashed ${c}` }} />;
}

const P: React.CSSProperties = { fontSize: 22, lineHeight: 1.5, margin: '0 0 12px' };

function BlockBody({ block: b, ctx }: { block: Block; ctx: Ctx }) {
  switch (b.type) {
    case 'text':
      return <>{b.body.split(/\n\s*\n/).map((para, i) => <p key={i} style={P}>{para}</p>)}</>;

    case 'bullets':
      return (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {b.items.map((it, i) => (
            <li key={i} style={{ ...P, display: 'flex', gap: 14, margin: '0 0 8px' }}>
              <span style={{ color: ACCENT, fontWeight: 700 }}>—</span><span>{it}</span>
            </li>
          ))}
        </ul>
      );

    case 'callout': {
      const c = TONE_COLOR[b.tone ?? 'pillar'];
      return (
        <div style={{ borderLeft: `6px solid ${c}`, background: `${c}12`, padding: '22px 28px', fontFamily: SERIF, fontSize: 30, lineHeight: 1.35 }}>
          {b.text}
        </div>
      );
    }

    case 'cards':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(b.items.length, 4) || 1}, 1fr)`, gap: 20 }}>
          {b.items.map((it, i) => (
            <div key={i} style={{ border: `1.5px solid ${RULE}`, borderTop: `4px solid ${ACCENT}`, background: '#fbf8f2', padding: '18px 20px' }}>
              <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, marginBottom: 8 }}>{it.title}</div>
              <div style={{ fontSize: 19, lineHeight: 1.45, color: MUTED }}>{it.body}</div>
            </div>
          ))}
        </div>
      );

    case 'flow':
      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            {b.steps.map((s, i) => (
              <div key={i} style={{ display: 'contents' }}>
                {i > 0 && <span style={{ fontSize: 28, color: ACCENT }}>→</span>}
                <div style={{ border: `2px solid ${INK}`, borderRadius: 999, padding: '10px 22px', fontSize: 21, fontWeight: 600, background: '#fbf8f2' }}>{s}</div>
              </div>
            ))}
          </div>
          {b.loop && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, color: ACCENT, fontSize: 17, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
              <span style={{ fontSize: 24 }}>↺</span> repeats from “{b.steps[0]}”
            </div>
          )}
        </div>
      );

    case 'stats':
      return (
        <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
          {b.items.map((it, i) => (
            <div key={i}>
              <div style={{ fontFamily: SERIF, fontSize: 52, lineHeight: 1, fontWeight: 600 }}>{it.value}</div>
              <div style={{ fontSize: 16, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, marginTop: 6 }}>{it.label}</div>
            </div>
          ))}
        </div>
      );

    case 'knowledge': {
      const entries = (ctx.page.knowledge ?? []).filter((k) =>
        (!b.ids || b.ids.includes(k.id)) && (!b.kinds || b.kinds.includes(k.kind)));
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {entries.map((k) => (
            <div key={k.id} style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
              <span style={{ flexShrink: 0, width: 128, fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: KIND_COLOR[k.kind] }}>{k.kind}</span>
              <div>
                <div style={{ fontSize: 21, lineHeight: 1.4 }}>{k.text}</div>
                {k.why && <div style={{ fontSize: 17, color: MUTED, marginTop: 2 }}>{k.why}</div>}
              </div>
            </div>
          ))}
        </div>
      );
    }

    case 'topics': {
      const topics = ctx.bible?.topics ?? [];
      const groups = b.groups ?? Array.from(new Set(topics.map((t) => t.group)));
      return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${groups.length || 1}, 1fr)`, gap: 24 }}>
          {groups.map((g) => (
            <div key={g}>
              <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 600, marginBottom: 10 }}>{g}</div>
              {topics.filter((t) => t.group === g).map((t) => (
                <div
                  key={t.id}
                  title={b.compact ? t.summary : undefined}
                  onClick={t.page ? () => ctx.onOpen(t.page!) : undefined}
                  style={{ display: 'flex', gap: 10, padding: b.compact ? '6px 0' : '8px 0', borderTop: `1px solid ${RULE}`, cursor: t.page ? 'pointer' : 'default' }}
                >
                  <span style={{ paddingTop: 5 }}><StatusDot status={t.status} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 600, textDecoration: t.page ? 'underline' : 'none', textDecorationColor: ACCENT, textUnderlineOffset: 4 }}>{t.title}</div>
                    {t.summary && !b.compact && (
                      <div style={{ fontSize: 15, lineHeight: 1.35, color: MUTED, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.summary}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }

    case 'links':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {b.items.map((it, i) => (
            <div key={i} onClick={() => ctx.onOpen(it.page)} style={{ cursor: 'pointer', border: `1.5px solid ${RULE}`, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline' }}>
              <span style={{ fontSize: 21, fontWeight: 600 }}>{it.label} <span style={{ color: ACCENT }}>↗</span></span>
              {it.note && <span style={{ fontSize: 16, color: MUTED }}>{it.note}</span>}
            </div>
          ))}
        </div>
      );

    case 'image':
      return (
        <figure style={{ margin: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/design?bible=${ctx.bibleId}&asset=${encodeURIComponent(b.src)}`}
            alt={b.caption ?? ''}
            style={{ width: '100%', height: b.height ?? 320, objectFit: b.fit ?? 'cover', display: 'block', background: '#e8e1d4' }}
          />
          {b.caption && <figcaption style={{ fontSize: 15, color: MUTED, marginTop: 8 }}>{b.caption}</figcaption>}
        </figure>
      );
  }
}
