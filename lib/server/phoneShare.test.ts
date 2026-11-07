// The phone gateway is the only way in from the network: it may pass on viewing Live pages and nothing else.
import { describe, expect, it } from 'vitest';
import { shareable } from './phoneShare';

describe('phone sharing', () => {
  it('passes on Live pages and their live-reload stream', () => {
    for (const url of ['/live/site', '/live/site/blog/post?x=1', '/api/projects/watch']) expect(shareable(url)).toBe(true);
  });

  it('passes on nothing else, including tricks to step out of /live/', () => {
    for (const url of [
      '/', '/api/projects?id=site', '/api/vault', '/api/projects/watch/../../vault', '/api/lan',
      '/live/../api/vault', '/live/%2e%2e/api/vault', '/live/..%2fapi%2fvault', '/live\\..\\api', '/live/%E0%A4%A', '/livex',
    ]) expect(shareable(url)).toBe(false);
  });
});
