import { Adventure } from '../adventure/model';
import type { AdventureSnapshot } from '../adventure/model';
import { adventureById } from '../content/adventures';
import { Game } from '../engine/game';
import type { Action, SerializedRun, Snapshot, StepResult } from '../engine/types';
import type { SerializedPlaySession } from '../persist/save';

export type ActivePlaySession =
  | { kind: 'single'; game: Game }
  | { kind: 'adventure'; adventure: Adventure };

export function stepPlaySession(session: ActivePlaySession, action: Action): StepResult {
  return session.kind === 'single' ? session.game.step(action) : session.adventure.step(action);
}

export function currentRunSnapshot(session: ActivePlaySession): Snapshot {
  return session.kind === 'single'
    ? session.game.snapshot()
    : session.adventure.snapshot().currentRun;
}

export function currentSerializedRun(session: ActivePlaySession): SerializedRun {
  return session.kind === 'single'
    ? session.game.serializeRun()
    : session.adventure.serialize().currentRun;
}

export function currentAdventureSnapshot(
  session: ActivePlaySession
): AdventureSnapshot | null {
  return session.kind === 'adventure' ? session.adventure.snapshot() : null;
}

export function serializePlaySession(session: ActivePlaySession): SerializedPlaySession {
  return session.kind === 'single'
    ? { version: 1, kind: 'single', run: session.game.serializeRun() }
    : { version: 1, kind: 'adventure', adventure: session.adventure.serialize() };
}

export function restorePlaySession(serialized: SerializedPlaySession): ActivePlaySession {
  if (serialized.kind === 'single') {
    return { kind: 'single', game: Game.fromSerializedRun(serialized.run) };
  }

  const definition = adventureById(serialized.adventure.definitionId);

  if (!definition) {
    throw new Error('Saved adventure is not available in this build.');
  }

  return {
    kind: 'adventure',
    adventure: Adventure.fromSerialized(serialized.adventure, definition)
  };
}
