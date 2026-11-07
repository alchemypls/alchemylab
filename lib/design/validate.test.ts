import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { pageHash, validateAsset, validateBible, validatePage, type BibleContext } from './validate';
import { validatePalette } from './palette';

const ok = { title: 'Page', blocks: [], elements: [{ id: 'r', type: 'rect', x: 10, y: 10, w: 100, h: 50 }] };
const errorsOf = (raw: unknown, ctx?: BibleContext) => validatePage(raw, ctx).errors;

describe('page validation (the API refuses a write with errors)', () => {
  it('accepts a good page', () => expect(validatePage(ok)).toEqual({ errors: [], warnings: [] }));

  it('rejects broken pages with a message that says what to fix', () => {
    expect(errorsOf(null)).toEqual(['page is not an object']);
    expect(errorsOf({ ...ok, title: ' ' })).toContain('title: required string');
    expect(errorsOf({ ...ok, elements: [{ id: 'r', type: 'blob' }] })[0]).toMatch(/unknown "blob"/);
    expect(errorsOf({ ...ok, elements: [{ id: 'r', type: 'rect', x: 'ten', y: 0, w: 1, h: 1 }] })[0]).toMatch(/\.x: required number/);
    expect(errorsOf({ ...ok, elements: [ok.elements[0], ok.elements[0]] })[0]).toMatch(/duplicate id/);
    expect(errorsOf({ ...ok, elements: [{ ...ok.elements[0], name: 3 }] })[0]).toMatch(/\.name: string/);
  });

  it('warns, without refusing, about references that lead nowhere', () => {
    const page = { ...ok, elements: [{ ...ok.elements[0], link: 'nowhere' }, { id: 'a', type: 'asset', asset: 'ghost', x: 0, y: 0, w: 10, h: 10 }] };
    const r = validatePage(page, { pages: ['index'], assets: [], vault: ['ball'] });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('\n')).toMatch(/unknown page "nowhere"[\s\S]*"ghost" not in vault/);
  });
});

describe('asset validation', () => {
  const asset = { title: 'Post', kind: 'block', blocks: [], elements: [], footprint: { cols: 1, rows: 1 } };
  it('accepts a block with a footprint', () => expect(validateAsset(asset).errors).toEqual([]));
  it("refuses what a vault piece can't hold: other assets, links, bindings, odd footprints", () => {
    expect(validateAsset({ ...asset, kind: 'thing' }).errors[0]).toMatch(/kind/);
    expect(validateAsset({ ...asset, footprint: { cols: 0, rows: 99 } }).errors[0]).toMatch(/footprint/);
    expect(validateAsset({ ...asset, elements: [{ id: 'r', type: 'rect', x: 0, y: 0, w: 1, h: 1, link: 'index' }] }).errors.join()).toMatch(/can't link/);
  });
});

describe('fit report fingerprint', () => {
  it('changes when the page changes, so a stale report never passes as current', () => {
    expect(pageHash(ok)).toBe(pageHash(structuredClone(ok)));
    expect(pageHash(ok)).not.toBe(pageHash({ ...ok, title: 'Page 2' }));
  });
});

// The real content in the repo: what `npm run design:check` checks, run on every test pass
describe('the files on disk', () => {
  const root = process.cwd(), json = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
  const ls = (d: string) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.json')) : []);
  const vault = ls(path.join(root, 'vault/assets')).map((f) => f.slice(0, -5));

  it.each(vault)('vault/assets/%s.json is valid', (id) => expect(validateAsset(json(`vault/assets/${id}.json`)).errors).toEqual([]));
  it.each(ls(path.join(root, 'vault/palettes')))('vault/palettes/%s is valid', (f) => expect(validatePalette(json(`vault/palettes/${f}`)).errors).toEqual([]));

  for (const bible of existsSync('design') ? readdirSync('design') : []) {
    const dir = `design/${bible}`, pages = ls(`${dir}/pages`).map((f) => f.slice(0, -5));
    const b = json(`${dir}/bible.json`);
    const ctx: BibleContext = { pages, assets: existsSync(`${dir}/assets`) ? readdirSync(`${dir}/assets`) : [], topics: b.topics.map((t: { id: string }) => t.id), vault };
    it(`${dir}/bible.json is valid`, () => expect(validateBible(b, ctx)).toEqual({ errors: [], warnings: [] }));
    it.each(pages)(`${dir}/pages/%s.json is valid, with nothing dangling`, (p) => expect(validatePage(json(`${dir}/pages/${p}.json`), ctx)).toEqual({ errors: [], warnings: [] }));
  }
});
