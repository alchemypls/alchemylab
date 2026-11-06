import { useWorkbenchStore } from '@/lib/store';
import type { ProjectData } from '@/lib/project';

// The web project the canvases work on: the one last opened on Web (lastProjectId), else the first there is.
// There is always at least one: the store starts with one and never deletes the last.
export function useCurrentProject(): { pid: string; project: ProjectData } {
  const projects = useWorkbenchStore((s) => s.projects);
  const last     = useWorkbenchStore((s) => s.lastProjectId);
  const pid = projects[last] ? last : Object.keys(projects)[0] ?? last;
  return { pid, project: projects[pid]! };
}
