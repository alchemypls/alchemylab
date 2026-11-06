"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bible, BibleSummary, DesignPage } from '@/lib/design/types';

async function get<T>(qs: string): Promise<{ body: T; mtime: string | null }> {
  const res = await fetch(`/api/design${qs}`, { cache: 'no-store' });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return { body: body as T, mtime: res.headers.get('x-mtime') };
}

export type SaveResult = { ok: true } | { ok: false; conflict: boolean; error: string };

// Loads a bible + one of its pages from design/ and reloads whenever a file there changes.
// On a bad read (e.g. a half-written file) the last good copy stays and `error` says why.
// savePage/saveBible write back with the mtime they loaded; if the file changed since, the write
// is refused (conflict) so a hand edit never silently clobbers what the agent just wrote.
export function useDesignDoc(bibleId: string | undefined, pageId: string) {
  const [list,  setList]  = useState<BibleSummary[]>([]);
  const [bible, setBible] = useState<Bible | null>(null);
  const [page,  setPage]  = useState<DesignPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mtimes = useRef<{ bible: string | null; page: string | null }>({ bible: null, page: null });
  const openPage = useRef(''); openPage.current = `${bibleId}/${pageId}`;

  const load = useCallback(async () => {
    try {
      setList((await get<BibleSummary[]>('')).body);
      if (!bibleId) { setBible(null); setPage(null); setError(null); return; }
      const b = await get<Bible>(`?bible=${bibleId}`);
      mtimes.current.bible = b.mtime;
      setBible(b.body);
      const p = await get<DesignPage>(`?bible=${bibleId}&page=${pageId}`);
      mtimes.current.page = p.mtime;
      setPage(p.body);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      if ((e as Error).message.includes('not built yet')) setPage(null);
    }
  }, [bibleId, pageId]);

  useEffect(() => {
    load();
    const es = new EventSource('/api/design/watch');
    es.onmessage = () => load();
    return () => es.close();
  }, [load]);

  const put = useCallback(async (which: 'bible' | 'page', body: unknown): Promise<SaveResult> => {
    if (!bibleId) return { ok: false, conflict: false, error: 'No bible' };
    const qs = which === 'page' ? `?bible=${bibleId}&page=${pageId}` : `?bible=${bibleId}`;
    const base = mtimes.current[which];
    const res = await fetch(`/api/design${qs}`, {
      method: 'PUT',
      headers: base ? { 'x-base-mtime': base } : {},
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res) return { ok: false, conflict: false, error: 'Dev server unreachable' };
    if (res.ok) {
      // A save that lands after switching pages must not overwrite the new page's mtime
      if (openPage.current === `${bibleId}/${pageId}`) mtimes.current[which] = res.headers.get('x-mtime');
      return { ok: true };
    }
    const err = await res.json().catch(() => ({}));
    if (res.status === 409) load();
    return { ok: false, conflict: res.status === 409, error: err.error ?? res.statusText };
  }, [bibleId, pageId, load]);

  const savePage  = useCallback((p: DesignPage) => put('page', p), [put]);
  const saveBible = useCallback(async (b: Bible) => {
    setBible(b);   // topic edits are small and immediate — show them before the round trip
    return put('bible', b);
  }, [put]);

  return { list, bible, page, error, savePage, saveBible, reload: load };
}
