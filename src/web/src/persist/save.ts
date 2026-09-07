import type { SerializedAdventure } from '../adventure/model';
import type { SerializedRun } from '../engine/types';

export type SerializedPlaySession =
  | { version: 1; kind: 'single'; run: SerializedRun }
  | { version: 1; kind: 'adventure'; adventure: SerializedAdventure };

const SAVE_KEY = 'dungeon-of-doom:play-session';

export function savePlaySession(session: SerializedPlaySession): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(session));
}

export function loadPlaySession(): SerializedPlaySession | null {
  const raw = localStorage.getItem(SAVE_KEY);

  if (!raw) {
    return null;
  }

  const session = parsePlaySession(raw);

  if (!session) {
    localStorage.removeItem(SAVE_KEY);
  }

  return session;
}

export function parsePlaySession(input: string): SerializedPlaySession | null {
  try {
    const value = JSON.parse(input) as Record<string, unknown>;

    if (value.version !== 1) {
      return null;
    }

    if (value.kind === 'single') {
      const run = value.run as Partial<SerializedRun> | undefined;

      return run?.version === 2 ? (value as SerializedPlaySession) : null;
    }

    if (value.kind === 'adventure') {
      const adventure = value.adventure as Partial<SerializedAdventure> | undefined;

      return adventure?.version === 1 && adventure.currentRun?.version === 2
        ? (value as SerializedPlaySession)
        : null;
    }

    return null;
  } catch {
    return null;
  }
}
