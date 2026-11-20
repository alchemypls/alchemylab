// The export: what people type can't become code, both formats ship the same thing, and layouts cascade mobile-first.
import { describe, expect, it } from 'vitest';
import { generatePageHTML, generatePageTSX } from './page';
import { GLOBAL_THEME, recipeByKey, recipeToCss, recipeToMarkup, type ProjectComponent, type PropValues } from '../library';
import { pageSections, resolvePlacement, type PageDef, type PagePlacement, type ProjectData, type ProjectMeta } from '../project';

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

  it("puts an option's own hover after the shared one, more specific, and keeps calm motion inside the project's scope", () => {
    const r = structuredClone(button);
    r.states.hover = { root: { shadow: 'a' } };
    r.variants[0].states = { [Object.keys(r.variants[0].options)[0]]: { hover: { root: { shadow: 'b' } } } };
    const css = recipeToCss(r, '.al-theme-p');
    const opt = css.indexOf(`[data-${r.variants[0].name}="${Object.keys(r.variants[0].options)[0]}"]:hover`);
    expect(opt).toBeGreaterThan(css.indexOf('.al-button:hover'));
    const calm = css.slice(css.indexOf('prefers-reduced-motion'));
    expect(calm).toContain('transition-property');
    expect(calm.match(/^\s*\.al-button/gm) ?? []).toHaveLength(0);   // every selector got the scope
  });

  it("loads the project's fonts in both exports, and a family name can't break out of the URL", () => {
    const meta = { name: 'p', fonts: [{ family: 'Rajdhani', weights: [500, 600] }, { family: 'x"><script>' }] } as ProjectMeta;
    for (const out of [generatePageHTML(home, { placements: [cta] }, components, GLOBAL_THEME, meta), generatePageTSX(home, { placements: [cta] }, components, GLOBAL_THEME, meta)]) {
      expect(out).toContain('family=Rajdhani:wght@500;600');
      expect(out).not.toContain('<script>"');
      expect(out).not.toContain('x">');
    }
  });

  it('pins a block to the screen outside <main>, moves it per tier, keeps its edge clear, and bounds a scrolling block', () => {
    const rail: PagePlacement = { ...cta, id: 'rail', pin: { at: 'bottom', reserve: 56 }, at: { desktop: { pin: { at: 'top', reserve: 64 } } } };
    const read: PagePlacement = { ...cta, id: 'read', row: 1, bounded: true };
    for (const out of [generatePageHTML(home, { placements: [rail, read] }, components, GLOBAL_THEME), generatePageTSX(home, { placements: [rail, read] }, components, GLOBAL_THEME)]) {
      expect(out.indexOf('p-rail"')).toBeGreaterThan(out.lastIndexOf('</main>'));     // fixed can't sit in main's container
      expect(out).toMatch(/\.p-rail \{ display: block;[^}]*bottom: 0;/);
      expect(out).toContain('.page-main { padding: 64px 16px 0px 16px; }');          // desktop: the top is kept clear instead
      expect(out).toContain('max-height: calc(100dvh - 168px)');                      // mobile: 56 reserved + row 1 (96) + 16
    }
  });

  it("draws the backdrop under the page, and drops one that could break out of the CSS", () => {
    const out = (backdrop: string) => generatePageHTML({ ...home, backdrop }, { placements: [cta] }, components, GLOBAL_THEME);
    expect(out('linear-gradient(#000, #123)')).toContain('background: linear-gradient(#000, #123); background-size: cover');
    expect(out('red;} body{display:none')).not.toContain('body::before');
    expect(out('</style><script>')).not.toContain('<script>');
  });

  it("repeats over an item's own list, and draws corner ticks on a pseudo-element inside the project's scope", () => {
    const r = structuredClone(button);
    r.props.push({ name: 'entries', type: 'list', default: [], fields: ['title'], lists: { tags: ['label'] } });
    r.anatomy.style = { ...r.anatomy.style, ticks: 12, tickColor: '{color.focus}' };
    r.anatomy.children = [{ id: 'entry', kind: 'box', repeat: 'entries', text: '{item.title}', children: [
      { id: 'tag', kind: 'text', repeat: 'item.tags', text: '{item.label}' },
    ] }];
    const props: PropValues = { entries: [{ title: 'LANGUAGES', tags: [{ label: 'Python' }, { label: '<b>' }] }, { title: 'TOOLS' }] };
    const html = recipeToMarkup(r, props, undefined, '', true);
    expect(html.match(/al-button__tag/g)).toHaveLength(2);
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('[object');
    const css = recipeToCss(r, '.al-theme-p');
    expect(css).toContain('.al-theme-p .al-button::before');
    expect(css).toMatch(/linear-gradient\(var\(--color-focus\)/);
  });

  it('marks a link to the page it is on as current, in the export', () => {
    const rail = recipeByKey('nav-bar')!;
    const comps = { nav: { id: 'nav', projectId: 'p', origin: { recipe: rail.key, version: rail.version }, recipe: rail, tags: [] } };
    const nav: PagePlacement = { ...cta, id: 'nav', componentId: 'nav', props: { links: [{ label: 'Home', href: '/home/' }, { label: 'Other', href: '/other' }] } };
    const out = generatePageHTML(home, { placements: [nav] }, comps, GLOBAL_THEME);
    expect(out.match(/aria-current="page"/g)?.length).toBeGreaterThan(0);
    expect(out).toMatch(/href="\/home\/" aria-current="page"/);
    expect(out).not.toMatch(/href="\/other" aria-current/);
  });

  it('shows other pages in place as #sections, with links to them kept on the page, and no sections inside sections', () => {
    const rail = recipeByKey('nav-bar')!;
    const comps = { ...components, nav: { id: 'nav', projectId: 'p', origin: { recipe: rail.key, version: rail.version }, recipe: rail, tags: [] } };
    const nav: PagePlacement = { ...cta, id: 'nav', componentId: 'nav', pin: { at: 'top' }, props: { links: [{ label: 'Work', href: '/work' }] } };
    const project = {
      meta: { id: 'p', name: 'p', createdAt: 0, updatedAt: 0 }, wireframes: {},
      pages: [{ path: '/', name: 'Home', sections: ['/work', '/nest', '/gone'] }, { path: '/work', name: 'Work' }, { path: '/nest', name: 'Nest', sections: ['/work'] }],
      layouts: { '/': { placements: [nav] }, '/work': { placements: [{ ...cta, id: 'w' }] }, '/nest': { placements: [] } },
    } as unknown as ProjectData;
    const secs = pageSections(project, project.pages[0]);
    expect(secs.map((x) => x.id)).toEqual(['work']);
    for (const out of [generatePageHTML(project.pages[0], project.layouts['/'], comps, GLOBAL_THEME, undefined, secs), generatePageTSX(project.pages[0], project.layouts['/'], comps, GLOBAL_THEME, undefined, secs)]) {
      expect(out).toMatch(/<section id="work" class(Name)?="page-grid page-sec"/);
      expect(out).toContain('work--p-w');
      expect(out).toContain('href="#work"');
      expect(out).toContain('.page-sec:not(:target)');
    }
  });
});
