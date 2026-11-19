import { useWorkbenchStore } from '@/lib/store';
import type { ProjectData } from '@/lib/project';

// The web project of the workspace project open now (lastProjectId, picked in the panel header). Undefined when that
// project has none (a game): the canvases that need one show NoWebProject instead.
export function useCurrentProject(): { pid: string; project: ProjectData | undefined } {
  const pid = useWorkbenchStore((s) => s.lastProjectId);
  const project = useWorkbenchStore((s) => s.projects[pid]);
  return { pid, project };
}
