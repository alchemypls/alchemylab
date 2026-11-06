// Server side of web projects on disk (projects/<id>.json): shared by /api/projects and /live.

import { promises as fs } from 'fs';
import path from 'path';
import type { ProjectData } from '../project';

export const PROJECTS_DIR = path.join(process.cwd(), 'projects');

export async function readProject(id: string): Promise<{ id: string; mtime: string; project: ProjectData } | null> {
  const file = path.join(PROJECTS_DIR, `${id}.json`);
  try {
    const [text, stat] = await Promise.all([fs.readFile(file, 'utf8'), fs.stat(file)]);
    return { id, mtime: String(stat.mtimeMs), project: JSON.parse(text) };
  } catch { return null; }   // missing, or half-written (the watcher brings it back when the write finishes)
}

// Enough to keep a broken write off disk; the Web canvas is the one writer that knows the full shape
export function validateProject(p: unknown): string | null {
  if (!p || typeof p !== 'object') return 'A project is a JSON object';
  const o = p as Record<string, unknown>;
  if (!o.meta || typeof o.meta !== 'object' || typeof (o.meta as { name?: unknown }).name !== 'string') return 'meta.name is missing';
  if (!Array.isArray(o.pages)) return 'pages must be a list';
  if (!o.layouts || typeof o.layouts !== 'object') return 'layouts must be an object';
  if (!o.wireframes || typeof o.wireframes !== 'object') return 'wireframes must be an object';
  return null;
}
