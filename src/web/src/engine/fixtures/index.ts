import {
  CLASS_LABELS,
  DEFAULT_LIGHT_USES,
  LEGACY_CODES,
  computeSpellChargesFromInventory,
  createEmptyInventorySlots,
  createHeroStatus,
  deriveClassId,
  legacyCodeToTileKind,
  tileKindToLegacyCode
} from '../catalog';
import type {
  BaseTileKind,
  ClassId,
  HeroState,
  LevelDefinition,
  MonsterSpawn,
  Point,
  Stats
} from '../types';

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

function cellFromChar(character: string): {
  kind: BaseTileKind;
  monsterLegacyCode: number | null;
} {
  switch (character) {
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

function createLevel(id: number, rows: string[], startPosition: Point): LevelDefinition {
  const cells = [];
  const monsterSpawns: MonsterSpawn[] = [];
  let authoredEntrancePosition = startPosition;

  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y] ?? '';

    for (let x = 0; x < row.length; x += 1) {
      const symbol = row[x] ?? '.';
      const parsed = cellFromChar(symbol);
      const point = { x, y };

      if (parsed.kind === 'entrance') {
        authoredEntrancePosition = point;
      }

      if (parsed.monsterLegacyCode !== null) {
        monsterSpawns.push({
          id: `monster-${id}-${monsterSpawns.length + 1}`,
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

  return {
    id,
    width: 15,
    height: 15,
    cells,
    startPosition,
    authoredEntrancePosition,
    monsterSpawns
  };
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

export const wallBumpLevel = createLevel(
  1,
  [
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
  { x: 7, y: 7 }
);

export const trapEscapeLevel = createLevel(
  2,
  [
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
  { x: 7, y: 7 }
);

export const revealGuardLevel = createLevel(
  3,
  [
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
  { x: 6, y: 7 }
);

export const idolFinishLevel = createLevel(
  4,
  [
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
  { x: 7, y: 7 }
);

export const mixedDemoLevel = createLevel(
  5,
  [
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
  { x: 7, y: 7 }
);

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
  const level = createLevel(6, rows, { x: 0, y: 0 });

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
