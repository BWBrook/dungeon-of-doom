import {
  DEFAULT_LIGHT_USES,
  LEGACY_AS,
  LEGACY_CODES,
  LEGACY_OS,
  LEVEL_PAYLOAD_LENGTH,
  clonePoint,
  computeSpellChargesFromInventory,
  createEmptyInventorySlots,
  createHeroStatus,
  deriveClassId,
  isLegacyMonsterCode,
  legacyCodeToTileKind,
  monsterHpFromLegacyCode,
  monsterStepSizeFromLegacyCode,
  tileKindToLegacyCode
} from '../engine/catalog';
import { createHeroFromLegacyLoad } from '../engine/game';
import type { ClassId, HeroState, LevelDefinition, LevelCell, MonsterSpawn } from '../engine/types';

function clampLegacyByte(value: number): number {
  return Math.max(0, Math.min(255, Math.floor(value)));
}

function toLegacyCoordinate(value: number): number {
  return clampLegacyByte(value + 1 + LEGACY_OS);
}

function fromLegacyCoordinate(value: number): number {
  return value - LEGACY_OS - 1;
}

function stripRecordBreaks(input: string): string {
  return input.replace(/[\r\n]+/g, '');
}

function parseClassId(displayLabel: string): ClassId | null {
  const suffix = displayLabel.split(' -').at(-1)?.trim().toLowerCase();

  switch (suffix) {
    case 'wanderer':
    case 'cleric':
    case 'mage':
    case 'warrior':
    case 'barbarian':
      return suffix;
    default:
      return null;
  }
}

export function parseHeroString(input: string): HeroState {
  const source = stripRecordBreaks(input);

  if (source.length < 35) {
    throw new Error('Legacy hero payload is too short.');
  }

  const objectCount = source.charCodeAt(0) - LEGACY_AS;

  if (objectCount !== 24) {
    throw new Error('Legacy hero payload has an unsupported inventory slot count.');
  }

  if (source.length < 1 + 8 + objectCount + 2) {
    throw new Error('Legacy hero payload is truncated.');
  }

  const stats = {
    strength: source.charCodeAt(1) - LEGACY_AS,
    vitality: source.charCodeAt(2) - LEGACY_AS,
    agility: source.charCodeAt(3) - LEGACY_AS,
    intelligence: source.charCodeAt(4) - LEGACY_AS,
    experience: source.charCodeAt(5) - LEGACY_AS,
    luck: source.charCodeAt(6) - LEGACY_AS,
    aura: source.charCodeAt(7) - LEGACY_AS,
    morality: source.charCodeAt(8) - LEGACY_AS
  };
  const inventorySlots = createEmptyInventorySlots();
  let pointer = 9;

  for (let slot = 1; slot <= objectCount; slot += 1) {
    inventorySlots[slot] = source.charCodeAt(pointer) - LEGACY_AS;
    pointer += 1;
  }

  const gold = source.charCodeAt(pointer) - LEGACY_AS;
  const treasure = source.charCodeAt(pointer + 1) - LEGACY_AS;
  const displayLabel = source.slice(pointer + 2);
  const name = displayLabel.split(' -')[0] ?? 'Hero';
  const classId = parseClassId(displayLabel) ?? deriveClassId(stats);

  const hero: HeroState = {
    name,
    displayLabel,
    classId,
    stats,
    baseStats: structuredClone(stats),
    gold,
    treasure,
    facing: 'N',
    position: { x: 0, y: 0 },
    inventorySlots,
    spellCharges: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0
    },
    lightUses: (inventorySlots[16] ?? 0) > 0 ? DEFAULT_LIGHT_USES : 0,
    status: createHeroStatus()
  };

  hero.spellCharges = computeSpellChargesFromInventory(hero);

  return createHeroFromLegacyLoad(hero);
}

