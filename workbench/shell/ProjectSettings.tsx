"use client";

import { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Trash2, X } from 'lucide-react';
import { useWorkbenchStore } from '@/lib/store';
import { PROJECT_ACCENTS } from '@/lib/project';
import { fontsText, parseFonts } from '@/lib/library/fonts';
import type { Bible } from '@/lib/design/types';
import { projectIdFor, type WorkspaceProject } from '@/lib/workspace';
import { readBible, trashBible, useWorkspace, writeBible } from '@/workbench/hooks/useWorkspace';
import { savePalette, saveAsset, usePalettes, useVault } from '@/workbench/hooks/useVault';
import { askConfirm, tell } from '@/workbench/ui/Ask';

// The workspace project's settings (header picker → Project settings…), or a new project. A project's fields live in
// the files it has (lib/workspace.ts): name, accent, archived in both; template and source in the bible; the web
// fields in the web project. Text commits when the field loses focus.

const LABEL = 'text-[10px] uppercase tracking-widest text-neutral-500';
const FIELD = 'bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-amber-500/60 w-full placeholder:text-neutral-600';
const SEG = (on: boolean) => `px-2 py-0.5 rounded text-[10px] uppercase tracking-widest border ${on ? 'border-amber-500/60 text-amber-300 bg-amber-500/10' : 'border-neutral-700 text-neutral-400 hover:text-neutral-200'}`;
const today = () => new Date().toISOString().slice(0, 10);
const blankBible = (title: string, template: Bible['template'], accent?: string): Bible => ({ title, template, pitch: '', created: today(), topics: [], ...(accent && { accent }) });

// A text field that commits on blur / Enter, and follows the value when it changes elsewhere
function Commit({ value, onCommit, placeholder, area }: { value: string; onCommit: (v: string) => void; placeholder?: string; area?: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const done = () => { if (v !== value) onCommit(v); };
  return area
    ? <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={done} placeholder={placeholder} className={`${FIELD} resize-none min-h-[48px]`} />
    : <input value={v} onChange={(e) => setV(e.target.value)} onBlur={done} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} placeholder={placeholder} className={FIELD} />;
}

export function ProjectSettings({ mode, close }: { mode: 'edit' | 'new'; close: () => void }) {
  return (
    <div className="bg-neutral-900/95 border border-neutral-700/60 rounded-xl p-3 flex flex-col gap-3 backdrop-blur-sm pointer-events-auto shadow-xl max-h-[calc(100vh-120px)] overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.2em] uppercase text-amber-500">{mode === 'new' ? 'New project' : 'Project settings'}</span>
        <button onClick={close} className="text-neutral-500 hover:text-neutral-200" aria-label="Close"><X size={14} /></button>
      </div>
      {mode === 'new' ? <NewProject close={close} /> : <EditProject close={close} />}
    </div>
  );
}

function NewProject({ close }: { close: () => void }) {
  const { projects } = useWorkspace();
  const createProject = useWorkbenchStore((s) => s.createProject);
  const touchProject  = useWorkbenchStore((s) => s.touchProject);
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<Bible['template']>('web');
  const [web, setWeb] = useState(true);
  const [busy, setBusy] = useState(false);
  const accent = PROJECT_ACCENTS[projects.length % PROJECT_ACCENTS.length];

  const create = async () => {
    const id = projectIdFor(name, projects.map((p) => p.id));
    if (!id) return void tell(`“${name}” can’t be a project name`);
    setBusy(true);
    const err = await writeBible(id, blankBible(name.trim(), template, accent), { create: true });
    setBusy(false);
    if (err) return void tell(`Couldn’t make the bible: ${err}`);
    if (web) { createProject(name.trim(), id); useWorkbenchStore.getState().updateProjectMeta(id, { accent }); }
    touchProject(id);
    close();
  };

  return (
    <>
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Name</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) void create(); }} placeholder="Star-Survey Portfolio" className={`${FIELD} text-sm`} />
      </label>
      <div className="flex items-center gap-1.5">
        <span className={`${LABEL} mr-1`}>Bible</span>
        {(['web', 'game'] as const).map((t) => <button key={t} onClick={() => { setTemplate(t); setWeb(t === 'web'); }} className={SEG(template === t)}>{t}</button>)}
      </div>
      <label className="flex items-center gap-2 text-xs text-neutral-300">
        <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} /> Web project (pages on Web and Live)
      </label>
      <span className="text-[10px] text-neutral-500 leading-snug">Makes design/{projectIdFor(name, projects.map((p) => p.id)) ?? '…'}/ with an empty bible (run /design-bible to fill it){web ? ' and a web project' : ''}. New vault files you make belong to it.</span>
      <button disabled={!name.trim() || busy} onClick={() => void create()} className="self-end px-3 py-1 rounded-md text-xs border border-amber-500/50 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40">Create</button>
    </>
  );
}

