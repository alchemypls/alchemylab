"use client";

import { Trash2 } from 'lucide-react';
import { useWorkbenchStore } from '@/lib/store';
import { PROJECT_ACCENTS, type ProjectData } from '@/lib/project';

// The project's own fields, in the box under the Web canvas's minimap: name, accent, core intent, tags, the default
// head pages fall back to, and deleting it (the shared vault is untouched).

const LABEL = 'text-[10px] uppercase tracking-widest text-neutral-500';
const FIELD = 'bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-indigo-500/60 w-full placeholder:text-neutral-600';

export function ProjectFields({ project }: { project: ProjectData }) {
  const updateProjectMeta = useWorkbenchStore((s) => s.updateProjectMeta);
  const deleteProject     = useWorkbenchStore((s) => s.deleteProject);
  const projectCount      = useWorkbenchStore((s) => Object.keys(s.projects).length);
  const { meta } = project;
  const set = (u: Parameters<typeof updateProjectMeta>[1]) => updateProjectMeta(meta.id, u);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Project</span>
        <input value={meta.name} onChange={(e) => set({ name: e.target.value })} className={`${FIELD} text-sm`} />
      </label>
      <div className="flex items-center gap-1.5">
        <span className={`${LABEL} mr-1`}>Accent</span>
        {PROJECT_ACCENTS.map((c) => (
          <button key={c} onClick={() => set({ accent: c })} aria-label={c} className={`w-4 h-4 rounded-full border-2 ${meta.accent === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />
        ))}
      </div>
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Core intent</span>
        <textarea value={meta.coreIntent ?? ''} onChange={(e) => set({ coreIntent: e.target.value })} placeholder="What is this site, and who is it for?" className={`${FIELD} resize-none min-h-[56px]`} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Tags</span>
        <input value={meta.globalTags ?? ''} onChange={(e) => set({ globalTags: e.target.value })} placeholder="dark, fantasy, glassmorphism" className={FIELD} />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Default head (pages that leave it blank)</span>
        <input value={meta.headTitle ?? ''} onChange={(e) => set({ headTitle: e.target.value })} placeholder='Site title: pages become "Page — Site title"' className={FIELD} />
        <textarea value={meta.headDescription ?? ''} onChange={(e) => set({ headDescription: e.target.value })} placeholder="Default description" className={`${FIELD} resize-none min-h-[48px]`} />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-neutral-700/60">
        <span className="text-[10px] text-neutral-500 font-mono">{project.pages.length} pages · created {new Date(meta.createdAt).toLocaleDateString()}</span>
        <button
          disabled={projectCount <= 1}
          onClick={() => { if (window.confirm(`Delete project "${meta.name}" and all its pages, layouts and wireframes? The shared vault is untouched.`)) deleteProject(meta.id); }}
          className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-red-400 disabled:opacity-30 disabled:hover:text-neutral-500"
          title={projectCount <= 1 ? "Can't delete the only project" : 'Delete project'}
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}
