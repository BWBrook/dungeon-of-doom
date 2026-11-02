import type {
  BaseTileKind,
  ClassId,
  Facing,
  HeroState,
  Point,
  SpellSlot,
  Stats
} from './types';

export const GRID_SIZE = 15;
export const LEGACY_AS = 65;
export const LEGACY_OS = 96;
export const LEVEL_PAYLOAD_LENGTH = 228;
export const DEFAULT_LIGHT_USES = 20;
export const MESSAGE_LIMIT = 10;
export const REST_CEILING = 2 / 3;

export const LEGACY_CODES = {
  floor: LEGACY_OS + 6,
  wall: LEGACY_OS + 7,
  vase: LEGACY_OS + 8,
  chest: LEGACY_OS + 9,
  idol: LEGACY_OS + 10,
  entrance: LEGACY_OS + 11,
  exit: LEGACY_OS + 12,
  trap: LEGACY_OS + 13,
  safe: LEGACY_OS + 14,
  monster1: LEGACY_OS + 15,
  monster2: LEGACY_OS + 16,
  monster3: LEGACY_OS + 17,
  warden: LEGACY_OS + 22
} as const;

export const RELIC_SLOT = 25;

export const MESSAGE_TEXT = {
  hit1: 'A GOOD BLOW',
  hit2: 'WELL HIT SIRE',
  hit3: 'THY AIM IS TRUE',
  miss: 'MISSED!',
  monsterHit: 'HIT THEE!!',
  monsterMiss: 'IT MISSES THEE',
  monsterSlain: 'THE MONSTER IS SLAIN',
  noLight: 'NO LIGHT',
  broken: 'BROKEN THY',
  spellExhausted: 'SPELL EXHAUSTED',
  needExperience: 'YOU NEED EXPERIENCE',
  needIdol: 'YOU NEED THE IDOL',
  rested: 'THOU ART RESTED',
  restDisturbed: 'A MONSTER DISTURBS THY REST',
  exitLevel: 'EXIT FROM THIS LEVEL',
  questOver: 'THY QUEST IS OVER!',
  clericBlessing: 'A VOICE ON HIGH: WELL DONE, MY FAITHFUL ONE',
  relicTaken: 'A RELIC! IT WILL SAVE THEE ONCE',
  relicSaves: 'THE RELIC CRUMBLES AND THOU LIVEST',
  trapHeld: 'THE TRAP HOLDS THEE',
  trapFreed: 'THOU ART FREED',
  blockedByMonster: 'A MONSTER BLOCKS THE WAY',
  nothingToGet: 'NOTHING TO GET',
  noMonster: 'NO MONSTER TO FIGHT',
  outOfReach: 'THE MONSTER IS OUT OF REACH',
  noFightInSanctuary: 'NONE MAY FIGHT IN SANCTUARY',
  noMagic: 'NO MAGICKS AVAILABLE',
  spellFades: 'THE SPELL FIZZLES',
  runSaved: 'THE RUN IS SAVED'
} as const;

export const FACING_ORDER: Facing[] = ['N', 'E', 'S', 'W'];

export const FACING_VECTORS: Record<Facing, Point> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 }
};

export const CLASS_LABELS: Record<ClassId, string> = {
  wanderer: 'wanderer',
  cleric: 'cleric',
  mage: 'mage',
  warrior: 'warrior',
  barbarian: 'barbarian'
};

export const SPELL_NAMES: Record<SpellSlot, string> = {
  1: 'Superzap',
  2: 'Sanctuary',
  3: 'Teleport',
  4: 'Powersurge',
  5: 'Metamorphosis',
  6: 'Healing'
};

export const ITEM_CATALOG: Record<number, { name: string; stackable: boolean }> = {
  1: { name: '2 hand sword', stackable: false },
  2: { name: 'broadsword', stackable: false },
  3: { name: 'shortsword', stackable: false },
  4: { name: 'axe', stackable: false },
  5: { name: 'mace', stackable: false },
  6: { name: 'flail', stackable: false },
  7: { name: 'dagger', stackable: false },
  8: { name: 'gauntlet', stackable: false },
  9: { name: 'heavy armour', stackable: false },
  10: { name: 'chain armour', stackable: false },
  11: { name: 'leather armour', stackable: false },
  12: { name: 'heavy robe', stackable: false },
  13: { name: 'gold helmet', stackable: false },
  14: { name: 'headpiece', stackable: false },
  15: { name: 'shield', stackable: false },
  16: { name: 'torch', stackable: false },
  17: { name: 'necronomicon', stackable: false },
  18: { name: 'scrolls', stackable: false },
  19: { name: 'ring', stackable: false },
  20: { name: 'mystic amulet', stackable: false },
  21: { name: 'sash', stackable: false },
  22: { name: 'cloak', stackable: false },
  23: { name: 'healing salve', stackable: true },
  24: { name: 'potions', stackable: true },
  25: { name: 'relic', stackable: false }
};

