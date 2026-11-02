import { validateAdventureDefinition } from '../adventure/model';
import type { AdventureDefinition } from '../adventure/model';
import { GRID_SIZE, isLegacyMonsterCode, tileKindToLegacyCode } from '../engine/catalog';
import type { BaseTileKind, LevelDefinition, MonsterSpawn, Point } from '../engine/types';

export interface LibraryLevel {
  id: string;
  name: string;
  level: LevelDefinition;
  savedAt: string;
}

export interface QuestDocument {
  kind: 'dungeon-of-doom.quest';
  version: 1;
  quest: AdventureDefinition;
}

const LEVEL_LIBRARY_KEY = 'dungeon-of-doom:level-library';
const QUEST_LIBRARY_KEY = 'dungeon-of-doom:quest-library';
const TILE_KINDS: BaseTileKind[] = [
  'floor',
  'wall',
  'vase',
  'chest',
  'idol',
  'entrance',
  'exit',
  'trap',
  'safe',
  'relic'
];

export function loadLevelLibrary(): LibraryLevel[] {
  return readList(LEVEL_LIBRARY_KEY, parseLibraryLevel);
}

export function saveLevelToLibrary(entry: LibraryLevel): LibraryLevel[] {
  const next = [...loadLevelLibrary().filter((item) => item.id !== entry.id), structuredClone(entry)];

  writeList(LEVEL_LIBRARY_KEY, next);

  return next;
}

export function removeLevelFromLibrary(id: string): LibraryLevel[] {
  const next = loadLevelLibrary().filter((item) => item.id !== id);

  writeList(LEVEL_LIBRARY_KEY, next);

  return next;
}

export function loadQuestLibrary(): AdventureDefinition[] {
  return readList(QUEST_LIBRARY_KEY, parseAdventureDefinition);
}

export function saveQuestToLibrary(quest: AdventureDefinition): AdventureDefinition[] {
  const next = [...loadQuestLibrary().filter((item) => item.id !== quest.id), structuredClone(quest)];

  writeList(QUEST_LIBRARY_KEY, next);

  return next;
}

export function removeQuestFromLibrary(id: string): AdventureDefinition[] {
  const next = loadQuestLibrary().filter((item) => item.id !== id);

  writeList(QUEST_LIBRARY_KEY, next);

  return next;
}

export function findLibraryQuest(id: string): AdventureDefinition | null {
  return loadQuestLibrary().find((quest) => quest.id === id) ?? null;
}

export function newLibraryId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function formatQuestDocument(quest: AdventureDefinition): string {
  const document: QuestDocument = {
    kind: 'dungeon-of-doom.quest',
    version: 1,
    quest
  };

  return JSON.stringify(document, null, 2);
}

export function parseQuestDocument(input: string): AdventureDefinition {
  let value: unknown;

  try {
    value = JSON.parse(input);
  } catch {
    throw new Error('Quest JSON could not be parsed.');
  }

  if (!isRecord(value) || value.kind !== 'dungeon-of-doom.quest' || value.version !== 1) {
    throw new Error('Quest JSON must be a dungeon-of-doom.quest document, version 1.');
  }

  const quest = parseAdventureDefinition(value.quest);
  const errors = validateAdventureDefinition(quest);

  if (errors.length > 0) {
    throw new Error(`Quest JSON is not playable: ${errors.join(' ')}`);
  }

  return quest;
}

export function parseAdventureDefinition(value: unknown): AdventureDefinition {
  if (!isRecord(value)) {
    throw new Error('Quest must be an object.');
  }

  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new Error('Quest id must be a non-empty string.');
  }

  if (typeof value.title !== 'string') {
    throw new Error('Quest title must be a string.');
  }

  if (!Array.isArray(value.stages)) {
    throw new Error('Quest stages must be an array.');
  }

  return {
    id: value.id,
    title: value.title,
    description: typeof value.description === 'string' ? value.description : '',
    stages: value.stages.map((stage, index) => {
      if (!isRecord(stage) || typeof stage.id !== 'string' || typeof stage.title !== 'string') {
        throw new Error(`Quest stage ${index + 1} needs an id and a title.`);
      }

      return {
        id: stage.id,
        title: stage.title,
        level: parseLevelDefinition(stage.level, `stage ${index + 1}`),
        ...(typeof stage.verse === 'string' && stage.verse.length > 0 ? { verse: stage.verse } : {})
      };
    })
  };
}

export function parseLevelDefinition(value: unknown, label = 'level'): LevelDefinition {
  if (!isRecord(value)) {
    throw new Error(`The ${label} must be an object.`);
  }

  if (
    !Number.isInteger(value.id) ||
    value.width !== GRID_SIZE ||
    value.height !== GRID_SIZE ||
    !Array.isArray(value.cells) ||
    value.cells.length !== GRID_SIZE * GRID_SIZE
  ) {
    throw new Error(`The ${label} must be a ${GRID_SIZE}x${GRID_SIZE} grid with an integer id.`);
  }

  const cells = value.cells.map((cell, index) => {
    const kind = isRecord(cell) ? cell.kind : undefined;

    if (typeof kind !== 'string' || !TILE_KINDS.includes(kind as BaseTileKind)) {
      throw new Error(`The ${label} has an unknown tile at cell ${index}.`);
    }

    return { kind: kind as BaseTileKind, legacyCode: tileKindToLegacyCode(kind as BaseTileKind) };
  });
  const monsterSpawns: MonsterSpawn[] = Array.isArray(value.monsterSpawns)
    ? value.monsterSpawns.map((spawn, index) => {
        if (
          !isRecord(spawn) ||
          typeof spawn.id !== 'string' ||
          !Number.isInteger(spawn.legacyTileCode) ||
          !isLegacyMonsterCode(spawn.legacyTileCode as number)
        ) {
          throw new Error(`The ${label} has an invalid monster at index ${index}.`);
        }

        return {
          id: spawn.id,
          position: parsePoint(spawn.position, `${label} monster ${index}`),
          legacyTileCode: spawn.legacyTileCode as number
        };
      })
    : [];

  return {
    id: value.id as number,
    width: GRID_SIZE,
    height: GRID_SIZE,
    cells,
    startPosition: parsePoint(value.startPosition, `${label} start`),
    authoredEntrancePosition: parsePoint(value.authoredEntrancePosition, `${label} entrance`),
    monsterSpawns
  };
}

function parseLibraryLevel(value: unknown): LibraryLevel {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
    throw new Error('Library level needs an id and a name.');
  }

  return {
    id: value.id,
    name: value.name,
    level: parseLevelDefinition(value.level),
    savedAt: typeof value.savedAt === 'string' ? value.savedAt : ''
  };
}

function parsePoint(value: unknown, label: string): Point {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.x) ||
    !Number.isInteger(value.y) ||
    (value.x as number) < 0 ||
    (value.y as number) < 0 ||
    (value.x as number) >= GRID_SIZE ||
    (value.y as number) >= GRID_SIZE
  ) {
    throw new Error(`The ${label} position must be inside the grid.`);
  }

  return { x: value.x as number, y: value.y as number };
}

function readList<T>(key: string, parse: (value: unknown) => T): T[] {
  const raw = localStorage.getItem(key);

  if (!raw) {
    return [];
  }

  try {
    const value: unknown = JSON.parse(raw);

    if (!Array.isArray(value)) {
      return [];
    }

    const items: T[] = [];

    for (const entry of value) {
      try {
        items.push(parse(entry));
      } catch {
        continue;
      }
    }

    return items;
  } catch {
    return [];
  }
}

function writeList(key: string, items: unknown[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
