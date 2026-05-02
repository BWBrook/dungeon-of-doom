import type { LevelDefinition } from '../engine/types';

export interface ModernLevelDocument {
  kind: 'dungeon-of-doom.level';
  version: 1;
  level: LevelDefinition;
}

export function formatLevelDocument(level: LevelDefinition): string {
  const document: ModernLevelDocument = {
    kind: 'dungeon-of-doom.level',
    version: 1,
    level
  };

  return JSON.stringify(document, null, 2);
}

export function parseLevelDocument(input: string): ModernLevelDocument {
  const parsed = JSON.parse(input) as unknown;

  if (!isObject(parsed)) {
    throw new Error('Modern level document must be an object.');
  }

  if (parsed.kind !== 'dungeon-of-doom.level') {
    throw new Error('Modern level document has an unsupported kind.');
  }

  if (parsed.version !== 1) {
    throw new Error('Modern level document has an unsupported version.');
  }

  if (!isLevelDefinition(parsed.level)) {
    throw new Error('Modern level document has an invalid level payload.');
  }

  return {
    kind: parsed.kind,
    version: parsed.version,
    level: parsed.level
  };
}

function isLevelDefinition(value: unknown): value is LevelDefinition {
  if (!isObject(value)) {
    return false;
  }

  return (
    Number.isInteger(value.id) &&
    value.width === 15 &&
    value.height === 15 &&
    Array.isArray(value.cells) &&
    value.cells.length === 225 &&
    isPoint(value.startPosition) &&
    isPoint(value.authoredEntrancePosition) &&
    Array.isArray(value.monsterSpawns)
  );
}

function isPoint(value: unknown): value is { x: number; y: number } {
  return isObject(value) && Number.isInteger(value.x) && Number.isInteger(value.y);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
