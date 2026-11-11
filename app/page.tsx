"use client";

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorkbenchStore } from '@/lib/store';
import { type Dir } from '@/lib/scenes';
import { useProjectSync } from '@/lib/projectSync';
import { SceneNavigator } from '@/workbench/shell/SceneNavigator';
import { CanvasPanel } from '@/workbench/shell/CanvasPanel';
import { FileVault } from '@/workbench/shell/FileVault';
import { IdeationCanvas } from '@/workbench/canvases/IdeationCanvas';
import { FabCanvas } from '@/workbench/canvases/FabCanvas';
import { WebCanvas } from '@/workbench/canvases/WebCanvas';
import { LiveCanvas } from '@/workbench/canvases/LiveCanvas';
import { AskHost } from '@/workbench/ui/Ask';

// The workbench: one full-screen canvas at a time (Alt + WASD / arrows moves between them), the panel above it.

// Direction = the direction you're navigating TO. The incoming canvas enters from that side; the outgoing one leaves opposite.
const enterFrom = (dir: Dir | null) => ({
  x: dir === 'right' ? '100%' : dir === 'left' ? '-100%' : 0,
  y: dir === 'down'  ? '100%' : dir === 'up'   ? '-100%' : 0,
});
const exitTo = (dir: Dir | null) => ({
  x: dir === 'right' ? '-100%' : dir === 'left' ? '100%' : 0,
  y: dir === 'down'  ? '-100%' : dir === 'up'   ? '100%' : 0,
});
const slideTransition = { type: 'tween' as const, ease: [0.4, 0, 0.2, 1] as [number, number, number, number], duration: 0.32 };

export default function Home() {
  const activeScene = useWorkbenchStore((s) => s.activeScene);
  const slideDir    = useWorkbenchStore((s) => s.slideDir);
  useProjectSync();

  // Client-only: the open canvas, page and editor are this browser's persisted state (localStorage), which the
  // server can't see, so a server render would mismatch on hydration. Render after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a' }} />;

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#0a0a0a' }}>
      {/* Only the active canvas is mounted; AnimatePresence keeps the outgoing one alive for its slide-out */}
      <AnimatePresence mode="sync" custom={slideDir}>
        <motion.div
          key={activeScene} custom={slideDir}
          initial={enterFrom(slideDir)} animate={{ x: 0, y: 0 }} exit={exitTo(slideDir)} transition={slideTransition}
          style={{ position: 'absolute', inset: 0 }}
        >
          {activeScene === 'ideation' ? <IdeationCanvas /> : activeScene === 'fab' ? <FabCanvas /> : activeScene === 'web' ? <WebCanvas /> : <LiveCanvas />}
        </motion.div>
      </AnimatePresence>

      <CanvasPanel />
      <SceneNavigator />
      <FileVault />
      <AskHost />
    </div>
  );
}
