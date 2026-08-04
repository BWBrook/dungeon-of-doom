import type { SerializedRun } from '../engine/types';

const SAVE_KEY = 'dungeon-of-doom:run';

export function saveRun(run: SerializedRun): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(run));
}

export function loadRun(): SerializedRun | null {
  const raw = localStorage.getItem(SAVE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SerializedRun;
  } catch {
    localStorage.removeItem(SAVE_KEY);
    return null;
  }
}
