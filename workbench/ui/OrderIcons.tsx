"use client";

import { ArrowDown, ArrowUp, BringToFront, SendToBack } from 'lucide-react';

// Draw-order icons with a small arrow in a corner, so front and back read apart at a glance.
// The padding gives the arrows room inside the box (no clipping); the negative margin keeps the button its usual size.
export function FrontIcon({ size = 13 }: { size?: number }) {
  return (
    <span className="relative inline-flex p-[5px] -m-[3px]">
      <BringToFront size={size} />
      <ArrowUp size={Math.round(size * 0.55)} strokeWidth={3} className="absolute top-0 left-0 text-amber-400" />
    </span>
  );
}

export function BackIcon({ size = 13 }: { size?: number }) {
  return (
    <span className="relative inline-flex p-[5px] -m-[3px]">
      <SendToBack size={size} />
      <ArrowDown size={Math.round(size * 0.55)} strokeWidth={3} className="absolute bottom-0 right-0 text-amber-400" />
    </span>
  );
}