export function createEmptyInventorySlots(): Record<number, number> {
  const slots: Record<number, number> = {};

  for (let index = 1; index <= 24; index += 1) {
    slots[index] = 0;
  }

  return slots;
}

export function createEmptySpellCharges(): Record<SpellSlot, number> {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0
  };
}

export function deriveClassId(stats: Stats): ClassId {
  let classId: ClassId = 'wanderer';

  if (stats.intelligence > 6 && stats.morality > 7) {
    classId = 'cleric';
  }

  if (stats.intelligence > 8 && stats.aura > 7) {
    classId = 'mage';
  }

  if (stats.strength > 7 && stats.morality > 5 && stats.strength + stats.vitality > 10) {
    classId = 'warrior';
  }

  if (stats.strength > 8 && stats.vitality + stats.agility > 12 && stats.morality < 6) {
    classId = 'barbarian';
  }

  return classId;
}

export function tileKindToLegacyCode(tileKind: BaseTileKind): number {
  switch (tileKind) {
    case 'floor':
      return LEGACY_CODES.floor;
    case 'wall':
      return LEGACY_CODES.wall;
    case 'vase':
      return LEGACY_CODES.vase;
    case 'chest':
      return LEGACY_CODES.chest;
    case 'idol':
      return LEGACY_CODES.idol;
    case 'entrance':
      return LEGACY_CODES.entrance;
    case 'exit':
      return LEGACY_CODES.exit;
    case 'trap':
      return LEGACY_CODES.trap;
    case 'safe':
      return LEGACY_CODES.safe;
    case 'relic':
      return LEGACY_CODES.floor;
  }
}

export function legacyCodeToTileKind(legacyCode: number): BaseTileKind {
  switch (legacyCode) {
    case LEGACY_CODES.wall:
      return 'wall';
    case LEGACY_CODES.vase:
      return 'vase';
    case LEGACY_CODES.chest:
      return 'chest';
    case LEGACY_CODES.idol:
      return 'idol';
    case LEGACY_CODES.entrance:
      return 'entrance';
    case LEGACY_CODES.exit:
      return 'exit';
    case LEGACY_CODES.trap:
      return 'trap';
    case LEGACY_CODES.safe:
      return 'safe';
    default:
      return 'floor';
  }
}

export function isLegacyMonsterCode(legacyCode: number): boolean {
  return legacyCode > LEGACY_CODES.safe;
}

export function monsterPowerFromLegacyCode(legacyCode: number): number {
  return legacyCode - LEGACY_CODES.vase;
}

export function monsterHpFromLegacyCode(legacyCode: number): number {
  return monsterPowerFromLegacyCode(legacyCode) * 6;
}

export function monsterStepSizeFromLegacyCode(legacyCode: number): number {
  const rawStep = Math.floor(monsterPowerFromLegacyCode(legacyCode) / 16);

  return Math.max(1, rawStep);
}

export function isSpellAvailableFromInventory(hero: HeroState, slot: SpellSlot): boolean {
  if (hero.stats.aura <= 0) {
    return false;
  }

  if (slot <= 3) {
    return (hero.inventorySlots[17] ?? 0) > 0;
  }

  return (hero.inventorySlots[18] ?? 0) > 0;
}

export function computeSpellChargesFromInventory(hero: HeroState): Record<SpellSlot, number> {
  const charges = createEmptySpellCharges();
  const necronomiconCharges = (hero.inventorySlots[17] ?? 0) * hero.stats.aura;
  const scrollCharges = (hero.inventorySlots[18] ?? 0) * hero.stats.aura;

  charges[1] = necronomiconCharges;
  charges[2] = necronomiconCharges;
  charges[3] = necronomiconCharges;
  charges[4] = scrollCharges;
  charges[5] = scrollCharges;
  charges[6] = scrollCharges;

  return charges;
}

export function createHeroStatus() {
  return {
    trapped: false,
    won: false,
    dead: false,
    escaped: false
  };
}

export function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y };
}

export function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}
