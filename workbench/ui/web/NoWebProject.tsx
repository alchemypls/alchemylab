"use client";

import { useWorkbenchStore } from '@/lib/store';
import { useWorkspace } from '@/workbench/hooks/useWorkspace';

// Web and Live when the open workspace project has no web project (a game, say): say so, offer to make one.
// The project picker in the panel header still switches projects.
export function NoWebProject({ canvas }: { canvas: string }) {
  const createProject = useWorkbenchStore((s) => s.createProject);
  const { current, pid } = useWorkspace();
  const name = current?.name ?? pid;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#1e1c19]">
      <div className="flex flex-col items-center gap-3 text-center font-serif text-[#a59c8e] text-base px-6">
        <span>“{name}” has no web project, so there’s nothing for {canvas} to show.</span>
        <button
          onClick={() => { const id = createProject(name, pid); if (current?.accent) useWorkbenchStore.getState().updateProjectMeta(id, { accent: current.accent }); }}
          className="font-sans text-xs px-3 py-1.5 rounded-md border border-neutral-600 text-neutral-200 hover:bg-neutral-800"
        >
          Make a web project for “{name}”
        </button>
        <span className="font-sans text-[11px] text-neutral-500">Or switch projects with the picker at the top of the panel.</span>
      </div>
    </div>
  );
}
