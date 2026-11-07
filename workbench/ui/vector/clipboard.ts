// The vector clipboard: what Copy (Ctrl+C) last took from any sheet, for Paste (Ctrl+V) on any other, Ideation or Fab.
// Kept in this browser (localStorage), so it outlives switching pages or reloading. Never in a file.

import type { VClip } from '@/lib/design/vector';

const KEY = 'alchemy.clipboard';
let held: VClip | null = null;

export function putClip(clip: VClip) {
  held = clip;
  try { localStorage.setItem(KEY, JSON.stringify(clip)); } catch { /* too big or blocked: this tab still has it */ }
}

export function getClip(): VClip | null {
  if (held) return held;
  try { const raw = localStorage.getItem(KEY); held = raw ? JSON.parse(raw) as VClip : null; } catch { held = null; }
  return held?.elements?.length ? held : null;
}
