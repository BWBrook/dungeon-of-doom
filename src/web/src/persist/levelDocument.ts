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
