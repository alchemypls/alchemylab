"use client";

import { useMemo, useRef, useState } from 'react';
import { ChevronRight, FileText, Folder, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { useWorkbenchStore } from '@/lib/store';
import { buildRouteTree, nameFromPath, normalizePath, type RouteNode } from '@/lib/routes';
import { PAGE_STATUSES, derivePageStatus, type ProjectData } from '@/lib/project';

// A project's pages as a folder tree, in the box under the Web canvas's minimap: pick one to open it,
// add a route (child routes from a row's +), delete one.

const INPUT = 'bg-neutral-800 border border-neutral-700 rounded px-1.5 py-1 text-[11px] text-neutral-200 outline-none focus:border-indigo-500/60 min-w-0';

export function RouteTree({ pid, project }: { pid: string; project: ProjectData }) {
  const addPage       = useWorkbenchStore((s) => s.addPage);
  const removePage    = useWorkbenchStore((s) => s.removePage);
  const setActivePage = useWorkbenchStore((s) => s.setActivePage);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [newPath, setNewPath] = useState('');
  const [newName, setNewName] = useState('');
  const pathInput = useRef<HTMLInputElement>(null);
  const tree = useMemo(() => buildRouteTree(project.pages), [project.pages]);
  const activePath = project.activePath ?? project.pages[0]?.path;

  const add = () => {
    if (!newPath.trim()) return;
    const path = normalizePath(newPath);
    if (!project.pages.some((p) => p.path === path)) addPage(pid, { path, name: newName.trim() || nameFromPath(path) });
    setActivePage(pid, path);
    setNewPath(''); setNewName('');
  };
  const toggle = (path: string) => setCollapsed((c) => { const n = new Set(c); if (n.has(path)) n.delete(path); else n.add(path); return n; });
  const addChildOf = (path: string) => {
    setNewPath(path === '/' ? '/' : `${path}/`);
    setCollapsed((c) => { const n = new Set(c); n.delete(path); return n; });
    pathInput.current?.focus();
  };

  const row = (node: RouteNode, depth: number): React.ReactNode => {
    const isFolder = node.children.length > 0, isOpen = isFolder && !collapsed.has(node.path), isActive = node.page?.path === activePath;
    const status = node.page && PAGE_STATUSES.find((st) => st.value === derivePageStatus(project, node.page!.path));
    const Icon = node.page ? FileText : isOpen ? FolderOpen : Folder;
    return (
      <div key={node.path}>
        <div
          className={`group flex items-center gap-1 pr-1 py-1 rounded cursor-pointer ${isActive ? 'bg-indigo-500/15 text-neutral-100' : 'text-neutral-300 hover:bg-neutral-800'}`}
          style={{ paddingLeft: 4 + depth * 12 }}
          onClick={() => (node.page ? setActivePage(pid, node.page.path) : toggle(node.path))}
        >
          <span className={`w-3.5 h-3.5 flex items-center justify-center shrink-0 ${isFolder ? 'text-neutral-500 hover:text-neutral-200' : 'invisible'}`} onClick={(e) => { e.stopPropagation(); if (isFolder) toggle(node.path); }}>
            <ChevronRight className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </span>
          <Icon className="w-3.5 h-3.5 shrink-0 text-neutral-500" />
          <span className="flex-1 min-w-0 truncate text-[12px]">
            {node.page ? node.page.name : node.seg}
            <span className="ml-1.5 text-[10px] font-mono text-neutral-500">/{node.seg}</span>
          </span>
          {status && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: status.color }} title={status.label} />}
          <button onClick={(e) => { e.stopPropagation(); addChildOf(node.path); }} className="p-0.5 text-neutral-500 hover:text-neutral-100 opacity-0 group-hover:opacity-100" title="Add a child route"><Plus className="w-3 h-3" /></button>
          {node.page && (
            <button onClick={(e) => { e.stopPropagation(); removePage(pid, node.page!.path); }} className="p-0.5 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100" title="Delete page"><Trash2 className="w-3 h-3" /></button>
          )}
        </div>
        {isOpen && node.children.map((c) => row(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        <input ref={pathInput} value={newPath} onChange={(e) => setNewPath(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="/route/child" className={`${INPUT} font-mono flex-1`} />
        <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Name" className={`${INPUT} w-20`} />
        <button onClick={add} className="px-2 rounded bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white" title="Add page"><Plus className="w-3.5 h-3.5" /></button>
      </div>
      <div>
        {project.pages.length === 0
          ? <div className="text-center text-[11px] text-neutral-500 py-4 italic">No pages yet. Add a route above.</div>
          : <>{tree.page && row({ ...tree, seg: '', children: [] }, 0)}{tree.children.map((c) => row(c, 0))}</>}
      </div>
    </div>
  );
}
