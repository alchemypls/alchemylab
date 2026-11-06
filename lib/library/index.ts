// The component library — global recipes every project copies from (see recipe.ts → ProjectComponent).
// Recipes ship in sets (sets.ts); LIBRARY is every recipe across all sets.
import type { Recipe } from './recipe';
import { SETS } from './sets';

export const LIBRARY: Recipe[] = SETS.flatMap((s) => s.recipes);
export const recipeByKey = (key: string) => LIBRARY.find((r) => r.key === key);

export { SETS } from './sets';
export type { LibrarySet } from './sets';
export * from './recipe';
export * from './css';
export * from './markup';
export * from './edit';
export * from './theme';
export { BEHAVIORS, behaviorsUsed, behaviorScript } from './behaviors';
