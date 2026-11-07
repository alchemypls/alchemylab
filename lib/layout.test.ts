import { describe, expect, it } from 'vitest';
import { tierOf, TIER_COLUMNS } from './devices';
import { resolvePlacement, stackForMobile, type PagePlacement } from './project';
import { buildRouteTree, nameFromPath, normalizePath } from './routes';
import type { PageDef } from './project';

const place = (p: Partial<PagePlacement>): PagePlacement => ({ id: 'p', componentId: 'c', col: 0, row: 0, colSpan: 4, rowSpan: 1, ...p });

describe('breakpoint tiers', () => {
  it('switches exactly at 600 and 1024 (mobile-first min-widths)', () => {
    expect([0, 599, 600, 1023, 1024, 3840].map(tierOf)).toEqual(['mobile', 'mobile', 'tablet', 'tablet', 'desktop', 'desktop']);
  });
});

describe('placement cascade', () => {
  it('scales a mobile placement up to the 8 and 12 column grids', () => {
    const p = place({ col: 1, colSpan: 2 });
    expect(resolvePlacement(p, 'mobile')).toMatchObject({ col: 1, colSpan: 2 });
    expect(resolvePlacement(p, 'tablet')).toMatchObject({ col: 2, colSpan: 4 });
    expect(resolvePlacement(p, 'desktop')).toMatchObject({ col: 3, colSpan: 6 });
  });

  it('lets a tier override win, and the tiers above inherit the override', () => {
    const p = place({ at: { tablet: { col: 0, colSpan: 8 } } });
    expect(resolvePlacement(p, 'tablet')).toMatchObject({ col: 0, colSpan: 8 });
    expect(resolvePlacement(p, 'desktop')).toMatchObject({ col: 0, colSpan: 12 });
  });

  it('never lets a block hang off the right edge', () => {
    for (const tier of ['mobile', 'tablet', 'desktop'] as const)
      for (let col = 0; col < 4; col++) for (let colSpan = 1; colSpan <= 4; colSpan++) {
        const g = resolvePlacement(place({ col, colSpan: Math.min(colSpan, 4 - col) }), tier);
        expect(g.col + g.colSpan).toBeLessThanOrEqual(TIER_COLUMNS[tier]);
        expect(g.colSpan).toBeGreaterThanOrEqual(1);
      }
  });

  it('stacks a wide layout into one mobile column in reading order', () => {
    const out = stackForMobile([place({ id: 'b', row: 0, col: 6, rowSpan: 2 }), place({ id: 'a', row: 0, col: 0, rowSpan: 1 }), place({ id: 'c', row: 3, col: 0, rowSpan: 1 })]);
    expect(['a', 'b', 'c'].map((id) => out.get(id)!.row)).toEqual([0, 1, 3]);
    expect(Array.from(out.values()).every((g) => g.col === 0 && g.colSpan === 4)).toBe(true);
  });
});

describe('routes', () => {
  const pg = (path: string) => ({ path, name: path }) as PageDef;

  it('builds folders from path segments; a node can be a page and a folder', () => {
    const root = buildRouteTree([pg('/blog/post'), pg('/blog'), pg('/about')]);
    const blog = root.children.find((c) => c.seg === 'blog')!;
    expect(blog.page?.path).toBe('/blog');
    expect(blog.children.map((c) => c.path)).toEqual(['/blog/post']);
    expect(root.children[0].seg).toBe('blog');   // folders before pages
  });

  it('normalizes what people type into a path', () => {
    expect(normalizePath('  blog / my-post/ ')).toBe('/blog/my-post');
    expect(normalizePath('')).toBe('/');
    expect(nameFromPath('/blog/my-first_post')).toBe('My first post');
    expect(nameFromPath('/')).toBe('Home');
  });
});
