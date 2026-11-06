"use client";

import { useEffect } from 'react';
import { useWorkbenchStore } from '@/lib/store';
import { getAdjacentScene, Dir } from '@/lib/scenes';

// By physical key, so Caps Lock, Shift or a keyboard layout can't turn it into something else
const KEY_TO_DIR: Record<string, Dir> = {
  KeyW: 'up', KeyA: 'left', KeyS: 'down', KeyD: 'right',
  ArrowUp: 'up', ArrowLeft: 'left', ArrowDown: 'down', ArrowRight: 'right',
};

// Alt + WASD / arrows moves between canvases. The browser owns those too (Alt+D: address bar, Alt+←/→: back and
// forward), so the key is always kept from it, even at the grid's edge where there's no canvas to move to.
export function SceneNavigator() {
  const activeScene    = useWorkbenchStore((s) => s.activeScene);
  const setActiveScene = useWorkbenchStore((s) => s.setActiveScene);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const dir = KEY_TO_DIR[e.code];
      if (!dir) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      const next = getAdjacentScene(activeScene, dir);
      if (next) setActiveScene(next, dir);
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [activeScene, setActiveScene]);

  return null;
}
