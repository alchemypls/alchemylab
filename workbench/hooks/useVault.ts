"use client";

import { useSyncExternalStore } from 'react';
import { builtStructure } from '@/lib/design/structure';
import { isStructure, newAsset, PART_LAYERS, WALL_H, type AssetKind, type BlockPart, type Part, type VaultAsset } from '@/lib/design/vault';
import { layersOf } from '@/lib/design/layers';
import { newPalette, type Palette } from '@/lib/design/palette';
import type { SaveResult } from './useDesignDoc';

// The vault's files, live from disk. One copy and one watch for the whole app, because every placed
// asset and every color picker reads from it. Agent writes and edits from Fab show everywhere.

type VaultType = 'asset' | 'palette';
export interface VaultFile<T> { id: string; mtime: string | null; asset: T }
export type VaultEntry = VaultFile<VaultAsset>;
interface Collection<T> { entries: VaultFile<T>[]; loaded: boolean; error: string | null }

const FOLDER: Record<VaultType, string> = { asset: 'assets', palette: 'palettes' };
const state: Record<VaultType, Collection<unknown>> = {
  asset:   { entries: [], loaded: false, error: null },
  palette: { entries: [], loaded: false, error: null },
};
const listeners = new Set<() => void>();
let source: EventSource | null = null;

const emit = (type: VaultType, next: Partial<Collection<unknown>>) => {
  state[type] = { ...state[type], ...next };
  listeners.forEach((l) => l());
};
const titleOf = (e: VaultFile<unknown>) => String((e.asset as { title?: unknown }).title ?? e.id);

async function reload(type: VaultType) {
  try {
    const res = await fetch(`/api/vault?type=${type}`, { cache: 'no-store' });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? res.statusText);
    emit(type, { entries: (body as VaultFile<unknown>[]).sort((a, b) => titleOf(a).localeCompare(titleOf(b))), loaded: true, error: null });
  } catch (e) {
    emit(type, { error: (e as Error).message, loaded: true });
  }
}
export const reloadVault = () => reload('asset');

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!source) {
    source = new EventSource('/api/vault/watch');
    source.onmessage = (m) => {
      const file = String(JSON.parse(m.data).path ?? '');
      (Object.keys(FOLDER) as VaultType[]).forEach((t) => { if (file.startsWith(FOLDER[t])) reload(t); });
    };
    reload('asset'); reload('palette');
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { source?.close(); source = null; }
  };
}

const useCollection = <T,>(type: VaultType) =>
  useSyncExternalStore(subscribe, () => state[type], () => state[type]) as Collection<T>;
