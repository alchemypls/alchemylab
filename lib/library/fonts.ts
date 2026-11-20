// ── Fonts a project loads ────────────────────────────────────────
// Web fonts by family and weights, loaded from Google Fonts in the page head (generator/page.ts) and in the
// Workbench preview. Raw names only; the theme's font tokens say where each one is used.

export interface FontLoad { family: string; weights?: number[] }

const FAMILY = /^[A-Za-z0-9 ]+$/;

// "Rajdhani 500 600 700, Inter 400 500, JetBrains Mono" → FontLoad[] (bad entries dropped)
export function parseFonts(text: string): FontLoad[] {
  return text.split(',').map((part) => {
    const words = part.trim().split(/\s+/).filter(Boolean);
    const weights = words.filter((w) => /^[1-9]00$/.test(w)).map(Number);
    const family = words.filter((w) => !/^[1-9]00$/.test(w)).join(' ');
    return FAMILY.test(family) ? { family, ...(weights.length ? { weights: weights.filter((w, i) => weights.indexOf(w) === i).sort((a, b) => a - b) } : {}) } : null;
  }).filter((f): f is FontLoad => !!f);
}

export const fontsText = (fonts: FontLoad[] = []) => fonts.map((f) => [f.family, ...(f.weights ?? [])].join(' ')).join(', ');

// One stylesheet URL for them all, or null when there are none
export function fontsHref(fonts: FontLoad[] = []): string | null {
  const ok = fonts.filter((f) => FAMILY.test(f.family));
  if (!ok.length) return null;
  const fam = ok.map((f) => `family=${f.family.trim().replace(/ +/g, '+')}${f.weights?.length ? `:wght@${f.weights.join(';')}` : ''}`);
  return `https://fonts.googleapis.com/css2?${fam.join('&')}&display=swap`;
}
