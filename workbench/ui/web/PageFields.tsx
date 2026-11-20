"use client";

import { useWorkbenchStore } from '@/lib/store';
import { Toggle } from '@/workbench/ui/Toggle';
import { PAGE_STATUSES, derivePageStatus, safeBackdrop, sectionId, type PageDef, type PageHead, type PageStatus, type ProjectData } from '@/lib/project';

// One page's planning fields (what the Ledger widget held), in the box under the Web canvas's minimap:
// name, status, intent, head / SEO, notes. Planning fields are never emitted; head goes into the page's metadata.

const LABEL = 'text-[10px] uppercase tracking-widest text-neutral-500';
const FIELD = 'bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-indigo-500/60 w-full placeholder:text-neutral-600';

export function PageFields({ pid, project, page }: { pid: string; project: ProjectData; page: PageDef }) {
  const updatePage = useWorkbenchStore((s) => s.updatePage);
  const patch = (p: Partial<Omit<PageDef, 'path'>>) => updatePage(pid, page.path, p);
  const head = page.head ?? {}, setHead = (h: Partial<PageHead>) => patch({ head: { ...head, ...h } });
  const derived = derivePageStatus(project, page.path), status = PAGE_STATUSES.find((s) => s.value === derived)!;
  const { meta } = project;
  const titleFallback = meta.headTitle ? `${page.name} — ${meta.headTitle}` : page.name;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className={LABEL}>Page</span>
        <input
          key={page.path} defaultValue={page.name} className={`${FIELD} text-sm`} title="Rename page"
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== page.name) patch({ name: v }); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-neutral-500 truncate flex-1">{page.path}</span>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: status.color }} />
          <select
            value={page.status ?? ''} title="Unset = worked out from the wireframe and layout"
            onChange={(e) => patch({ status: (e.target.value || undefined) as PageStatus | undefined })}
            className="bg-neutral-800 border border-neutral-700 rounded text-[11px] px-1 py-0.5 text-neutral-200 outline-none"
          >
            <option value="">Auto · {status.label}</option>
            {PAGE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Intent</span>
        <textarea value={page.intent ?? ''} onChange={(e) => patch({ intent: e.target.value })} placeholder="What is this page for, and who is it for?" className={`${FIELD} resize-none min-h-[56px]`} />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Head / SEO</span>
        <input value={head.title ?? ''} onChange={(e) => setHead({ title: e.target.value })} placeholder={`Title: "${titleFallback}"`} className={FIELD} />
        <textarea
          value={head.description ?? ''} onChange={(e) => setHead({ description: e.target.value })}
          placeholder={meta.headDescription ? `Description: the project's "${meta.headDescription}"` : 'Description'}
          className={`${FIELD} resize-none min-h-[48px]`}
        />
        <input value={head.ogImage ?? ''} onChange={(e) => setHead({ ogImage: e.target.value })} placeholder="Share image URL (og:image)" className={`${FIELD} font-mono`} />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-neutral-400">Hide from search engines</span>
          <Toggle size="sm" on={!!head.noindex} onToggle={() => setHead({ noindex: !head.noindex })} />
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Backdrop</span>
        <input
          value={page.backdrop ?? ''} onChange={(e) => patch({ backdrop: e.target.value || undefined })}
          placeholder={meta.backdrop ? `The project's: ${meta.backdrop}` : 'CSS background under the page, e.g. a gradient'}
          className={`${FIELD} font-mono`} title="Drawn fixed under this page (CSS background). Empty = the project's backdrop (Project settings)"
        />
        {page.backdrop && !safeBackdrop(page.backdrop) && <span className="text-[10px] text-rose-400">Not used: no &lt; &gt; {'{ }'} ; ` \ $ in a backdrop</span>}
      </label>

      {!project.pages.some((p) => p.sections?.includes(page.path)) && (
        <div className="flex flex-col gap-1" title="Other pages shown on this one, one at a time, picked by #hash (/work becomes #work). Links to them stay on this page. The first one shows when there's no hash, after this page's own blocks if it has any.">
          <span className={LABEL}>Sections in place</span>
          {project.pages.filter((p) => p.path !== page.path && !p.sections?.length).map((p) => {
            const on = page.sections?.includes(p.path) ?? false;
            return (
              <label key={p.path} className="flex items-center gap-2 text-[11px] text-neutral-300">
                <input type="checkbox" checked={on} onChange={() => {
                  const next = on ? (page.sections ?? []).filter((x) => x !== p.path) : [...(page.sections ?? []), p.path];
                  patch({ sections: next.length ? next : undefined });
                }} />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="font-mono text-[10px] text-neutral-500">#{sectionId(p.path)}</span>
              </label>
            );
          })}
          {!!page.sections?.length && <span className="text-[10px] text-neutral-500 leading-snug">Shown in the export and on Live; the preview here shows this page&apos;s own blocks.</span>}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Notes</span>
        <textarea value={page.notes ?? ''} onChange={(e) => patch({ notes: e.target.value })} placeholder="Anything worth remembering about this page…" className={`${FIELD} resize-none min-h-[72px]`} />
      </label>
    </div>
  );
}
