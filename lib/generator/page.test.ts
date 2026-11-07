import { describe, expect, it } from 'vitest';
import { generatePageHTML, generatePageTSX } from './page';
import { GLOBAL_THEME, recipeByKey, recipeToCss, recipeToMarkup, themeToCss, type ProjectComponent } from '../library';
import type { PageDef, PageLayout, PagePlacement } from '../project';

// One page: a button that's full width on mobile and half width from tablet up
const button = recipeByKey('button')!;
const components: Record<string, ProjectComponent> = {
  btn: { id: 'btn', projectId: 'p', origin: { recipe: 'button', version: button.version }, recipe: button, tags: [] },
};
const placement = (more: Partial<PagePlacement> = {}): PagePlacement =>
  ({ id: 'cta', componentId: 'btn', name: 'Hero CTA', col: 0, row: 0, colSpan: 4, rowSpan: 1, at: { tablet: { colSpan: 4 } }, ...more });
const page: PageDef = { path: '/home', name: 'Home' } as PageDef;
const layout = (p = placement()): PageLayout => ({ placements: [p] });

describe('recipes → CSS and markup', () => {
  it('turns theme tokens into CSS variables and token refs into var()', () => {
    expect(themeToCss(GLOBAL_THEME)).toMatch(/^:root \{\n {2}--/);
    expect(recipeToCss(button)).toMatch(/var\(--/);
  });

  it('turns variants into [data-*] selectors and states into pseudo-classes', () => {
    const css = recipeToCss(button);
    expect(css).toMatch(/\[data-variant="danger"\]/);
    expect(css).toMatch(/:hover|:focus-visible|:active|:disabled/);
  });

  it('renders native elements: a real <button>, with the picked option as a data attribute', () => {
    const html = recipeToMarkup(button, { label: 'Buy now' }, { variant: 'danger' }, '', true);
    expect(html).toMatch(/^<button[^>]*data-variant="danger"/);
    expect(html).toContain('Buy now');
  });

  it("escapes what people type, so a label can't inject markup", () => {
    const html = recipeToMarkup(button, { label: '<script>alert(1)</script> & "x"' }, undefined, '', true);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    const jsx = recipeToMarkup(button, { label: 'a {b} <c>' });
    expect(jsx).not.toMatch(/[^']\{b\}/);
  });
});

describe('page export', () => {
  const html = generatePageHTML(page, layout(), components, GLOBAL_THEME);
  const tsx = generatePageTSX(page, layout(), components, GLOBAL_THEME);

  it('is mobile-first: base styles, then one min-width query per larger tier', () => {
    expect(html).toContain('@media (min-width: 600px)');
    expect(html).toContain('@media (min-width: 1024px)');
    expect(html.indexOf('@media (min-width: 600px)')).toBeLessThan(html.indexOf('@media (min-width: 1024px)'));
  });

  it('ships the same component CSS and the same markup in both formats', () => {
    const css = recipeToCss(button).split('\n').filter((l) => l.includes('{'))[0].trim();
    expect(html).toContain(css);
    expect(tsx).toContain(css);
    for (const out of [html, tsx]) expect(out).toMatch(/<button/);
  });

  it('is one self-contained HTML file with no framework in it', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/react|next\/|className=/i);
  });

  it('names the Next.js page after the page, as a valid identifier', () => {
    expect(tsx).toMatch(/export default function HomePage\(/);
    const odd = generatePageTSX({ ...page, name: '404 – not found!' }, layout(), components, GLOBAL_THEME);
    expect(odd).toMatch(/export default function [A-Za-z_][A-Za-z0-9_]*\(/);
  });

  it('escapes page text in the head', () => {
    const out = generatePageHTML({ ...page, name: 'Tom & Jerry <3' }, layout(), components, GLOBAL_THEME);
    expect(out).toContain('<title>Tom &amp; Jerry &lt;3</title>');
  });

  it("still exports when a placement's component is missing", () => {
    expect(generatePageHTML(page, layout(placement({ componentId: 'gone' })), components, GLOBAL_THEME)).toContain('component not found');
  });
});
