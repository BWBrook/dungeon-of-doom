import {
  CLASS_LABELS,
  DEFAULT_LIGHT_USES,
  LEGACY_CODES,
  computeSpellChargesFromInventory,
  createEmptyInventorySlots,
  createHeroStatus,
  deriveClassId,
  legacyCodeToTileKind
} from '../catalog';
import { defineLevelFromRows } from '../levelBuilder';
import type { ClassId, HeroState, LevelDefinition, Stats } from '../types';

function createStats(values: Partial<Stats>): Stats {
  return {
    strength: values.strength ?? 5,
    vitality: values.vitality ?? 5,
    agility: values.agility ?? 5,
    intelligence: values.intelligence ?? 5,
    experience: values.experience ?? 1,
    luck: values.luck ?? 5,
    aura: values.aura ?? 1,
    morality: values.morality ?? 5
  };
}

function createHero(
  name: string,
  classId: ClassId,
  stats: Stats,
  inventoryPatch: Record<number, number>
): HeroState {
  const inventorySlots = createEmptyInventorySlots();

  for (const [slotKey, value] of Object.entries(inventoryPatch)) {
    inventorySlots[Number(slotKey)] = value;
  }

  const hero: HeroState = {
    name,
    displayLabel: `${name} -${CLASS_LABELS[classId]}`,
    classId,
    stats: structuredClone(stats),
    baseStats: structuredClone(stats),
    gold: 42,
    treasure: 0,
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

  return hero;
}

const warriorStats = createStats({
  strength: 10,
  vitality: 9,
  agility: 7,
  intelligence: 4,
  experience: 1,
  luck: 6,
  aura: 1,
  morality: 6
});

const clericStats = createStats({
  strength: 7,
  vitality: 7,
  agility: 6,
  intelligence: 8,
  experience: 1,
  luck: 6,
  aura: 4,
  morality: 8
});

export const warriorStarter = createHero('Rogan', deriveClassId(warriorStats), warriorStats, {
  1: 5,
  9: 5,
  10: 4,
  13: 2,
  16: 1,
  23: 2,
  24: 2
});

export const clericStarter = createHero('Selene', deriveClassId(clericStats), clericStats, {
  7: 1,
  10: 4,
  16: 1,
  17: 4,
  18: 3,
  23: 2,
  24: 1
});

export const wallBumpLevel = defineLevelFromRows({
  id: 1,
  rows: [
    '###############',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#......#......#',
    '#......E......#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#............X#',
    '###############'
  ],
  startPosition: { x: 7, y: 7 }
});

export const trapEscapeLevel = defineLevelFromRows({
  id: 2,
  rows: [
    '###############',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#......T......#',
    '#......E......#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#............X#',
    '###############'
  ],
  startPosition: { x: 7, y: 7 }
});

export const revealGuardLevel = defineLevelFromRows({
  id: 3,
  rows: [
    '###############',
    '#.............#',
    '#.............#',
    '#....1....2...#',
    '#.............#',
    '#.............#',
    '#.....V.......#',
    '#.....E....C..#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#............X#',
    '###############'
  ],
  startPosition: { x: 6, y: 7 }
});

export const idolFinishLevel = defineLevelFromRows({
  id: 4,
  rows: [
    '###############',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#......I......#',
    '#......E......#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#............X#',
    '###############'
  ],
  startPosition: { x: 7, y: 7 }
});

export const mixedDemoLevel = defineLevelFromRows({
  id: 5,
  rows: [
    '###############',
    '#.............#',
    '#..V......1...#',
    '#.............#',
    '#......#......#',
    '#.............#',
    '#..C...V1.....#',
    '#......E......#',
    '#.............#',
    '#.............#',
    '#.........2...#',
    '#.............#',
    '#......I......#',
    '#............X#',
    '###############'
  ],
  startPosition: { x: 7, y: 7 }
});

export const levelFixtures = {
  wall_bump_level: wallBumpLevel,
  trap_escape_level: trapEscapeLevel,
  reveal_guard_level: revealGuardLevel,
  idol_finish_level: idolFinishLevel,
  mixed_demo_level: mixedDemoLevel
};

export const heroFixtures = {
  warrior_starter: warriorStarter,
  cleric_starter: clericStarter
};

export function createLegacyFriendlyLevelFixture(): LevelDefinition {
  const rows = Array.from({ length: 15 }, () => '.'.repeat(15));
  rows[0] = `E${rows[0]!.slice(1)}`;
  const level = defineLevelFromRows({ id: 6, rows, startPosition: { x: 0, y: 0 } });

  level.cells[0] = {
    kind: legacyCodeToTileKind(LEGACY_CODES.entrance),
    legacyCode: LEGACY_CODES.entrance
  };
  level.cells[1] = {
    kind: legacyCodeToTileKind(LEGACY_CODES.exit),
    legacyCode: LEGACY_CODES.exit
  };
  level.startPosition = { x: 0, y: 0 };
  level.authoredEntrancePosition = { x: 0, y: 0 };

  return level;
}
