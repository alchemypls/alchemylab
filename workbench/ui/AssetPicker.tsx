"use client";

import { AssetDrawing } from './vector/shapes';

// A vault asset drawn small, for pickers (the Vault panel)

export function AssetThumb({ id }: { id: string }) {
  return <svg viewBox="0 0 100 100" className="w-full h-full"><AssetDrawing el={{ x: 8, y: 8, w: 84, h: 84, asset: id }} /></svg>;
}