function EditProject({ close }: { close: () => void }) {
  const { current, projects } = useWorkspace();
  if (!current) return <span className="text-xs text-neutral-500">No project open.</span>;
  return <EditFields key={current.id} p={current} others={projects.filter((x) => x.id !== current.id && !x.archived)} close={close} />;
}

function EditFields({ p, others, close }: { p: WorkspaceProject; others: WorkspaceProject[]; close: () => void }) {
  const web = useWorkbenchStore((s) => s.projects[p.id]);
  const updateMeta = useWorkbenchStore((s) => s.updateProjectMeta);
  const deleteWeb  = useWorkbenchStore((s) => s.deleteProject);
  const touch      = useWorkbenchStore((s) => s.touchProject);
  const createWeb  = useWorkbenchStore((s) => s.createProject);
  const assets = useVault().entries.filter((e) => e.asset.project === p.id);
  const palettes = usePalettes().entries.filter((e) => e.asset.project === p.id);

  // The bible's fields go through a read-modify-write, so the agent's edits in between aren't lost
  const patchBible = async (u: Partial<Bible>) => {
    if (!p.bible) return;
    const cur = await readBible(p.id);
    if (!cur) return void tell('Couldn’t read the bible');
    const err = await writeBible(p.id, { ...cur.bible, ...u }, { base: cur.mtime });
    if (err) void tell(`Couldn’t save the bible: ${err}`);
  };
  const setBoth = (u: { name?: string; accent?: string; archived?: boolean }) => {
    if (web) updateMeta(p.id, u);
    const { name, ...rest } = u;
    void patchBible({ ...rest, ...(name !== undefined && { title: name }) });
  };

  const archive = () => {
    setBoth({ archived: !p.archived });
    if (!p.archived && others[0]) touch(others[0].id);   // archived projects leave the picker: open another
    close();
  };
  const remove = async () => {
    const goes = [
      p.bible && `the bible design/${p.id}/ (moved to design/.trash/, not erased)`,
      web && `the web project projects/${p.id}.json (${web.pages.length} pages: erased)`,
      (assets.length || palettes.length) && `${assets.length + palettes.length} vault item(s) stay, as shared`,
    ].filter(Boolean);
    if (!others.length) return void tell('This is the only open project: make or unarchive another first.');
    if (!(await askConfirm(`Delete “${p.name}”?\n\n• ${goes.join('\n• ')}`, { ok: 'Delete', danger: true }))) return;
    touch(others[0].id);
    for (const a of assets) { const { project: _, ...rest } = a.asset; await saveAsset(a.id, rest); }
    for (const a of palettes) { const { project: _, ...rest } = a.asset; await savePalette(a.id, rest); }
    if (web) deleteWeb(p.id);
    if (p.bible) { const err = await trashBible(p.id); if (err) void tell(`Couldn’t move the bible: ${err}`); }
    close();
  };

  return (
    <>
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Name</span>
        <Commit value={p.name} onCommit={(name) => name.trim() && setBoth({ name: name.trim() })} />
      </label>
      <div className="flex items-center gap-1.5">
        <span className={`${LABEL} mr-1`}>Accent</span>
        {PROJECT_ACCENTS.map((c) => (
          <button key={c} onClick={() => setBoth({ accent: c })} aria-label={c} className={`w-4 h-4 rounded-full border-2 ${p.accent === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />
        ))}
      </div>

      <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-800">
        <span className={LABEL}>Design bible</span>
        {p.bible ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-neutral-500 mr-1">template</span>
              {(['web', 'game'] as const).map((t) => <button key={t} onClick={() => void patchBible({ template: t })} className={SEG(p.template === t)}>{t}</button>)}
            </div>
            <span className="text-[10px] text-neutral-500">Source codebase (site-survey)</span>
            <Commit value={p.source ?? ''} onCommit={(source) => void patchBible({ source: source.trim() || undefined })} placeholder="/path/to/the/site" />
          </>
        ) : (
          <button onClick={async () => { const err = await writeBible(p.id, blankBible(p.name, 'web', p.accent), { create: true }); if (err) void tell(err); }} className="self-start text-[11px] text-neutral-300 border border-neutral-700 rounded px-2 py-0.5 hover:bg-neutral-800">Make a bible</button>
        )}
      </div>

      <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-800">
        <span className={LABEL}>Web project</span>
        {web ? (
          <>
            <span className="text-[10px] text-neutral-500">Core intent</span>
            <Commit area value={web.meta.coreIntent ?? ''} onCommit={(v) => updateMeta(p.id, { coreIntent: v })} placeholder="What is this site, and who is it for?" />
            <span className="text-[10px] text-neutral-500">Tags</span>
            <Commit value={web.meta.globalTags ?? ''} onCommit={(v) => updateMeta(p.id, { globalTags: v })} placeholder="dark, scientific, warm" />
            <span className="text-[10px] text-neutral-500">Default head (pages that leave it blank)</span>
            <Commit value={web.meta.headTitle ?? ''} onCommit={(v) => updateMeta(p.id, { headTitle: v })} placeholder='Site title: pages become "Page — Site title"' />
            <Commit area value={web.meta.headDescription ?? ''} onCommit={(v) => updateMeta(p.id, { headDescription: v })} placeholder="Default description" />
            <span className="text-[10px] text-neutral-500">Backdrop (CSS background under every page)</span>
            <Commit value={web.meta.backdrop ?? ''} onCommit={(v) => updateMeta(p.id, { backdrop: v.trim() || undefined })} placeholder="radial-gradient(…), url(…)" />
            <span className="text-[10px] text-neutral-500">Fonts (Google Fonts, every page loads them)</span>
            <Commit value={fontsText(web.meta.fonts)} onCommit={(v) => updateMeta(p.id, { fonts: parseFonts(v) })} placeholder="Rajdhani 500 600, Inter 400, JetBrains Mono" />
            <span className="text-[10px] text-neutral-500 font-mono">{web.pages.length} pages · {Object.keys(web.components ?? {}).length} components</span>
          </>
        ) : (
          <button onClick={() => { createWeb(p.name, p.id); if (p.accent) updateMeta(p.id, { accent: p.accent }); }} className="self-start text-[11px] text-neutral-300 border border-neutral-700 rounded px-2 py-0.5 hover:bg-neutral-800">Make a web project</button>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
        <span className="text-[10px] text-neutral-500 font-mono">{assets.length} assets · {palettes.length} palettes</span>
        <div className="flex items-center gap-3">
          <button onClick={archive} className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-100" title={p.archived ? 'Back in the picker' : 'Hide it from the picker; files are kept'}>
            {p.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}{p.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button onClick={() => void remove()} className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-red-400" title="Delete: asks first and lists what goes">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>
    </>
  );
}
