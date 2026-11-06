"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDesignDoc, type SaveResult } from './useDesignDoc';
import { pageHash } from '@/lib/design/validate';
import type { FitReport } from '@/lib/design/types';

const SAVE_DEBOUNCE_MS = 450;
const COALESCE_MS = 1200;   // keystrokes on one field within this window = one undo step
const HISTORY_MAX = 50;

export type SaveState = { kind: 'idle' | 'saving' | 'saved' } | { kind: 'error' | 'conflict'; message: string };

// A file on disk, editable: a local draft with undo and autosave. `docKey` names the file.
// Hand edits live in the draft until saved. While it's dirty, reloads from disk don't touch it;
// if the agent wrote the file in the meantime the save is refused (409) and the disk copy wins.
export function useFileDraft<P extends object>(docKey: string, page: P | null, savePage: (p: P) => Promise<SaveResult>) {
  const [draft,  setDraftState] = useState<P | null>(null);
  const [past,   setPast]   = useState<P[]>([]);
  const [future, setFuture] = useState<P[]>([]);
  const [save,   setSave]   = useState<SaveState>({ kind: 'idle' });
  const draftRef = useRef<P | null>(null);
  const dirty    = useRef(false);
  const timer    = useRef<ReturnType<typeof setTimeout>>();
  const lastEdit = useRef<{ key?: string; at: number }>({ at: 0 });

  const setDraft = (p: P | null) => { draftRef.current = p; setDraftState(p); };

  const flush = useCallback(async (next: P) => {
    setSave({ kind: 'saving' });
    const r = await savePage(next);
    if (draftRef.current === next) dirty.current = false;   // no newer edits arrived while saving
    if (r.ok) return setSave({ kind: 'saved' });
    dirty.current = false;   // let the disk copy back in
    if (r.conflict) { setPast([]); setFuture([]); }
    setSave({ kind: r.conflict ? 'conflict' : 'error', message: r.conflict ? 'Changed on disk — reloaded; your last edit was dropped' : r.error });
  }, [savePage]);

  // Switching file: drop history. Leaving (or unmounting) saves what's pending first,
  // through this file's own `flush`, so a quick edit-then-switch keeps the edit.
  useEffect(() => {
    setPast([]); setFuture([]); setSave({ kind: 'idle' });
    return () => {
      clearTimeout(timer.current);
      if (dirty.current && draftRef.current) flush(draftRef.current);
      dirty.current = false;
    };
  }, [docKey]); // eslint-disable-line react-hooks/exhaustive-deps -- flush belongs to this file

  // Follow disk unless there are unsaved hand edits. A change that isn't our own save echoing back
  // means someone else (the agent) wrote the file — clear undo so it can't revert their work.
  useEffect(() => {
    if (dirty.current) return;
    if (page && draftRef.current && pageHash(page) !== pageHash(draftRef.current)) { setPast([]); setFuture([]); }
    setDraft(page);
  }, [page]);

  const commit = (next: P) => {
    setDraft(next);
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(next), SAVE_DEBOUNCE_MS);
  };

  const apply = (next: P, key?: string) => {
    const cur = draftRef.current;
    if (!cur) return;
    const now = Date.now();
    if (!(key && key === lastEdit.current.key && now - lastEdit.current.at < COALESCE_MS)) {
      setPast((p) => [...p.slice(-(HISTORY_MAX - 1)), cur]);
      setFuture([]);
    }
    lastEdit.current = { key, at: now };
    commit(next);
  };

  const undo = () => {
    const prev = past[past.length - 1], cur = draftRef.current;
    if (!prev || !cur) return;
    setPast(past.slice(0, -1)); setFuture([cur, ...future]);
    lastEdit.current = { at: 0 };
    commit(prev);
  };
  const redo = () => {
    const next = future[0], cur = draftRef.current;
    if (!next || !cur) return;
    setFuture(future.slice(1)); setPast([...past, cur]);
    lastEdit.current = { at: 0 };
    commit(next);
  };

  return {
    shown: draft ?? page, current: draftRef,
    apply, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0,
    save, setSave,
  };
}

// One design page, editable. Also reports whether the page fits (design/<bible>/.render.json),
// so the agent can check without seeing it.
export function useDesignEditor(bibleId: string | undefined, pageId: string) {
  const { list, bible, page, error, savePage, saveBible } = useDesignDoc(bibleId, pageId);
  const draft = useFileDraft(`${bibleId}/${pageId}`, page, savePage);
  const [fit, setFit] = useState<Omit<FitReport, 'at'> | null>(null);
  const { current } = draft;

  useEffect(() => setFit(null), [bibleId, pageId]);

  const lastReport = useRef('');
  const onFit = useCallback((r: Omit<FitReport, 'at' | 'hash'>) => {
    const shown = current.current;
    if (!bibleId || !shown) return;
    const report = { ...r, hash: pageHash(shown) };
    setFit(report);
    const key = `${bibleId}/${pageId}:${JSON.stringify(report)}`;
    if (key === lastReport.current) return;
    lastReport.current = key;
    fetch(`/api/design/fit?bible=${bibleId}&page=${pageId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...report, at: new Date().toISOString() }),
    }).catch(() => { /* fit report is best-effort */ });
  }, [bibleId, pageId, current]);

  return { ...draft, list, bible, error, saveBible, fit, onFit };
}
