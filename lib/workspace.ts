// The workspace project: one id ties a design bible (design/<id>/), a web project (projects/<id>.json) and the vault
// items marked `project: <id>`. Either file can be missing (a game has no web project; a scratch site has no bible).
// The header picker (workbench/shell/ProjectPicker.tsx) switches every canvas to one; its settings live in whichever
// files exist: name → bible.title + meta.name, accent and archived → both, template and source → the bible.
import type { BibleSummary } from './design/types';
import type { ProjectData } from './project';

export interface WorkspaceProject {
  id:        string;
  name:      string;
  accent?:   string;
  archived:  boolean;
  template?: 'game' | 'web';
  source?:   string;
  bible:     boolean;   // design/<id>/bible.json exists
  web:       boolean;   // projects/<id>.json exists
}

export function workspaceProjects(bibles: BibleSummary[], webs: Record<string, ProjectData>): WorkspaceProject[] {
  const ids = Array.from(new Set([...bibles.map((b) => b.id), ...Object.keys(webs)]));
  return ids.map((id) => {
    const b = bibles.find((x) => x.id === id), w = webs[id];
    return {
      id, name: b?.title || w?.meta.name || id,
      accent: b?.accent ?? w?.meta.accent,
      archived: !!(b?.archived || w?.meta.archived),
      template: b?.template, source: b?.source,
      bible: !!b, web: !!w,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// A new project's id from its name: kebab-case, numbered when taken
export function projectIdFor(name: string, taken: string[]): string | null {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!base) return null;
  for (let n = 1; n < 100; n++) { const id = n === 1 ? base : `${base}-${n}`; if (!taken.includes(id)) return id; }
  return null;
}

// What a vault item shows in a project: its own and shared ones; others only when searched for
export const inProject = (item: { project?: string }, pid: string) => !item.project || item.project === pid;