export const useVault = () => useCollection<VaultAsset>('asset');
export const usePalettes = () => useCollection<Palette>('palette');
export const useVaultAsset = (id: string | undefined) => useVault().entries.find((e) => e.id === id)?.asset;
// The vault as placements see it: a structure is its drawing built from its atoms (lib/design/structure.ts), so it's
// sized, footed, turned and drawn like any block. Built once per vault state; Fab's editors use the plain vault
const placed = new WeakMap<Collection<VaultAsset>, Collection<VaultAsset>>();
export function placedVault(c: Collection<VaultAsset>): Collection<VaultAsset> {
  let out = placed.get(c);
  if (!out) {
    const atomOf = (id: string) => c.entries.find((e) => e.id === id)?.asset;
    out = { ...c, entries: c.entries.map((e) => (isStructure(e.asset) ? { ...e, asset: builtStructure(e.asset, atomOf) } : e)) };
    placed.set(c, out);
  }
  return out;
}
export const usePlacedVault = () => placedVault(useVault());
export const placedNow = () => placedVault(state.asset as Collection<VaultAsset>);   // the same, outside React (scripts)

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Makes a new file. A name already taken gets a number, so nothing is overwritten.
async function create(type: VaultType, title: string, file: unknown): Promise<{ id: string } | { error: string }> {
  const base = slug(title);
  if (!base) return { error: `"${title}" can't be a file name` };
  const body = JSON.stringify(file);
  for (let n = 1; n < 100; n++) {
    const id = n === 1 ? base : `${base}-${n}`;
    const res = await fetch(`/api/vault?${type}=${id}&new=1`, { method: 'PUT', body }).catch(() => null);
    if (!res) return { error: 'Dev server unreachable' };
    if (res.ok) { await reload(type); return { id }; }
    if (res.status !== 409) return { error: (await res.json().catch(() => ({}))).error ?? res.statusText };
  }
  return { error: `Too many files named "${title}"` };
}
const today = () => new Date().toISOString().slice(0, 10);
export const createAsset   = (kind: AssetKind, title: string, part?: BlockPart) => create('asset', title, newAsset(kind, title, today(), part));
// A copy of an asset as its own new file ("Make unique"): "Pop bumper" → pop-bumper-2, "Pop bumper 2"
// A new vault file from another, named "Title N". With a kind, the copy is that kind and the original stays as it was
// (a kind sets how every placement draws, so it's never changed in place). Only a block keeps its footprint.
export function copyAsset(from: VaultAsset, kind: AssetKind = from.kind, part?: Part) {
  const root = from.title.replace(/\s+\d+$/, ''), taken = (t: string) => state.asset.entries.some((e) => e.id === slug(t) || (e.asset as VaultAsset | undefined)?.title === t);
  let n = 2;
  while (taken(`${root} ${n}`)) n++;
  const title = `${root} ${n}`;
  const copy = { ...structuredClone(from), kind, title, updated: today() } as VaultAsset;
  if (kind !== 'block') { delete copy.footprint; delete copy.part; delete copy.wall; }
  if (kind === 'block' && part) {   // another part: atoms stand on one tile; its state layers come along, kept drawings stay
    if (part === 'object') delete copy.part; else { copy.part = part; delete copy.footprint; const have = layersOf(copy); copy.layers = [...have, ...PART_LAYERS[part].filter((l) => !have.some((x) => x.id === l.id))]; }
    if (part === 'wall') copy.wall = from.wall ?? { h: WALL_H }; else delete copy.wall;
  }
  return create('asset', title, copy);
}
export const createPalette = (title: string, from?: Palette) =>
  create('palette', title, from ? { ...from, title, updated: today() } : newPalette(title, today()));

async function save(type: VaultType, id: string, file: unknown): Promise<SaveResult> {
  const entry = state[type].entries.find((e) => e.id === id);
  if (!entry) return { ok: false, conflict: false, error: `"${id}" is no longer in the vault` };   // never bring back a deleted file
  const res = await fetch(`/api/vault?${type}=${id}`, {
    method: 'PUT',
    headers: entry.mtime ? { 'x-base-mtime': entry.mtime } : {},
    body: JSON.stringify(file),
  }).catch(() => null);
  if (!res) return { ok: false, conflict: false, error: 'Dev server unreachable' };
  if (res.ok) {
    const mtime = res.headers.get('x-mtime');
    emit(type, { entries: state[type].entries.map((e) => (e.id === id ? { ...e, mtime, asset: file } : e)) });
    return { ok: true };
  }
  if (res.status === 409) reload(type);
  const err = await res.json().catch(() => ({}));
  return { ok: false, conflict: res.status === 409, error: err.error ?? res.statusText };
}
export const saveAsset   = (id: string, a: VaultAsset) => save('asset', id, a);
export const savePalette = (id: string, p: Palette) => save('palette', id, p);

export async function assetUses(id: string): Promise<string[]> {
  const res = await fetch(`/api/vault?uses=${id}`, { cache: 'no-store' }).catch(() => null);
  return res?.ok ? (await res.json()).usedIn : [];
}

async function remove(type: VaultType, id: string): Promise<boolean> {
  const res = await fetch(`/api/vault?${type}=${id}&force=1`, { method: 'DELETE' }).catch(() => null);
  if (res?.ok) await reload(type);
  return !!res?.ok;
}
export const deleteAsset   = (id: string) => remove('asset', id);
export const deletePalette = (id: string) => remove('palette', id);

// For scripts that draw pages on a server (page:render): fill the shared copy from disk instead of fetching it
export function primeVault(assets: VaultEntry[], palettes: VaultFile<Palette>[] = []) {
  state.asset = { entries: assets, loaded: true, error: null };
  state.palette = { entries: palettes, loaded: true, error: null };
}
