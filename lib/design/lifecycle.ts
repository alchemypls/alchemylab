// Every tool, action and effect has a stage. The workspace keeps growing: new things start in the lab, earn their
// place, and step aside when something better comes along. Retired is a resting place, not a countdown: a retired
// tool leaves the menus, but every file that uses it keeps drawing and validating (design:check notes where).
// Nothing is deleted automatically; removing one for good is the user's call.

export type Stage = 'lab' | 'stable' | 'retired';

export const offered = (s: { stage: Stage }) => s.stage !== 'retired';   // in menus and pickers
export const STAGE_NOTE: Record<Stage, string> = {
  lab: 'In the lab: new, still being tried out',
  stable: '',
  retired: 'Retired: still draws, no longer offered',
};
