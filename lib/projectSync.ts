"use client";

import { useEffect } from 'react';
import { useWorkbenchStore } from './store';
import type { ProjectData } from './project';

// Web projects live on disk (projects/<id>.json, /api/projects). The store keeps a working copy in `projects`, so
// every canvas reads and edits them as before; this keeps the two in step:
//   - on start, disk replaces the store's copy (projects a browser held before they moved to disk are written out once)
//   - a change in the store is written to disk shortly after it settles (and right away when the tab hides)
//   - a change on disk (the agent, another tab) replaces the store's copy, unless it's the write we just made
// A write that loses a race (the file changed since we read it) takes the disk's version: disk wins.

const DEBOUNCE_MS = 400;

type Known = { mtime: string | null; json: string; ref: ProjectData };
const known = new Map<string, Known>();            // what disk holds, as far as this tab knows
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let started = false;

const store = () => useWorkbenchStore.getState();
const setProject = (id: string, project: ProjectData) => {
  useWorkbenchStore.setState((s) => ({ projects: { ...s.projects, [id]: project } }));
};

async function write(id: string, keepalive = false) {
  timers.delete(id);
  const project = store().projects[id];
  if (!project) return;
  const json = JSON.stringify(project), before = known.get(id);
  if (before?.json === json) { known.set(id, { ...before, ref: project }); return; }
  known.set(id, { mtime: before?.mtime ?? null, json, ref: project });   // so the watcher's echo of this write is ignored
  const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, {
    method: 'PUT', body: json, keepalive,
    headers: { 'content-type': 'application/json', ...(before?.mtime ? { 'x-base-mtime': before.mtime } : {}) },
  }).catch(() => null);
  if (!res) return console.warn(`[projects] couldn't save "${id}"`);
  if (res.status === 409) { console.warn(`[projects] "${id}" changed on disk; taking the disk's version`); return pull(id, true); }
  if (!res.ok) return console.warn(`[projects] save of "${id}" refused:`, (await res.json().catch(() => ({}))).error);
  const k = known.get(id);
  if (k?.json === json) known.set(id, { ...k, mtime: res.headers.get('x-mtime') });
}

async function pull(id: string, force = false) {
  const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`).catch(() => null);
  if (!res?.ok) return;
  const { mtime, project } = await res.json() as { mtime: string; project: ProjectData };
  const json = JSON.stringify(project), k = known.get(id);
  if (!force && k?.json === json) { known.set(id, { ...k, mtime }); return; }   // our own write coming back
  known.set(id, { mtime, json, ref: project });
  setProject(id, project);
}

function flushAll() {
  for (const [id, t] of Array.from(timers)) { clearTimeout(t); void write(id, true); }
}

// A project with nothing in it (the store's starting one) gives way to a real one of the same id
const blank = (p: ProjectData) => !p.pages?.length && !Object.keys(p.components ?? {}).length;

// The store's v11 → v12 migration keeps a copy of everything this browser held (alchemy:workbench:backup-v<n>)
function backupProjects(): Record<string, ProjectData> {
  const out: Record<string, ProjectData> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('alchemy:workbench:backup-v')) continue;
      const state = JSON.parse(localStorage.getItem(key) ?? 'null') as { projects?: Record<string, ProjectData> } | null;
      for (const [id, p] of Object.entries(state?.projects ?? {})) if (p?.meta && Array.isArray(p.pages) && !(id in out && blank(p))) out[id] = p;
    }
  } catch (e) { console.warn('[projects] couldn\'t read the browser backups', e); }
  return out;
}
const CARRIED = 'alchemy:projects:carried';   // ids already brought over to disk from this browser
const readCarried = (): string[] => { try { return JSON.parse(localStorage.getItem(CARRIED) ?? '[]'); } catch { return []; } };
const writeCarried = (ids: string[]) => { try { localStorage.setItem(CARRIED, JSON.stringify(Array.from(new Set(ids)))); } catch { /* only costs a repeat */ } };

async function start() {
  const res = await fetch('/api/projects').catch(() => null);
  const onDisk = res?.ok ? await res.json() as { id: string; mtime: string; project: ProjectData }[] : null;
  if (!onDisk) return console.warn('[projects] couldn\'t load projects from disk; changes stay in this tab');
  const local = store().projects;
  const fromBrowser = (store() as { fromBrowser?: string[] }).fromBrowser ?? [];
  const next: Record<string, ProjectData> = {};
  for (const { id, mtime, project } of onDisk) { next[id] = project; known.set(id, { mtime, json: JSON.stringify(project), ref: project }); }
  // Projects this browser held before they moved to disk (this load's, or the pre-migration backups'), or a first
  // run with nothing on disk yet: write them out. Each id is brought over once, so deleting one later sticks.
  const carried = readCarried();
  const candidates: Record<string, ProjectData> = { ...backupProjects() };
  for (const id of Object.keys(local)) if (fromBrowser.includes(id) || onDisk.length === 0) candidates[id] = local[id];
  const toWrite = Object.keys(candidates).filter((id) => !carried.includes(id) && (!next[id] || (blank(next[id]) && !blank(candidates[id]))));
  for (const id of toWrite) next[id] = candidates[id];
  writeCarried([...carried, ...Object.keys(candidates)]);
  if (!Object.keys(next).length) Object.assign(next, local);   // nothing anywhere: the store's starting project
  useWorkbenchStore.setState({ projects: next, fromBrowser: undefined } as Partial<ReturnType<typeof store>>);
  for (const id of toWrite) void write(id);

  // Store → disk
  useWorkbenchStore.subscribe((s, prev) => {
    if (s.projects === prev.projects) return;
    for (const [id, p] of Object.entries(s.projects)) {
      if (known.get(id)?.ref === p) continue;
      clearTimeout(timers.get(id));
      timers.set(id, setTimeout(() => void write(id), DEBOUNCE_MS));
    }
    for (const id of Object.keys(prev.projects)) {
      if (s.projects[id]) continue;
      clearTimeout(timers.get(id)); timers.delete(id); known.delete(id);
      void fetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    }
  });
  window.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll(); });

  // Disk → store
  const es = new EventSource('/api/projects/watch');
  es.onmessage = (e) => {
    const file = (JSON.parse(e.data) as { path: string }).path;
    const id = file.endsWith('.json') ? file.slice(0, -5) : null;
    if (!id || timers.has(id)) return;   // an edit of ours is about to be written; its write decides
    void pull(id);
  };
}

// Mounted once, by the root page
export function useProjectSync() {
  useEffect(() => {
    if (started) return;
    started = true;
    void start();
  }, []);
}
