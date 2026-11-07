// The API routes against a scratch folder: what reaches disk, what's refused, and conflicts.
// The routes find their folders from process.cwd() when they load, so it points at a temp dir before importing them.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
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

const call = (fn: (r: Request) => Promise<Response>, url: string, init: RequestInit & { json?: unknown } = {}) =>
  fn(new Request(`http://local${url}`, { ...init, body: init.json !== undefined ? JSON.stringify(init.json) : init.body }));
const put = (fn: (r: Request) => Promise<Response>, url: string, json: unknown, base?: string | null) =>
  call(fn, url, { method: 'PUT', json, headers: base ? { 'x-base-mtime': base } : {} });
const onDisk = (...p: string[]) => JSON.parse(readFileSync(path.join(tmp, ...p), 'utf8'));
const noTempFiles = (...p: string[]) => readdirSync(path.join(tmp, ...p)).filter((f) => f.endsWith('.tmp'));

const BIBLE = { title: 'Test', pitch: 'A test.', created: '2026-11-07', template: 'game', topics: [] };
const PAGE = { title: 'Overview', blocks: [], elements: [{ id: 'r', type: 'rect', x: 10, y: 10, w: 100, h: 50 }] };

describe('design bibles', () => {
  it('writes a bible and a page, and reads them back with their mtime', async () => {
    expect((await put(design.PUT, '/api/design?bible=test', BIBLE)).status).toBe(200);
    const w = await put(design.PUT, '/api/design?bible=test&page=index', PAGE);
    expect(w.status).toBe(200);
    const r = await call(design.GET, '/api/design?bible=test&page=index');
    expect(await r.json()).toEqual(PAGE);
    expect(r.headers.get('x-mtime')).toBe(w.headers.get('x-mtime'));
    expect(noTempFiles('design/test/pages')).toEqual([]);   // written to a temp file, then renamed into place
  });

  it('refuses a write from an older copy of the file (409), and leaves the file alone', async () => {
    const m1 = (await call(design.GET, '/api/design?bible=test&page=index')).headers.get('x-mtime');
    const agent = await put(design.PUT, '/api/design?bible=test&page=index', { ...PAGE, title: 'Agent' }, m1);   // someone saves first
    expect(agent.status).toBe(200);
    const me = await put(design.PUT, '/api/design?bible=test&page=index', { ...PAGE, title: 'Me' }, m1);         // still based on m1
    expect(me.status).toBe(409);
    expect(onDisk('design/test/pages/index.json').title).toBe('Agent');
    expect((await put(design.PUT, '/api/design?bible=test&page=index', { ...PAGE, title: 'Me' }, agent.headers.get('x-mtime'))).status).toBe(200);
  });

  it('refuses an invalid page (422) with the reasons, and writes nothing', async () => {
    const r = await put(design.PUT, '/api/design?bible=test&page=broken', { title: 'x', blocks: [], elements: [{ id: 'a', type: 'blob' }] });
    expect(r.status).toBe(422);
    expect((await r.json()).errors[0]).toMatch(/unknown "blob"/);
    expect(existsSync(path.join(tmp, 'design/test/pages/broken.json'))).toBe(false);
  });

  it("won't read or write outside design/", async () => {
    for (const q of ['bible=..%2Fetc', 'bible=test&page=..%2F..%2Fx', 'bible=Test', 'bible=.hidden']) expect((await call(design.GET, `/api/design?${q}`)).status).toBe(400);
    expect((await put(design.PUT, '/api/design?bible=..%2F..%2Fescape', BIBLE)).status).toBe(400);
    expect((await put(design.PUT, '/api/design?bible=test&page=..%2Fbible', PAGE)).status).toBe(400);
    expect((await call(design.GET, '/api/design?bible=test&asset=..%2F..%2Fbible.json')).status).toBe(400);
    const notImage = await call(design.PUT, '/api/design?bible=test&asset=run.sh', { method: 'PUT', body: 'echo hi' });
    expect(notImage.status).toBe(400);
    expect(readdirSync(tmp).sort()).toEqual(['design']);
  });

  it('says what is missing (404)', async () => {
    expect((await call(design.GET, '/api/design?bible=test&page=nope')).status).toBe(404);
    expect((await call(design.GET, '/api/design?bible=nobody')).status).toBe(404);
  });
});

