import { GRID_SIZE, LEGACY_CODES, tileKindToLegacyCode } from './catalog';
import type { BaseTileKind, LevelDefinition, MonsterSpawn, Point } from './types';

export interface LevelRowsDefinition {
  id: number;
  rows: string[];
  startPosition?: Point;
}

export function defineLevelFromRows(definition: LevelRowsDefinition): LevelDefinition {
  if (
    definition.rows.length !== GRID_SIZE ||
    definition.rows.some((row) => row.length !== GRID_SIZE)
  ) {
    throw new Error(`Level ${definition.id} must contain ${GRID_SIZE} rows of ${GRID_SIZE} cells.`);
  }

  const cells = [];
  const monsterSpawns: MonsterSpawn[] = [];
  let authoredEntrancePosition: Point | null = null;

  for (let y = 0; y < GRID_SIZE; y += 1) {
    const row = definition.rows[y]!;

    for (let x = 0; x < GRID_SIZE; x += 1) {
      const point = { x, y };
      const parsed = cellFromGlyph(row[x]!);

      if (parsed.kind === 'entrance') {
        authoredEntrancePosition = point;
      }

      if (parsed.monsterLegacyCode !== null) {
        monsterSpawns.push({
          id: `monster-${definition.id}-${monsterSpawns.length + 1}`,
          position: point,
          legacyTileCode: parsed.monsterLegacyCode
        });
      }

      cells.push({
        kind: parsed.kind,
        legacyCode: tileKindToLegacyCode(parsed.kind)
      });
    }
  }

  const startPosition = definition.startPosition ?? authoredEntrancePosition;

  if (!startPosition || !authoredEntrancePosition) {
    throw new Error(`Level ${definition.id} must define an entrance and start position.`);
  }

  return {
    id: definition.id,
    width: GRID_SIZE,
    height: GRID_SIZE,
    cells,
    startPosition: { ...startPosition },
    authoredEntrancePosition: { ...authoredEntrancePosition },
    monsterSpawns
  };
}

function cellFromGlyph(glyph: string): {
  kind: BaseTileKind;
  monsterLegacyCode: number | null;
} {
  switch (glyph) {
    case '#':
      return { kind: 'wall', monsterLegacyCode: null };
    case 'V':
      return { kind: 'vase', monsterLegacyCode: null };
    case 'C':
      return { kind: 'chest', monsterLegacyCode: null };
    case 'I':
      return { kind: 'idol', monsterLegacyCode: null };
    case 'E':
      return { kind: 'entrance', monsterLegacyCode: null };
    case 'X':
      return { kind: 'exit', monsterLegacyCode: null };
    case 'T':
      return { kind: 'trap', monsterLegacyCode: null };
    case 'S':
      return { kind: 'safe', monsterLegacyCode: null };
    case '1':
      return { kind: 'floor', monsterLegacyCode: LEGACY_CODES.monster1 };
    case '2':
      return { kind: 'floor', monsterLegacyCode: LEGACY_CODES.monster2 };
    case '3':
      return { kind: 'floor', monsterLegacyCode: LEGACY_CODES.monster3 };
    default:
      return { kind: 'floor', monsterLegacyCode: null };
  }
}
