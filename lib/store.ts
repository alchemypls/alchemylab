import { create } from 'zustand';
import { persist, PersistStorage, StorageValue } from 'zustand/middleware';
import { ProjectMeta, PagePlacement, PageLayer, PageLayout, PageDef, ProjectData, PageSketch, PlacementGeom, SketchElement, PROJECT_ACCENTS, resolvePlacement, sketchToVector } from './project';
import { Tier, ViewportSize } from './devices';
import { Recipe, recipeByKey, copyTheme, GLOBAL_THEME } from './library';
import { SceneId, Dir, FabEditor } from './scenes';

// The workbench's state. Web projects live on disk (projects/<id>.json): lib/projectSync.ts loads them into
// `projects` and writes every change back, so `projects` is not persisted here. What is persisted is this
// browser's view: which canvas, page, editor and palette are open, and where the vault window sits.

const defaultProjectMeta: ProjectMeta = {
  id: "default",
  name: "Untitled Project",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  accent: PROJECT_ACCENTS[0],
};


const emptyProject = (meta: ProjectMeta): ProjectData => ({
  meta, pages: [], layouts: {}, wireframes: {},
  theme: copyTheme(GLOBAL_THEME, `theme-${meta.id}`, `${meta.name} theme`), components: {},
});

// First free id in a project's components: button, button-2, button-3…
function freeComponentId(p: ProjectData, base: string) {
  const taken = p.components ?? {};
  if (!taken[base]) return base;
  let n = 2;
  while (taken[`${base}-${n}`]) n++;
  return `${base}-${n}`;
}

// Immutable update of one project; no-op for unknown ids
function patchProject(state: { projects: Record<string, ProjectData> }, pid: string, fn: (p: ProjectData) => ProjectData) {
  const p = state.projects[pid];
  return p ? { projects: { ...state.projects, [pid]: fn(p) } } : {};
}

const withLayout = (p: ProjectData, path: string, layout: PageLayout): ProjectData =>
  ({ ...p, layouts: { ...p.layouts, [path]: layout } });

// Applies a placement array transformer to the active layer (or legacy flat list).
function patchLayout(
  layout: PageLayout,
  updater: (ps: PagePlacement[]) => PagePlacement[],
): PageLayout {
  if (layout.layers?.length) {
    const activeId = layout.activeLayerId ?? layout.layers[0]?.id;
    return {
      ...layout,
      layers: layout.layers.map((l) =>
        l.id === activeId ? { ...l, placements: updater(l.placements) } : l
      ),
    };
  }
  return { ...layout, placements: updater(layout.placements) };
}