describe('vault', () => {
  const ASSET = { title: 'Post', kind: 'block', blocks: [], elements: [{ id: 'r', type: 'rect', x: 0, y: 0, w: 10, h: 10 }] };

  it("creates a new file only once (new=1), so two 'new' pieces never overwrite each other", async () => {
    expect((await put(vault.PUT, '/api/vault?asset=post&new=1', ASSET)).status).toBe(200);
    expect((await put(vault.PUT, '/api/vault?asset=post&new=1', { ...ASSET, title: 'Other' })).status).toBe(409);
    expect(onDisk('vault/assets/post.json').title).toBe('Post');
  });

  it("won't delete a piece a page uses, unless forced, and says where it's used", async () => {
    await put(design.PUT, '/api/design?bible=test&page=uses', { ...PAGE, elements: [{ id: 'a', type: 'asset', asset: 'post', x: 0, y: 0, w: 10, h: 10 }] });
    const r = await call(vault.DELETE, '/api/vault?asset=post', { method: 'DELETE' });
    expect(r.status).toBe(409);
    expect((await r.json()).usedIn).toEqual(['test/uses']);
    expect((await call(vault.DELETE, '/api/vault?asset=post&force=1', { method: 'DELETE' })).status).toBe(200);
    expect(existsSync(path.join(tmp, 'vault/assets/post.json'))).toBe(false);
  });

  it('refuses invalid pieces and bad names', async () => {
    expect((await put(vault.PUT, '/api/vault?asset=bad', { ...ASSET, kind: 'thing' })).status).toBe(422);
    expect((await put(vault.PUT, '/api/vault?asset=..%2Fx', ASSET)).status).toBe(400);
    expect((await put(vault.PUT, '/api/vault?nothing=x', ASSET)).status).toBe(400);
  });
});

describe('web projects', () => {
  const PROJECT = { meta: { id: 'site', name: 'Site' }, pages: [{ path: '/', name: 'Home' }], layouts: {}, wireframes: {} };

  it('saves, lists and loads a project, with conflicts refused like the others', async () => {
    const w = await put(projects.PUT, '/api/projects?id=site', PROJECT);
    expect(w.status).toBe(204);
    const one = await (await call(projects.GET, '/api/projects?id=site')).json();
    expect(one.project).toEqual(PROJECT);
    expect(one.mtime).toBe(w.headers.get('x-mtime'));
    expect((await (await call(projects.GET, '/api/projects')).json()).map((p: { id: string }) => p.id)).toEqual(['site']);

    const next = await put(projects.PUT, '/api/projects?id=site', { ...PROJECT, meta: { ...PROJECT.meta, name: 'B' } }, one.mtime);
    expect(next.status).toBe(204);
    expect((await put(projects.PUT, '/api/projects?id=site', PROJECT, one.mtime)).status).toBe(409);
    expect(onDisk('projects/site.json').meta.name).toBe('B');
  });

  it('refuses a broken project and bad ids, and deletes on request', async () => {
    expect((await put(projects.PUT, '/api/projects?id=site', { meta: {} })).status).toBe(422);
    expect((await put(projects.PUT, '/api/projects?id=..%2Fescape', PROJECT)).status).toBe(400);
    expect((await call(projects.GET, '/api/projects?id=missing')).status).toBe(404);
    expect((await call(projects.DELETE, '/api/projects?id=site', { method: 'DELETE' })).status).toBe(204);
    expect(existsSync(path.join(tmp, 'projects/site.json'))).toBe(false);
  });
});
