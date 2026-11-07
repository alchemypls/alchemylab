// The export: what people type can't become code, both formats ship the same thing, and layouts cascade mobile-first.
import { describe, expect, it } from 'vitest';
import { generatePageHTML, generatePageTSX } from './page';
import { GLOBAL_THEME, recipeByKey, recipeToCss, recipeToMarkup, type ProjectComponent } from '../library';
import { resolvePlacement, type PageDef, type PagePlacement } from '../project';

const button = recipeByKey('button')!;
const components: Record<string, ProjectComponent> = { btn: { id: 'btn', projectId: 'p', origin: { recipe: 'button', version: button.version }, recipe: button, tags: [] } };
const cta: PagePlacement = { id: 'cta', componentId: 'btn', col: 1, row: 0, colSpan: 2, rowSpan: 1 };
const home = { path: '/home', name: 'Home' } as PageDef;

describe('page export', () => {
  it("escapes what people type, so a label or page name can't inject markup", () => {
    const evil = '<script>alert(1)</script> & "x"';
    expect(recipeToMarkup(button, { label: evil }, undefined, '', true)).not.toContain('<script>');
    expect(recipeToMarkup(button, { label: 'a {b} <c>' })).not.toMatch(/[^']\{b\}/);   // JSX: braces would run as code
    expect(generatePageHTML({ ...home, name: evil }, { placements: [cta] }, components, GLOBAL_THEME)).not.toContain('<script>alert');
  });

  it('ships the same component CSS and markup in the HTML and Next.js exports', () => {
    const css = recipeToCss(button).split('\n').find((l) => l.includes('{'))!.trim();
    for (const out of [generatePageHTML(home, { placements: [cta] }, components, GLOBAL_THEME), generatePageTSX(home, { placements: [cta] }, components, GLOBAL_THEME)]) {
      expect(out).toContain(css);
      expect(out).toMatch(/<button/);
      expect(out).toContain('@media (min-width: 600px)');
    }
  });

  it('lays out mobile-first: a placement scales up to 8 and 12 columns, and a tier override wins from there up', () => {
    expect(resolvePlacement(cta, 'tablet')).toMatchObject({ col: 2, colSpan: 4 });
    expect(resolvePlacement(cta, 'desktop')).toMatchObject({ col: 3, colSpan: 6 });
    const wide = { ...cta, at: { tablet: { col: 0, colSpan: 8 } } };
    expect(resolvePlacement(wide, 'desktop')).toMatchObject({ col: 0, colSpan: 12 });
  });
});
