"use client";

import { useEffect, useState } from 'react';

// ── Binary asset store (IndexedDB) ───────────────────────────────
// Images are too big for the persisted zustand state (localStorage caps ~5MB),
// so blobs live here and state only holds their `assetId`.

const DB_NAME = 'alchemy:assets';
const STORE   = 'blobs';

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then((d) => new Promise<T>((resolve, reject) => {
    const req = run(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  }));
}

export async function putAsset(blob: Blob, prefix = 'asset'): Promise<string> {
  const id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await tx('readwrite', (s) => s.put(blob, id));
  return id;
}

export const getAsset    = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id));
export const deleteAsset = (id: string) => tx('readwrite', (s) => s.delete(id));

// Object URLs are cached for the page lifetime — assets are immutable per id.
const urlCache = new Map<string, Promise<string | null>>();

export function assetUrl(id: string): Promise<string | null> {
  if (!urlCache.has(id)) {
    urlCache.set(id, getAsset(id).then((b) => (b ? URL.createObjectURL(b) : null)).catch(() => null));
  }
  return urlCache.get(id)!;
}

export function useAssetUrl(id: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (id) assetUrl(id).then((u) => { if (live) setUrl(u); });
    else setUrl(null);
    return () => { live = false; };
  }, [id]);
  return url;
}

// Natural pixel size of an image blob
export function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload  = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error('Unreadable image')); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

// Deletes every stored blob whose id isn't in `keep`. Removing an image from a sketch
// doesn't delete its blob (undo may bring it back) — this reclaims them later.
export async function gcAssets(keep: Set<string>): Promise<number> {
  const keys = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
  const dead = keys.map(String).filter((k) => !keep.has(k) && !k.startsWith('trace-'));   // tracing images belong to the canvases (useTrace)
  await Promise.all(dead.map(deleteAsset));
  return dead.length;
}
