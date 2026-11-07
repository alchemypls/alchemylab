// The guards between the canvases, the agent and your files, run against a scratch folder.
// The routes find their folders from process.cwd() when they load, so it points at a temp dir before importing them.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let tmp: string;
let design: typeof import('./design/route');
let vault: typeof import('./vault/route');
let projects: typeof import('./projects/route');

beforeAll(async () => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'alchemy-api-'));
  vi.spyOn(process, 'cwd').mockReturnValue(tmp);
  vi.resetModules();
  [design, vault, projects] = await Promise.all([import('./design/route'), import('./vault/route'), import('./projects/route')]);
});
afterAll(() => { vi.restoreAllMocks(); rmSync(tmp, { recursive: true, force: true }); });

type Handler = (r: Request) => Promise<Response>;
const call = (fn: Handler, url: string, method = 'GET', json?: unknown, base?: string | null) =>
  fn(new Request(`http://localhost${url}`, { method, body: json === undefined ? undefined : JSON.stringify(json), headers: base ? { 'x-base-mtime': base } : {} }));
const onDisk = (file: string) => JSON.parse(readFileSync(path.join(tmp, file), 'utf8'));

const BIBLE = { title: 'Test', pitch: 'A test.', created: '2026-11-07', template: 'game', topics: [] };
const PAGE = { title: 'Overview', blocks: [], elements: [{ id: 'r', type: 'rect', x: 10, y: 10, w: 100, h: 50 }] };
const ASSET = { title: 'Post', kind: 'block', blocks: [], elements: [] };
const PROJECT = { meta: { id: 'site', name: 'Site' }, pages: [{ path: '/', name: 'Home' }], layouts: {}, wireframes: {} };

describe('saving to disk', () => {
  it('refuses a save made from an older copy (the agent or another tab saved first), for bibles and projects', async () => {
    await call(design.PUT, '/api/design?bible=test', 'PUT', BIBLE);
    const m1 = (await call(design.PUT, '/api/design?bible=test&page=index', 'PUT', PAGE)).headers.get('x-mtime');
    expect((await call(design.PUT, '/api/design?bible=test&page=index', 'PUT', { ...PAGE, title: 'Agent' }, m1)).status).toBe(200);
    expect((await call(design.PUT, '/api/design?bible=test&page=index', 'PUT', { ...PAGE, title: 'Me' }, m1)).status).toBe(409);
    expect(onDisk('design/test/pages/index.json').title).toBe('Agent');

    const p1 = (await call(projects.PUT, '/api/projects?id=site', 'PUT', PROJECT)).headers.get('x-mtime');
    await call(projects.PUT, '/api/projects?id=site', 'PUT', { ...PROJECT, meta: { ...PROJECT.meta, name: 'B' } }, p1);
    expect((await call(projects.PUT, '/api/projects?id=site', 'PUT', PROJECT, p1)).status).toBe(409);
    expect(onDisk('projects/site.json').meta.name).toBe('B');
  });

  it('refuses invalid files with the reason, and writes nothing', async () => {
    const r = await call(design.PUT, '/api/design?bible=test&page=broken', 'PUT', { title: 'x', blocks: [], elements: [{ id: 'a', type: 'blob' }] });
    expect(r.status).toBe(422);
    expect((await r.json()).errors[0]).toMatch(/unknown "blob"/);
    expect(existsSync(path.join(tmp, 'design/test/pages/broken.json'))).toBe(false);
    expect((await call(vault.PUT, '/api/vault?asset=bad', 'PUT', { ...ASSET, kind: 'thing' })).status).toBe(422);
    expect((await call(projects.PUT, '/api/projects?id=bad', 'PUT', { meta: {} })).status).toBe(422);
  });

  it("won't read or write outside its folders, whatever the id", async () => {
    const get = (fn: Handler, url: string) => call(fn, url), put = (fn: Handler, url: string) => call(fn, url, 'PUT', PAGE);
    for (const r of [
      get(design.GET, '/api/design?bible=..%2Fetc'), put(design.PUT, '/api/design?bible=test&page=..%2Fbible'),
      get(design.GET, '/api/design?bible=test&asset=..%2F..%2Fbible.json'), put(design.PUT, '/api/design?bible=test&asset=run.sh'),
      put(vault.PUT, '/api/vault?asset=..%2Fx'), put(projects.PUT, '/api/projects?id=..%2Fescape'),
    ]) expect((await r).status).toBe(400);
    expect(readdirSync(tmp).sort()).toEqual(['design', 'projects']);
  });
});

describe('the vault', () => {
  it("never overwrites with a 'new' piece, and won't delete one a page uses unless forced", async () => {
    expect((await call(vault.PUT, '/api/vault?asset=post&new=1', 'PUT', ASSET)).status).toBe(200);
    expect((await call(vault.PUT, '/api/vault?asset=post&new=1', 'PUT', { ...ASSET, title: 'Other' })).status).toBe(409);
    await call(design.PUT, '/api/design?bible=test&page=uses', 'PUT', { ...PAGE, elements: [{ id: 'a', type: 'asset', asset: 'post', x: 0, y: 0, w: 10, h: 10 }] });
    const r = await call(vault.DELETE, '/api/vault?asset=post', 'DELETE');
    expect([r.status, (await r.json()).usedIn]).toEqual([409, ['test/uses']]);
    expect(onDisk('vault/assets/post.json').title).toBe('Post');
    expect((await call(vault.DELETE, '/api/vault?asset=post&force=1', 'DELETE')).status).toBe(200);
  });
});
