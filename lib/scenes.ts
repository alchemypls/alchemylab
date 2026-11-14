// One canvas, one job. Tools are toolboxes on that canvas, not more canvases.
export type SceneId = 'ideation' | 'fab' | 'web' | 'rnd';

// The Fab canvas's editors
export type FabEditor = 'identity' | 'components' | 'blocks' | 'structures';

export interface SceneConfig {
  id:          SceneId;
  label:       string;
  description: string;
}

// Spatial grid — [row][col] — drives both navigation and CSS layout
export const SCENE_GRID: SceneId[][] = [
  ['ideation', 'fab'],
  ['rnd',      'web'],   // Web under Fab (components flow down into pages); Live (rnd) beside it: Alt+A / Alt+D
];

export const SCENES: SceneConfig[] = [
  { id: 'ideation', label: 'Ideation', description: 'Design docs: the vector page is the canvas' },
  { id: 'fab',      label: 'Fab',      description: 'Create assets for the other canvases' },
  { id: 'rnd',      label: 'Live',     description: 'The web project running for real: devices, console, checks, phone' },
  { id: 'web',      label: 'Web',      description: 'Test page and app layouts, quick prototypes' },
];

// Flat ordered list of all scene IDs (matches SCENE_GRID reading order)
export const SCENE_IDS: SceneId[] = SCENE_GRID.flat();

// Row/col position of each scene in the grid
export const SCENE_POSITIONS: Record<SceneId, { row: number; col: number }> =
  Object.fromEntries(
    SCENE_GRID.flatMap((row, r) => row.map((id, c) => [id, { row: r, col: c }]))
  ) as Record<SceneId, { row: number; col: number }>;

export type Dir = 'up' | 'down' | 'left' | 'right';

export function getAdjacentScene(current: SceneId, dir: Dir): SceneId | null {
  const { row, col } = SCENE_POSITIONS[current];
  const nr = dir === 'up' ? row - 1 : dir === 'down' ? row + 1 : row;
  const nc = dir === 'left' ? col - 1 : dir === 'right' ? col + 1 : col;
  if (nr < 0 || nr >= SCENE_GRID.length) return null;
  if (nc < 0 || nc >= (SCENE_GRID[nr]?.length ?? 0)) return null;
  return SCENE_GRID[nr][nc];
}

// CSS transform that brings the active scene into the 100vw×100vh viewport
export function getSceneTransform(active: SceneId): string {
  const { row, col } = SCENE_POSITIONS[active];
  return `translate(${-col * 100}vw, ${-row * 100}vh)`;
}

// Direction of travel when switching scenes — used to set slide direction hint
export function getSlideDir(from: SceneId, to: SceneId): Dir {
  const f = SCENE_POSITIONS[from];
  const t = SCENE_POSITIONS[to];
  if (t.col > f.col) return 'right';
  if (t.col < f.col) return 'left';
  if (t.row > f.row) return 'down';
  return 'up';
}
