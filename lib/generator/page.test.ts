// The export: what people type can't become code, both formats ship the same thing, and layouts cascade mobile-first.
import { describe, expect, it } from 'vitest';
import { generatePageHTML, generatePageTSX } from './page';
import { BEHAVIORS, GLOBAL_THEME, recipeByKey, recipeToCss, recipeToMarkup, type ProjectComponent, type PropValues } from '../library';
import { containerCols, duplicateBlock, placedAt, ungroupBlock, wrapInGroup, layoutEdit, pageSections, reparented, resolvePlacement, upgradeGrid, withTierGeom, type PageDef, type PagePlacement, type ProjectData, type ProjectMeta } from '../project';

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

  it('lays out mobile-first: a placement scales up to 12 and 24 columns, and a tier override wins from there up', () => {
    expect(resolvePlacement(cta, 'tablet')).toMatchObject({ col: 2, colSpan: 3 });
    expect(resolvePlacement(cta, 'desktop')).toMatchObject({ col: 4, colSpan: 6 });
    const wide = { ...cta, at: { tablet: { col: 0, colSpan: 12 } } };
    expect(resolvePlacement(wide, 'desktop')).toMatchObject({ col: 0, colSpan: 24 });
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
      expect(out).toContain('max-height: calc(100dvh - 120px)');                      // mobile: 56 reserved + row 1 (32 + 16) + 16
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

  it('ships the press burst and the alive glow: runtimes in the script, the alive state as [data-alive], set per use by a prop', () => {
    const r = structuredClone(button);
    r.props = [...r.props, { name: 'alive', type: 'choice', default: '', options: ['', 'always', 'section', 'focus'] }];
    r.behaviors = [{ type: 'burst', params: { colors: 'var(--color-gold), var(--color-flame)' } }, { type: 'alive', params: { 'alive-while': '{prop.alive}' } }];
    r.states.alive = { root: { shadow: '0 0 8px gold' } };
    const comps = { btn: { ...components.btn, recipe: r } };
    const out = generatePageHTML(home, { placements: [{ ...cta, props: { alive: 'always' } }] }, comps, GLOBAL_THEME);
    expect(out).toContain('data-behavior="burst alive"');
    expect(out).toContain('data-alive-while="always"');
    expect(out).toMatch(/\.al-button\[data-alive\] \{\n {2}box-shadow: 0 0 8px gold;/);
    expect(out).toContain('[data-behavior~="burst"]');
    expect(out).toContain('[data-behavior~="alive"]');
    for (const k of ['burst', 'alive', 'leader', 'orb', 'backdrop', 'carousel', 'tabs']) expect(() => new Function(`return ${BEHAVIORS[k].attach.toString()}`)).not.toThrow();   // copied as text: must stand alone
  });

  it('steps between sections by keys, wheel and swipe, through the hash', () => {
    const project = {
      meta: { id: 'p', name: 'p', createdAt: 0, updatedAt: 0 }, wireframes: {},
      pages: [{ path: '/', name: 'Home', sections: ['/work'] }, { path: '/work', name: 'Work' }],
      layouts: { '/': { placements: [] }, '/work': { placements: [{ ...cta, id: 'w' }] } },
    } as unknown as ProjectData;
    const out = generatePageHTML(project.pages[0], project.layouts['/'], components, GLOBAL_THEME, undefined, pageSections(project, project.pages[0]));
    for (const ev of ['keydown', 'wheel', 'touchend']) expect(out).toMatch(new RegExp(`addEventListener\\(["']${ev}["']`));
    expect(out).toContain('location.hash = ids[j]');
  });

  it('ships the orb stick with every zone a real, labelled button, and its runtime', () => {
    const orb = recipeByKey('orb-stick')!;
    const comps = { orb: { id: 'orb', projectId: 'p', origin: { recipe: orb.key, version: orb.version }, recipe: orb, tags: [] } };
    const out = generatePageHTML(home, { placements: [{ ...cta, id: 'o', componentId: 'orb', pin: { at: 'bottom-right' } }] }, comps, GLOBAL_THEME);
    for (const role of ['stick', 'b2', 'side']) expect(out).toMatch(new RegExp(`<button[^>]*type="button"[^>]*data-role="${role}"[^>]*aria-label="[^"]+"`));
    expect(out).toContain('[data-behavior~="orb"]');
  });

  it('ships a live backdrop over the CSS one: the sky as a layer the runtime draws on, a video without autoplay; unsafe settings drop', () => {
    const sky = { kind: 'sky' as const, colors: 'var(--color-bg), #6B3A86', stars: 0.8 };
    for (const out of [generatePageHTML(home, { placements: [cta] }, components, GLOBAL_THEME, { live: sky } as ProjectMeta), generatePageTSX(home, { placements: [cta] }, components, GLOBAL_THEME, { live: sky } as ProjectMeta)]) {
      expect(out).toMatch(/<div class(Name)?="page-live" aria-hidden="true" data-behavior="backdrop" data-colors="var\(--color-bg\), #6B3A86" data-stars="0.8"/);
      expect(out).toMatch(/\[data-behavior~=\\?"backdrop\\?"\]/);   // the TSX carries the script as a JSON string
    }
    const video = generatePageHTML(home, { placements: [cta] }, components, GLOBAL_THEME, { live: { kind: 'video', src: '/sky.mp4', poster: '/sky.jpg' } } as ProjectMeta);
    expect(video).toContain('<video class="page-live" aria-hidden="true" data-behavior="backdrop" muted loop playsinline src="/sky.mp4" poster="/sky.jpg"');
    expect(video).not.toContain('autoplay');
    const off = { ...home, live: { kind: 'none' as const } };
    expect(generatePageHTML(off, { placements: [cta] }, components, GLOBAL_THEME, { live: sky } as ProjectMeta)).not.toContain('page-live');
    for (const bad of [{ kind: 'video', src: 'javascript:alert(1)' }, { kind: 'video', src: '//evil.example/x.mp4' }, { kind: 'video', src: '/x" onerror="y' }])
      expect(generatePageHTML(home, { placements: [cta] }, components, GLOBAL_THEME, { live: bad } as unknown as ProjectMeta)).not.toContain('page-live');
    expect(generatePageHTML(home, { placements: [cta] }, components, GLOBAL_THEME, { live: { kind: 'sky', colors: 'red; } body { x' } } as ProjectMeta)).not.toMatch(/page-live[^>]*data-colors/);   // the runtime's own source names data-colors
  });

  it("brings a section's pinned blocks onto the page it's shown on, hidden while another section shows; --tier steps 0/1/2", () => {
    const project = {
      meta: { id: 'p', name: 'p', createdAt: 0, updatedAt: 0 }, wireframes: {},
      pages: [{ path: '/', name: 'Home', sections: ['/a', '/b'] }, { path: '/a', name: 'A' }, { path: '/b', name: 'B' }],
      layouts: { '/': { placements: [{ ...cta, id: 'rail', componentId: 'nav', pin: { at: 'top' } }] }, '/a': { placements: [{ ...cta, id: 'x' }, { ...cta, id: 'arail', componentId: 'nav', pin: { at: 'top' } }] }, '/b': { placements: [{ ...cta, id: 'y' }, { ...cta, id: 'hud', pin: { at: 'bottom-left' } }] } },
    } as unknown as ProjectData;
    const out = generatePageHTML(project.pages[0], project.layouts['/'], components, GLOBAL_THEME, undefined, pageSections(project, project.pages[0]));
    expect(out).toContain('<div class="b--p-hud" data-sec="b">');
    expect(out).not.toContain('a--p-arail');   // the page pins its own rail: a section's copy stays behind
    expect(out).toContain('.page-main:not(:has(> #b:target)) ~ .b--p-hud { display: none !important; }');
    expect(out).toContain('bottom: calc(16px + env(safe-area-inset-bottom, 0px))');
    expect(out).toContain(':root { --tier: 0; }');
    expect(out).toContain(':root { --tier: 2; }');
  });
});


describe('layout editing', () => {
  const at = (id: string, col: number, row: number, colSpan = 2, rowSpan = 1): PagePlacement => ({ id, componentId: 'btn', col, row, colSpan, rowSpan });
  it('pushes the blocks in the way down, and the ones under them in turn; blocks beside it stay', () => {
    const ps = [at('a', 0, 0), at('b', 0, 1, 4), at('c', 0, 2), at('d', 6, 0)];
    expect(layoutEdit(ps, 'mobile', 'a', { rowSpan: 2 })).toEqual([{ id: 'a', geom: { rowSpan: 2 } }, { id: 'b', geom: { row: 2 } }, { id: 'c', geom: { row: 3 } }]);
    expect(layoutEdit(ps, 'mobile', 'd', { col: 9 })).toEqual([]);   // already at the right edge: kept inside the columns
    expect(layoutEdit(ps, 'tablet', 'a', { col: 8 })).toEqual([{ id: 'a', geom: { col: 8 } }, { id: 'd', geom: { row: 1 } }]);   // tablet: d is cols 9–11
  });

  it('carries a project on the old grid (4 / 8 / 12, 80px rows) over once: columns and rows double, tablet goes 8 → 12', () => {
    const old = { meta: { name: 'p' }, pages: [], wireframes: {}, layouts: { '/': { placements: [{ ...at('a', 1, 2, 2, 1), at: { tablet: { col: 2, colSpan: 4 }, desktop: { row: 3 } } }] } } } as unknown as ProjectData;
    const up = upgradeGrid(old), a = up.layouts['/'].placements[0];
    expect(a).toMatchObject({ col: 2, row: 4, colSpan: 4, rowSpan: 2, at: { tablet: { col: 3, colSpan: 6 }, desktop: { row: 6 } } });
    expect(upgradeGrid(up)).toEqual(up);   // once
  });

  it('a group splits its box on its own grid: edits push only the blocks beside them in it, and it ships as a subgrid', () => {
    const g: PagePlacement = { id: 'g', kind: 'group', col: 2, row: 0, colSpan: 6, rowSpan: 4 };
    const x = { ...at('x', 0, 0, 3), parent: 'g' }, y = { ...at('y', 0, 1, 6), parent: 'g' }, page = at('p', 0, 1);
    const ps = [g, x, y, page];
    expect(containerCols(ps, 'g', 'mobile')).toBe(6);
    expect(layoutEdit(ps, 'mobile', 'x', { rowSpan: 2, col: 9 })).toEqual([{ id: 'x', geom: { rowSpan: 2, col: 3 } }, { id: 'y', geom: { row: 2 } }]);   // p, outside, stays
    const html = generatePageHTML(home, { placements: ps }, components, GLOBAL_THEME);
    expect(html).toMatch(/\.p-g \{ grid-column: 3 \/ span 6; grid-row: 1 \/ span 4; display: grid; grid-template-columns: subgrid;/);
    expect(html.indexOf('class="p-x"')).toBeGreaterThan(html.indexOf('class="p-g"'));
    expect(html.indexOf('class="p-x"')).toBeLessThan(html.indexOf('class="p-p"'));   // inside the group's element, before the page's next block
    const out = reparented(ps, page, 'g', 'desktop', { col: 6, row: 2, colSpan: 6, rowSpan: 1 });   // dropped into the group on desktop (18 of its columns there)
    expect(out.parent).toBe('g');
    expect(resolvePlacement(out, 'desktop')).toMatchObject({ col: 6, row: 2, colSpan: 6 });
  });

  it('keeps a group’s insides within its columns up the tiers, and caps a scrolling block inside one from its row on the page', () => {
    const g: PagePlacement = { id: 'g', kind: 'group', col: 0, row: 3, colSpan: 2, rowSpan: 4 };
    const x: PagePlacement = { ...at('x', 1, 1, 1), parent: 'g', bounded: true };
    expect(resolvePlacement(x, 'tablet')).toMatchObject({ col: 2, colSpan: 2 });             // scaled alone: past the group's 3 columns
    expect(placedAt([g, x], x, 'tablet')).toMatchObject({ col: 1, colSpan: 2 });
    const html = generatePageHTML(home, { placements: [g, x] }, components, GLOBAL_THEME);
    expect(html).toContain('max-height: calc(100dvh - 208px)');                             // page row 3 + group row 1 = 4 × (32 + 16) + 16
  });

  it('the menu’s edits: wrap then ungroup puts a block back where it was on every tier; a duplicate group brings copies of its insides', () => {
    const a = { ...at('a', 2, 1, 4, 2), at: { desktop: { col: 10, colSpan: 8 } } }, b = at('b', 0, 3, 8);
    const wrapped = wrapInGroup([a, b], 'a'), gid = wrapped.id;
    for (const t of ['mobile', 'tablet', 'desktop'] as const) {
      const inG = wrapped.placements.find((p) => p.id === 'a')!;
      expect(placedAt(wrapped.placements, wrapped.placements.find((p) => p.id === gid)!, t)).toEqual(resolvePlacement(a, t));   // the group took its place
      expect(placedAt(wrapped.placements, inG, t)).toMatchObject({ col: 0, row: 0, colSpan: resolvePlacement(a, t).colSpan });
    }
    const back = ungroupBlock(wrapped.placements, gid, 'mobile');
    expect(back.map((p) => p.id).sort()).toEqual(['a', 'b']);
    for (const t of ['mobile', 'tablet', 'desktop'] as const) expect(resolvePlacement(back.find((p) => p.id === 'a')!, t)).toMatchObject(resolvePlacement(a, t));
    const dup = duplicateBlock(wrapped.placements, gid, 'mobile');
    const copy = dup.placements.find((p) => p.id === dup.id)!, inside = dup.placements.filter((p) => p.parent === copy.id);
    expect(inside).toHaveLength(1);
    expect(inside[0].id).not.toBe('a');
    expect(resolvePlacement(copy, 'mobile').row).toBe(3);                                    // under the original (rows 1–2)
    expect(resolvePlacement(dup.placements.find((p) => p.id === 'b')!, 'mobile').row).toBe(5);   // b moved out of its way
  });

  it('a wider tier keeps only what it changed: the rest follows Mobile, and moving it back drops the override', () => {
    const moved = withTierGeom(at('a', 0, 0), 'desktop', { row: 3 });
    expect(moved.at).toEqual({ desktop: { row: 3 } });
    expect(resolvePlacement({ ...moved, colSpan: 4 }, 'desktop')).toMatchObject({ row: 3, col: 0, colSpan: 12 });   // widened on Mobile: Desktop follows
    expect(withTierGeom(moved, 'desktop', { row: 0 }).at).toBeUndefined();
    expect(resolvePlacement(withTierGeom(at('a', 2, 0), 'desktop', { colSpan: 20 }), 'desktop')).toMatchObject({ col: 4, colSpan: 20 });   // kept inside the columns
  });
});
