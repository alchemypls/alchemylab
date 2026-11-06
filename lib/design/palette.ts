// Palettes: named colors in vault/palettes/<id>.json, made on Fab's Visual Identity editor (or by the agent).
// Every color picker shows the palette in use, and a component theme can take its colors.
// A pick copies the color's value, so changing a palette later doesn't recolor finished work.
// Pure data. Imports stay relative (CLI).

import type { DesignPage } from './types';
import type { VElement } from './vector';

export interface PaletteColor { name: string; value: string }
export interface Palette { title: string; updated?: string; colors: PaletteColor[] }

// What the pickers showed before there were palettes. Also the fallback while the vault has none.
export const BASE_PALETTE: Palette = {
  title: 'Base',
  colors: [
    { name: 'Ink', value: '#1f1b16' }, { name: 'Muted', value: '#6b6257' }, { name: 'Rule', value: '#d8cfc0' },
    { name: 'Paper', value: '#f4efe6' }, { name: 'White', value: '#ffffff' }, { name: 'Accent', value: '#b4532a' },
    { name: 'Decided', value: '#2f7d4f' }, { name: 'Hypothesis', value: '#c08a1e' }, { name: 'Blue', value: '#3b6ea8' },
    { name: 'Violet', value: '#6d5a8a' }, { name: 'Teal', value: '#13a89a' }, { name: 'Magenta', value: '#d6006c' },
    { name: 'Lime', value: '#dde06a' }, { name: 'Orange', value: '#f28a3c' },
  ],
};

export const newPalette = (title: string, today: string): Palette =>
  ({ title, updated: today, colors: [{ name: 'Ink', value: '#1f1b16' }, { name: 'Paper', value: '#f4efe6' }] });

export const HEX = /^#[0-9a-f]{6}$/i;

// The palette laid out as a sheet: a grid of swatches, the last cell adds a color
export const SWATCH = 180, SWATCH_GAP = 40, SWATCH_COLS = 6, SHEET_PAD = 80, LABEL_H = 64;
export const paletteCell = (i: number) => ({
  x: SHEET_PAD + (i % SWATCH_COLS) * (SWATCH + SWATCH_GAP),
  y: SHEET_PAD + Math.floor(i / SWATCH_COLS) * (SWATCH + LABEL_H + SWATCH_GAP),
});
export function paletteSize(p: Palette) {
  const rows = Math.ceil((p.colors.length + 1) / SWATCH_COLS);
  return { width: SHEET_PAD * 2 + SWATCH_COLS * SWATCH + (SWATCH_COLS - 1) * SWATCH_GAP, height: SHEET_PAD * 2 + rows * (SWATCH + LABEL_H) + (rows - 1) * SWATCH_GAP };
}

// The same layout as a vector page, for the minimap
export function paletteSheet(p: Palette): DesignPage {
  const elements: VElement[] = p.colors.map((c, i) => ({ id: `c${i}`, type: 'rect', ...paletteCell(i), w: SWATCH, h: SWATCH, fill: c.value, radius: 16 }));
  return { title: p.title, blocks: [], elements, size: paletteSize(p), background: '#2a2724' };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function validatePalette(raw: unknown): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  if (!isObj(raw)) return { errors: ['palette is not an object'], warnings };
  if (typeof raw.title !== 'string' || !raw.title.trim()) errors.push('title: required string');
  if (!Array.isArray(raw.colors)) return { errors: [...errors, 'colors: required array'], warnings };
  const names = new Set<string>();
  raw.colors.forEach((c, i) => {
    if (!isObj(c) || typeof c.name !== 'string' || typeof c.value !== 'string') return errors.push(`colors[${i}]: {name, value} strings`);
    if (!HEX.test(c.value)) errors.push(`colors[${i}].value: #rrggbb hex, got "${c.value}"`);
    if (names.has(c.name)) warnings.push(`colors[${i}].name: "${c.name}" used twice`);
    names.add(c.name);
  });
  return { errors, warnings };
}