export function formatHeroString(hero: HeroState): string {
  const codes: number[] = [];

  codes.push(clampLegacyByte(24 + LEGACY_AS));
  codes.push(clampLegacyByte(hero.stats.strength + LEGACY_AS));
  codes.push(clampLegacyByte(hero.stats.vitality + LEGACY_AS));
  codes.push(clampLegacyByte(hero.stats.agility + LEGACY_AS));
  codes.push(clampLegacyByte(hero.stats.intelligence + LEGACY_AS));
  codes.push(clampLegacyByte(hero.stats.experience + LEGACY_AS));
  codes.push(clampLegacyByte(hero.stats.luck + LEGACY_AS));
  codes.push(clampLegacyByte(hero.stats.aura + LEGACY_AS));
  codes.push(clampLegacyByte(hero.stats.morality + LEGACY_AS));

  for (let slot = 1; slot <= 24; slot += 1) {
    codes.push(clampLegacyByte((hero.inventorySlots[slot] ?? 0) + LEGACY_AS));
  }

  codes.push(clampLegacyByte(hero.gold + LEGACY_AS));
  codes.push(clampLegacyByte(hero.treasure + LEGACY_AS));

  return `${String.fromCharCode(...codes)}${hero.displayLabel}`;
}

export function parseLevelString(input: string): LevelDefinition {
  const source = stripRecordBreaks(input);

  if (source.length < LEVEL_PAYLOAD_LENGTH) {
    throw new Error('Legacy level payload is too short.');
  }

  const cells: LevelCell[] = [];
  const monsterSpawns: MonsterSpawn[] = [];
  let authoredEntrancePosition = { x: 0, y: 0 };

  for (let index = 0; index < 225; index += 1) {
    const legacyCode = source.charCodeAt(index);
    const x = index % 15;
    const y = Math.floor(index / 15);

    if (isLegacyMonsterCode(legacyCode)) {
      monsterSpawns.push({
        id: `monster-legacy-${monsterSpawns.length + 1}`,
        position: { x, y },
        legacyTileCode: legacyCode
      });
      cells.push({
        kind: 'floor',
        legacyCode: LEGACY_CODES.floor
      });
      continue;
    }

    const kind = legacyCodeToTileKind(legacyCode);

    if (kind === 'entrance') {
      authoredEntrancePosition = { x, y };
    }

    cells.push({
      kind,
      legacyCode
    });
  }

  const startPosition = {
    x: fromLegacyCoordinate(source.charCodeAt(225)),
    y: fromLegacyCoordinate(source.charCodeAt(226))
  };
  const levelId = source.charCodeAt(227) - LEGACY_OS;

  if (
    startPosition.x < 0 ||
    startPosition.y < 0 ||
    startPosition.x >= 15 ||
    startPosition.y >= 15
  ) {
    throw new Error('Legacy level start coordinates are out of bounds.');
  }

  return {
    id: levelId,
    width: 15,
    height: 15,
    cells,
    startPosition,
    authoredEntrancePosition,
    monsterSpawns
  };
}

export function formatLevelString(level: LevelDefinition): string {
  const rows: number[] = [];
  const monstersByPoint = new Map<string, MonsterSpawn>();

  for (const spawn of level.monsterSpawns) {
    monstersByPoint.set(`${spawn.position.x},${spawn.position.y}`, spawn);
  }

  for (let index = 0; index < level.cells.length; index += 1) {
    const x = index % level.width;
    const y = Math.floor(index / level.width);
    const monster = monstersByPoint.get(`${x},${y}`);

    if (monster) {
      rows.push(monster.legacyTileCode);
      continue;
    }

    rows.push(tileKindToLegacyCode(level.cells[index]!.kind));
  }

  rows.push(toLegacyCoordinate(level.startPosition.x));
  rows.push(toLegacyCoordinate(level.startPosition.y));
  rows.push(clampLegacyByte(level.id + LEGACY_OS));

  return String.fromCharCode(...rows);
}

export function createLegacyRuntimeMonsters(level: LevelDefinition) {
  return level.monsterSpawns.map((spawn) => ({
    id: spawn.id,
    legacyTileCode: spawn.legacyTileCode,
    position: clonePoint(spawn.position),
    hp: monsterHpFromLegacyCode(spawn.legacyTileCode),
    stepSize: monsterStepSizeFromLegacyCode(spawn.legacyTileCode),
    state: 'dormant' as const
  }));
}
