"use client";

import { useSyncExternalStore } from 'react';
import { useWorkbenchStore } from '@/lib/store';
import type { Bible, BibleSummary } from '@/lib/design/types';
import { workspaceProjects, type WorkspaceProject } from '@/lib/workspace';

// The bibles on disk (GET /api/design), one shared copy that follows design/ over SSE, for the project picker
let bibles: BibleSummary[] = [];
let loaded = false;
const listeners = new Set<() => void>();
let source: EventSource | null = null;

async function reload() {
  const res = await fetch('/api/design', { cache: 'no-store' }).catch(() => null);
  if (res?.ok) { bibles = await res.json(); loaded = true; listeners.forEach((l) => l()); }
}
function subscribe(l: () => void) {
  listeners.add(l);
  if (!source) { source = new EventSource('/api/design/watch'); source.onmessage = () => void reload(); void reload(); }
  return () => { listeners.delete(l); if (!listeners.size) { source?.close(); source = null; } };
}
const snapshot = () => bibles;
export const reloadBibles = reload;

// Every workspace project, and the one open now (lastProjectId)
export function useWorkspace(): { projects: WorkspaceProject[]; current: WorkspaceProject | undefined; pid: string; loaded: boolean } {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  const webs = useWorkbenchStore((s) => s.projects);
  const pid  = useWorkbenchStore((s) => s.lastProjectId);
  const projects = workspaceProjects(list, webs);
  return { projects, current: projects.find((p) => p.id === pid), pid, loaded };
}

// Bible files read and written whole, for project settings (the Ideation canvas keeps its own copy and conflict checks)
export async function readBible(id: string): Promise<{ bible: Bible; mtime: string | null } | null> {
  const res = await fetch(`/api/design?bible=${id}`, { cache: 'no-store' }).catch(() => null);
  return res?.ok ? { bible: await res.json(), mtime: res.headers.get('x-mtime') } : null;
}
export async function writeBible(id: string, bible: Bible, opts: { base?: string | null; create?: boolean } = {}): Promise<string | null> {
  const res = await fetch(`/api/design?bible=${id}${opts.create ? '&new=1' : ''}`, {
    method: 'PUT', body: JSON.stringify(bible), headers: opts.base ? { 'x-base-mtime': opts.base } : {},
  }).catch(() => null);
  if (!res) return 'Dev server unreachable';
  if (res.ok) { void reload(); return null; }
  return (await res.json().catch(() => ({}))).error ?? res.statusText;
}
export async function trashBible(id: string): Promise<string | null> {
  const res = await fetch(`/api/design?bible=${id}`, { method: 'DELETE' }).catch(() => null);
  if (res?.ok) { void reload(); return null; }
  return res ? (await res.json().catch(() => ({}))).error ?? res.statusText : 'Dev server unreachable';
}