// ── Debounced persistence ─────────────────────────────────────────
// persist would JSON.stringify the whole state (sketches with pen pressures included) into
// localStorage on EVERY set — pen samples, drags, keystrokes. Defer both the stringify and the
// write until changes settle; flush synchronously when the tab hides/closes so nothing is lost.
function debouncedLocalStorage<S>(delayMs = 400): PersistStorage<S> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { name: string; value: StorageValue<S> } | null = null;
  const flush = () => {
    if (timer) { clearTimeout(timer); timer = undefined; }
    if (!pending) return;
    try { localStorage.setItem(pending.name, JSON.stringify(pending.value)); } catch (e) { console.error('[store] persist failed', e); }
    pending = null;
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  }
  return {
    getItem: (name) => {
      const raw = localStorage.getItem(name);
      return raw ? (JSON.parse(raw) as StorageValue<S>) : null;
    },
    setItem: (name, value) => {
      pending = { name, value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    removeItem: (name) => { pending = null; localStorage.removeItem(name); },
  };
}

interface WorkbenchState {
  // Projects — one per website. Library (prime) is shared; pages/layouts/wireframes are per-project.
  projects: Record<string, ProjectData>;
  lastProjectId: string;                     // most recently used — new bound widgets default to it
  touchProject: (pid: string) => void;
  createProject: (name?: string) => string;  // returns new id
  deleteProject: (pid: string) => void;      // refuses to delete the last project
  updateProjectMeta: (pid: string, updates: Partial<ProjectMeta>) => void;

  addPage: (pid: string, page: PageDef) => void;
  removePage: (pid: string, path: string) => void;
  updatePage: (pid: string, path: string, patch: Partial<Omit<PageDef, 'path'>>) => void;
  setActivePage: (pid: string, path: string) => void;
  updateWireframe: (pid: string, path: string, tier: Tier, sketch: PageSketch) => void;

  // Layout canvas — page artboard placements + layers
  setProjectViewport: (pid: string, viewport: ViewportSize) => void;
  addPlacement: (pid: string, pagePath: string, placement: PagePlacement) => void;
  removePlacement: (pid: string, pagePath: string, placementId: string) => void;
  // Component library — a project owns COPIES of library recipes (copy, don't link)
  addComponentFromRecipe: (pid: string, recipeKey: string) => string | null;   // returns the new component id
  updateComponentRecipe: (pid: string, componentId: string, fn: (r: Recipe) => Recipe) => void;
  duplicateComponent: (pid: string, componentId: string) => string | null;
  removeProjectComponent: (pid: string, componentId: string) => void;
  setThemeToken: (pid: string, token: string, value: string) => void;
  resetProjectTheme: (pid: string) => void;
  // One placement's own option / prop choices
  setPlacementInstance: (pid: string, pagePath: string, placementId: string,
    patch: { options?: Record<string, string>; props?: PagePlacement['props']; name?: string; color?: string }) => void;
  // Writes geometry for one tier: mobile edits the base, tablet/desktop write their override
  setPlacementGeom: (pid: string, pagePath: string, placementId: string, tier: Tier, geom: Partial<PlacementGeom>) => void;
  resetPlacementTier: (pid: string, pagePath: string, placementId: string, tier: Exclude<Tier, 'mobile'>) => void;
  addLayer: (pid: string, pagePath: string, name: string) => void;
  removeLayer: (pid: string, pagePath: string, layerId: string) => void;
  setActiveLayer: (pid: string, pagePath: string, layerId: string) => void;

  activeScene: SceneId;
  slideDir: Dir | null;
  setActiveScene: (id: SceneId, dir?: Dir | null) => void;
  designView: { bible?: string; page: string };   // the design page open on the Ideation canvas
  setDesignView: (update: { bible?: string; page?: string }) => void;
  fabEditor: FabEditor;   // the editor open on the Fab canvas
  setFabEditor: (editor: FabEditor) => void;
  fabAsset?: string;      // the vault asset open in Visual Identity
  setFabAsset: (id: string | undefined) => void;
  swatchPalette?: string; // the vault palette every color picker shows
  setSwatchPalette: (id: string | undefined) => void;

  // The file vault window (vault/ on disk), on Ideation and Fab
  fileVaultOpen: boolean;
  toggleFileVault: () => void;
  vaultArmed: string | null;              // the vault asset Ideation places on the next click
  setVaultArmed: (id: string | null) => void;
  vaultPosition: { x: number; y: number };
  vaultSize:     { width: number; height: number };
  setVaultPosition: (position: { x: number; y: number }) => void;
  setVaultSize:     (size: { width: number; height: number }) => void;
}

export const useWorkbenchStore = create<WorkbenchState>()(
  persist(
    (set) => ({
      projects:      { [defaultProjectMeta.id]: emptyProject(defaultProjectMeta) },
      lastProjectId: defaultProjectMeta.id,

      touchProject: (pid) => set({ lastProjectId: pid }),

      createProject: (name) => {
        const id = `project-${Date.now()}`;
        set((state) => {
          const n = Object.keys(state.projects).length;
          const meta: ProjectMeta = {
            id, name: name || `Project ${n + 1}`, createdAt: Date.now(), updatedAt: Date.now(),
            accent: PROJECT_ACCENTS[n % PROJECT_ACCENTS.length],
          };
          return { projects: { ...state.projects, [id]: emptyProject(meta) }, lastProjectId: id };
        });
        return id;
      },

      deleteProject: (pid) =>
        set((state) => {
          const rest = Object.fromEntries(Object.entries(state.projects).filter(([id]) => id !== pid));
          if (Object.keys(rest).length === 0) return {};
          return {
            projects: rest,
            lastProjectId: state.lastProjectId === pid ? Object.keys(rest)[0] : state.lastProjectId,
          };
        }),

      updateProjectMeta: (pid, updates) =>
        set((state) => patchProject(state, pid, (p) => ({
          ...p, meta: { ...p.meta, ...updates, updatedAt: Date.now() },
        }))),

      addPage: (pid, page) =>
        set((state) => patchProject(state, pid, (p) =>
          p.pages.some((x) => x.path === page.path) ? p : { ...p, pages: [...p.pages, page] })),

      removePage: (pid, path) =>
        set((state) => patchProject(state, pid, (p) => ({
          ...p,
          pages: p.pages.filter((x) => x.path !== path),
          activePath: p.activePath === path ? p.pages.find((x) => x.path !== path)?.path : p.activePath,
        }))),

      updatePage: (pid, path, patch) =>
        set((state) => patchProject(state, pid, (p) => ({
          ...p, pages: p.pages.map((x) => (x.path === path ? { ...x, ...patch } : x)),
        }))),

      setActivePage: (pid, path) =>
        set((state) => ({ ...patchProject(state, pid, (p) => ({ ...p, activePath: path })), lastProjectId: pid })),

      updateWireframe: (pid, path, tier, sketch) =>
        set((state) => patchProject(state, pid, (p) => ({
          ...p, wireframes: { ...p.wireframes, [path]: { ...p.wireframes[path], [tier]: sketch } },
        }))),

      setProjectViewport: (pid, viewport) =>
        set((state) => patchProject(state, pid, (p) => ({ ...p, viewport }))),

      addPlacement: (pid, pagePath, placement) =>
        set((state) => patchProject(state, pid, (p) => withLayout(p, pagePath,
          patchLayout(p.layouts[pagePath] ?? { placements: [] }, (ps) => [...ps, placement])))),

      removePlacement: (pid, pagePath, placementId) =>
        set((state) => patchProject(state, pid, (p) => {
          const existing = p.layouts[pagePath];
          return existing ? withLayout(p, pagePath, patchLayout(existing, (ps) => ps.filter((x) => x.id !== placementId))) : p;
        })),

      addComponentFromRecipe: (pid, recipeKey) => {
        const src = recipeByKey(recipeKey);
        if (!src) return null;
        let id: string | null = null;
        set((state) => patchProject(state, pid, (p) => {
          id = freeComponentId(p, src.key);
          // key = id so each copy gets its own CSS class (button vs button-2)
          const recipe: Recipe = { ...structuredClone(src), key: id };
          return { ...p, components: { ...p.components, [id]: {
            id, projectId: pid, origin: { recipe: src.key, version: src.version }, recipe, tags: [src.category],
          } } };
        }));
        return id;
      },

      updateComponentRecipe: (pid, componentId, fn) =>
        set((state) => patchProject(state, pid, (p) => {
          const c = p.components?.[componentId];
          return c ? { ...p, components: { ...p.components, [componentId]: { ...c, recipe: fn(c.recipe) } } } : p;
        })),

      duplicateComponent: (pid, componentId) => {
        let id: string | null = null;
        set((state) => patchProject(state, pid, (p) => {
          const c = p.components?.[componentId];
          if (!c) return p;
          id = freeComponentId(p, `${c.origin.recipe}-copy`);
          const recipe: Recipe = { ...structuredClone(c.recipe), key: id, name: `${c.recipe.name} copy` };
          return { ...p, components: { ...p.components, [id]: { ...c, id, recipe, tags: [...c.tags] } } };
        }));
        return id;
      },

      removeProjectComponent: (pid, componentId) =>
        set((state) => patchProject(state, pid, (p) => {
          const rest = { ...p.components };
          delete rest[componentId];
          return { ...p, components: rest };
        })),

      setThemeToken: (pid, token, value) =>
        set((state) => patchProject(state, pid, (p) => {
          const theme = p.theme ?? copyTheme(GLOBAL_THEME, `theme-${p.meta.id}`, `${p.meta.name} theme`);
          return { ...p, theme: { ...theme, tokens: { ...theme.tokens, [token]: value } } };
        })),

      resetProjectTheme: (pid) =>
        set((state) => patchProject(state, pid, (p) => ({
          ...p, theme: copyTheme(GLOBAL_THEME, `theme-${p.meta.id}`, `${p.meta.name} theme`),
        }))),

      setPlacementInstance: (pid, pagePath, placementId, patch) =>
        set((state) => patchProject(state, pid, (p) => {
          const existing = p.layouts[pagePath];
          if (!existing) return p;
          return withLayout(p, pagePath, patchLayout(existing, (ps) => ps.map((x) => x.id === placementId ? {
            ...x,
            options: patch.options ? { ...x.options, ...patch.options } : x.options,
            props:   patch.props   ? { ...x.props,   ...patch.props }   : x.props,
            // '' clears the label / colour
            name:    patch.name  !== undefined ? (patch.name.trim()  || undefined) : x.name,
            color:   patch.color !== undefined ? (patch.color         || undefined) : x.color,
          } : x)));
        })),

      setPlacementGeom: (pid, pagePath, placementId, tier, geom) =>
        set((state) => patchProject(state, pid, (p) => {
          const existing = p.layouts[pagePath];
          if (!existing) return p;
          return withLayout(p, pagePath, patchLayout(existing, (ps) => ps.map((x) => {
            if (x.id !== placementId) return x;
            if (tier === 'mobile') return { ...x, ...geom };
            // Pin the tier's full resolved geometry so later base edits don't rescale it
            const pinned = { ...resolvePlacement(x, tier), ...x.at?.[tier], ...geom };
            return { ...x, at: { ...x.at, [tier]: pinned } };
          })));
        })),

      resetPlacementTier: (pid, pagePath, placementId, tier) =>
        set((state) => patchProject(state, pid, (p) => {
          const existing = p.layouts[pagePath];
          if (!existing) return p;
          return withLayout(p, pagePath, patchLayout(existing, (ps) => ps.map((x) => {
            if (x.id !== placementId || !x.at?.[tier]) return x;
            const at = { ...x.at };
            delete at[tier];
            return { ...x, at: Object.keys(at).length ? at : undefined };
          })));
        })),

      addLayer: (pid, pagePath, name) =>
        set((state) => patchProject(state, pid, (p) => {
          const existing = p.layouts[pagePath];
          if (!existing) return p;
          const newId = `layer-${Date.now()}`;
          const currentLayers: PageLayer[] = existing.layers?.length
            ? existing.layers
            : [{ id: 'base', name: 'Base', placements: existing.placements }];
          return withLayout(p, pagePath, {
            ...existing, layers: [...currentLayers, { id: newId, name, placements: [] }], activeLayerId: newId,
          });
        })),

      removeLayer: (pid, pagePath, layerId) =>
        set((state) => patchProject(state, pid, (p) => {
          const existing = p.layouts[pagePath];
          if (!existing?.layers || existing.layers.length <= 1) return p;
          const layers = existing.layers.filter((l) => l.id !== layerId);
          const activeLayerId = existing.activeLayerId === layerId ? layers[0]?.id : existing.activeLayerId;
          return withLayout(p, pagePath, { ...existing, layers, activeLayerId });
        })),

      setActiveLayer: (pid, pagePath, layerId) =>
        set((state) => patchProject(state, pid, (p) => {
          const existing = p.layouts[pagePath];
          return existing ? withLayout(p, pagePath, { ...existing, activeLayerId: layerId }) : p;
        })),


      activeScene: 'ideation',
      slideDir: null,
      setActiveScene: (id, dir = null) => set({ activeScene: id, slideDir: dir }),
      designView: { page: 'index' },
      setDesignView: (update) => set((state) => ({ designView: { ...state.designView, ...update } })),
      fabEditor: 'identity',
      setFabEditor: (fabEditor) => set({ fabEditor }),
      setFabAsset: (fabAsset) => set({ fabAsset }),
      setSwatchPalette: (swatchPalette) => set({ swatchPalette }),

      fileVaultOpen: false,
      toggleFileVault: () => set((s) => ({ fileVaultOpen: !s.fileVaultOpen })),
      vaultArmed: null,
      setVaultArmed: (vaultArmed) => set({ vaultArmed }),
      vaultPosition: { x: 96, y: 80 },
      vaultSize:     { width: 330, height: 520 },
      setVaultPosition: (position) => set({ vaultPosition: position }),
      setVaultSize:     (size) => set({ vaultSize: size }),
    }),
    {
      name: 'alchemy:workbench',
      storage: debouncedLocalStorage(),
      version: 12,
      migrate: (persisted, version) => {
        // v11 → v12: the React Flow canvases and the old component vault retire, and projects move to disk.
        // Keep a copy of what this browser held first (skipped when too big for localStorage).
        if (version < 12) {
          try {
            const copy = JSON.stringify(persisted);
            if (copy.length < 2_000_000) localStorage.setItem(`alchemy:workbench:backup-v${version}`, copy);
            else console.warn('[store] state too large for a pre-migration backup');
          } catch (e) { console.warn('[store] pre-migration backup failed', e); }
        }
        const state = persisted as Record<string, unknown> & { projects?: Record<string, ProjectData> };
        // v10 → v11: wireframes became vector pages
        if (version < 11)
          for (const p of Object.values(state.projects ?? {}))
            for (const byTier of Object.values(p.wireframes ?? {}))
              for (const sk of Object.values(byTier ?? {})) if (sk) sk.elements = sketchToVector(sk.elements as unknown as SketchElement[]);
        // Projects stay in memory this once: projectSync writes any the disk doesn't have yet (see `fromBrowser`)
        const keep = ['projects', 'lastProjectId', 'activeScene', 'designView', 'fabEditor', 'fabAsset', 'swatchPalette', 'vaultPosition', 'vaultSize'];
        const next = Object.fromEntries(Object.entries(state).filter(([k]) => keep.includes(k)));
        if (next.projects) (next as { fromBrowser?: string[] }).fromBrowser = Object.keys(next.projects as object);
        return next as unknown as WorkbenchState;
      },
      partialize: (state) => ({
        lastProjectId:  state.lastProjectId,
        activeScene:    state.activeScene,
        designView:     state.designView,
        fabEditor:      state.fabEditor,
        fabAsset:       state.fabAsset,
        swatchPalette:  state.swatchPalette,
        vaultPosition:  state.vaultPosition,
        vaultSize:      state.vaultSize,
      }),
    }
  )
);
