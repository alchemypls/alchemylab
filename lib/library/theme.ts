// ── Theme — named design tokens ──────────────────────────────────
// A theme is a flat map of token name → raw CSS value. Recipes never carry their own colours
// or sizes: they reference tokens as "{color.primary}", and each generator decides how to
// emit that (CSS: var(--color-primary)). Manifest-pure: names + raw CSS primitives only.
//
// Ownership: GLOBAL_THEME is the foundation. A project gets its own COPY on creation and owns
// it — editing one project's theme never touches another's (copy, don't link).

export type TokenRef = `{${string}}`;

export interface Theme {
  id:     string;
  name:   string;
  origin?: { theme: string };          // what this was copied from, for opt-in "update from library"
  tokens: Record<string, string>;      // "color.primary" → "oklch(0.65 0.18 250)"
}

export const GLOBAL_THEME: Theme = {
  id: 'global', name: 'Alchemy Base',
  tokens: {
    // Colour — dark neutral
    'color.bg':             'oklch(0.13 0.01 260)',
    'color.surface':        'oklch(0.18 0.012 260)',
    'color.surface-raised': 'oklch(0.23 0.014 260)',
    'color.border':         'oklch(0.32 0.015 260)',
    'color.text':           'oklch(0.96 0.005 260)',
    'color.text-muted':     'oklch(0.70 0.015 260)',
    'color.primary':        'oklch(0.65 0.18 265)',
    'color.primary-text':   'oklch(0.99 0 0)',
    'color.danger':         'oklch(0.62 0.21 25)',
    'color.danger-text':    'oklch(0.99 0 0)',
    'color.focus':          'oklch(0.78 0.14 265)',
    // Shape
    'radius.sm': '4px', 'radius.md': '8px', 'radius.lg': '14px', 'radius.full': '999px',
    // Spacing (4px scale)
    'space.1': '4px', 'space.2': '8px', 'space.3': '12px', 'space.4': '16px', 'space.5': '24px', 'space.6': '32px',
    // Type
    'font.sans': 'system-ui, -apple-system, "Segoe UI", sans-serif',
    'font.mono': 'ui-monospace, "SF Mono", Menlo, monospace',
    'text.sm': '13px', 'text.md': '15px', 'text.lg': '18px', 'text.xl': '24px',
    'weight.regular': '400', 'weight.medium': '500', 'weight.bold': '700',
    // Elevation
    'shadow.sm': '0 1px 2px rgba(0,0,0,0.35)',
    'shadow.md': '0 6px 18px rgba(0,0,0,0.45)',
    // Motion
    'motion.fast': '120ms', 'motion.normal': '220ms', 'motion.ease': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    // Touch target floor (phones)
    'size.touch': '44px',
  },
};

// A project's own theme, seeded from the global one
export const copyTheme = (theme: Theme, id: string, name: string): Theme =>
  ({ id, name, origin: { theme: theme.id }, tokens: { ...theme.tokens } });

export const isTokenRef = (v: unknown): v is TokenRef => typeof v === 'string' && /^\{[a-z0-9.-]+\}$/i.test(v);
export const tokenName  = (ref: TokenRef) => ref.slice(1, -1);
