import {
  CLASS_LABELS,
  DEFAULT_LIGHT_USES,
  ITEM_CATALOG,
  computeSpellChargesFromInventory,
  createEmptyInventorySlots,
  createHeroStatus,
  deriveClassId
} from '../engine/catalog';
import { Rng } from '../engine/rng';
import type { ClassId, HeroState, Stats } from '../engine/types';

export const CREATOR_STAT_KEYS = [
  'strength',
  'vitality',
  'agility',
  'intelligence',
  'experience',
  'luck',
  'aura',
  'morality'
] as const;

export const ADJUSTABLE_CREATOR_STAT_KEYS = [
  'strength',
  'vitality',
  'agility',
  'intelligence',
  'luck',
  'aura',
  'morality'
] as const;

export type CreatorStatKey = (typeof CREATOR_STAT_KEYS)[number];
export type AdjustableCreatorStatKey = (typeof ADJUSTABLE_CREATOR_STAT_KEYS)[number];
export type CreatorStorePage = 'armoury' | 'accoutrements' | 'emporium';
export type CreatorPurchaseMode = 'fullPrice' | 'bargain';

export interface CreatorCatalogItem {
  slot: number;
  page: CreatorStorePage;
  name: string;
  price: number;
  power: number;
  allowedClasses: ClassId[];
  stackable: boolean;
}

export interface CreatorDraft {
  name: string;
  seed: number;
  rngState: number;
  stats: Stats;
  modificationPoints: number;
  gold: number;
  inventorySlots: Record<number, number>;
  selectedStorePage: CreatorStorePage;
  bargainOffer: number;
}

export interface CreatorValidation {
  errors: string[];
  warnings: string[];
  canCreate: boolean;
  canExportLegacy: boolean;
}

export interface CreatorPurchaseResult {
  draft: CreatorDraft;
  success: boolean;
  message: string;
}

export const CREATOR_STORE_PAGES: Array<{ page: CreatorStorePage; label: string }> = [
  { page: 'armoury', label: 'Armoury' },
  { page: 'accoutrements', label: 'Accoutrements' },
  { page: 'emporium', label: 'Emporium' }
];

const CLASS_FLAG_ORDER: ClassId[] = ['wanderer', 'cleric', 'mage', 'warrior', 'barbarian'];
const CREATOR_LEGACY_MIN = 0;
const CREATOR_LEGACY_MAX = 190;
const DEFAULT_CREATOR_SEED = 1984;
const ITEM_PRICES = [
  20, 16, 12, 15, 8, 10, 8, 6, 18, 15, 9, 9, 14, 8, 6, 6, 20, 15, 14, 12, 10,
  8, 6, 6
];
const ITEM_POWERS = [
  5, 4, 3, 3, 2, 2, 1, 1, 5, 4, 3, 1, 2, 1, 3, 1, 4, 3, 2, 2, 3, 1, 1, 1
];
const ITEM_CLASS_FLAGS = [
  '00001',
  '00011',
  '10011',
  '10011',
  '10011',
  '00011',
  '11111',
  '10011',
  '00011',
  '00011',
  '10011',
  '11111',
  '00011',
  '11011',
  '11011',
  '11111',
  '11100',
  '00100',
  '11100',
  '10100',
  '11100',
  '11100',
  '11111',
  '11111'
];

export const CREATOR_ITEM_CATALOG: CreatorCatalogItem[] = Array.from(
  { length: 24 },
  (_, index): CreatorCatalogItem => {
    const slot = index + 1;
    const catalogEntry = ITEM_CATALOG[slot];

    return {
      slot,
      page: pageForSlot(slot),
      name: catalogEntry?.name ?? `item ${slot}`,
      price: ITEM_PRICES[index] ?? 0,
      power: ITEM_POWERS[index] ?? 0,
      allowedClasses: classesFromFlags(ITEM_CLASS_FLAGS[index] ?? '00000'),
      stackable: catalogEntry?.stackable ?? false
    };
  }
);

export function createDefaultCreatorDraft(seed = DEFAULT_CREATOR_SEED): CreatorDraft {
  return rollCreatorDraft(seed);
}

export function rollCreatorDraft(seed = DEFAULT_CREATOR_SEED): CreatorDraft {
  const normalizedSeed = normalizeSeed(seed);
  const rng = new Rng(normalizedSeed);
  const stats: Stats = {
    strength: rng.int(3, 7),
    vitality: rng.int(3, 7),
    agility: rng.int(3, 7),
    intelligence: rng.int(3, 7),
    experience: rng.int(3, 7),
    luck: rng.int(3, 7),
    aura: rng.int(3, 7),
    morality: rng.int(3, 7)
  };

  stats.experience = 1;

  const modificationPoints = rng.int(4, 8);
  const gold = rng.int(121, 180);

  return {
    name: 'Hero',
    seed: normalizedSeed,
    stats,
    modificationPoints,
    gold,
    rngState: rng.getState(),
    inventorySlots: createEmptyInventorySlots(),
    selectedStorePage: 'armoury',
    bargainOffer: 0
  };
}

export function adjustCreatorStat(
  draft: CreatorDraft,
  stat: CreatorStatKey,
  delta: number
): CreatorDraft {
  if (stat === 'experience' || delta === 0) {
    return structuredClone(draft);
  }

  const nextDraft = structuredClone(draft);
  const step = Math.sign(delta);

  if (step > 0) {
    if (nextDraft.modificationPoints <= 0) {
      return nextDraft;
    }

    nextDraft.stats[stat] += 1;
    nextDraft.modificationPoints -= 1;
    return nextDraft;
  }

  if (nextDraft.stats[stat] <= 1) {
    return nextDraft;
  }

  nextDraft.stats[stat] -= 1;
  nextDraft.modificationPoints += 1;

  return nextDraft;
}

export function attemptCreatorPurchase(
  draft: CreatorDraft,
  slot: number,
  mode: CreatorPurchaseMode,
  offer = draft.bargainOffer
): CreatorPurchaseResult {
  const item = CREATOR_ITEM_CATALOG.find((entry) => entry.slot === slot);

  if (!item) {
    return { draft: structuredClone(draft), success: false, message: 'Unknown item.' };
  }

  const classId = deriveClassId(draft.stats);

  if (!item.allowedClasses.includes(classId)) {
    return {
      draft: structuredClone(draft),
      success: false,
      message: `Not for ${CLASS_LABELS[classId]}.`
    };
  }

  if (!item.stackable && (draft.inventorySlots[slot] ?? 0) > 0) {
    return { draft: structuredClone(draft), success: false, message: 'You have it sire.' };
  }

  if (mode === 'fullPrice') {
    return buyCreatorItem(draft, item, item.price);
  }

  if (!Number.isFinite(offer) || !Number.isInteger(offer) || offer < 0) {
    return { draft: structuredClone(draft), success: false, message: 'Enter a whole-coin offer.' };
  }

  const rng = new Rng(draft.seed);

  rng.setState(draft.rngState);

  const discount = rng.int(1, 3);
  const bargainPrice = Math.max(0, item.price - discount);
  const nextDraft = {
    ...structuredClone(draft),
    rngState: rng.getState()
  };

  if (offer < bargainPrice) {
    return { draft: nextDraft, success: false, message: 'Offer rejected.' };
  }

  return buyCreatorItem(nextDraft, item, bargainPrice);
}

export function heroFromCreatorDraft(draft: CreatorDraft): HeroState {
  const stats = structuredClone(draft.stats);
  const inventorySlots = normalizeInventorySlots(draft.inventorySlots);
  const classId = deriveClassId(stats);
  const name = sanitizeHeroName(draft.name) || 'Hero';
  const hero: HeroState = {
    name,
    displayLabel: `${name} -${CLASS_LABELS[classId]}`,
    classId,
    stats,
    baseStats: structuredClone(stats),
    gold: draft.gold,
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

export function validateCreatorDraft(draft: CreatorDraft): CreatorValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const name = sanitizeHeroName(draft.name);

  if (name.length === 0) {
    errors.push('Hero name is required.');
  }

  if (name.length > 10) {
    errors.push('Hero name must be 10 characters or fewer.');
  }

  if (!/^[\x20-\x7e]*$/.test(name)) {
    errors.push('Hero name must use printable ASCII characters.');
  }

  for (const stat of CREATOR_STAT_KEYS) {
    const value = draft.stats[stat];

    if (!Number.isInteger(value)) {
      errors.push(`${stat} must be an integer.`);
    }

    if (!isLegacySafeValue(value)) {
      errors.push(`${stat} must be between ${CREATOR_LEGACY_MIN} and ${CREATOR_LEGACY_MAX}.`);
    }
  }

  if (draft.stats.experience !== 1) {
    errors.push('Experience must remain fixed at 1 during character creation.');
  }

  if (!Number.isInteger(draft.modificationPoints) || draft.modificationPoints < 0) {
    errors.push('Modification points must be a non-negative integer.');
  }

  if (!isLegacySafeValue(draft.gold)) {
    errors.push(`Gold must be between ${CREATOR_LEGACY_MIN} and ${CREATOR_LEGACY_MAX}.`);
  }

  for (let slot = 1; slot <= 24; slot += 1) {
    const value = draft.inventorySlots[slot] ?? 0;

    if (!isLegacySafeValue(value)) {
      errors.push(`Inventory slot ${slot} must be between ${CREATOR_LEGACY_MIN} and ${CREATOR_LEGACY_MAX}.`);
    }
  }

  if (draft.modificationPoints > 0) {
    warnings.push('Unspent modification points remain.');
  }

  return {
    errors,
    warnings,
    canCreate: errors.length === 0,
    canExportLegacy: errors.length === 0
  };
}

export function itemsForCreatorPage(page: CreatorStorePage): CreatorCatalogItem[] {
  return CREATOR_ITEM_CATALOG.filter((item) => item.page === page);
}

export function sanitizeHeroName(name: string): string {
  return name.trim();
}

function buyCreatorItem(
  draft: CreatorDraft,
  item: CreatorCatalogItem,
  price: number
): CreatorPurchaseResult {
  if (draft.gold < price) {
    return { draft: structuredClone(draft), success: false, message: 'Thy purse is too light.' };
  }

  const nextDraft = structuredClone(draft);

  nextDraft.gold -= price;
  nextDraft.inventorySlots[item.slot] = (nextDraft.inventorySlots[item.slot] ?? 0) + item.power;

  return { draft: nextDraft, success: true, message: 'Tis yours.' };
}

function classesFromFlags(flags: string): ClassId[] {
  const classes: ClassId[] = [];

  for (let index = 0; index < CLASS_FLAG_ORDER.length; index += 1) {
    if (flags[index] === '1') {
      classes.push(CLASS_FLAG_ORDER[index]!);
    }
  }

  return classes;
}

function pageForSlot(slot: number): CreatorStorePage {
  if (slot <= 8) {
    return 'armoury';
  }

  if (slot <= 16) {
    return 'accoutrements';
  }

  return 'emporium';
}

function normalizeInventorySlots(input: Record<number, number>): Record<number, number> {
  const inventorySlots = createEmptyInventorySlots();

  for (let slot = 1; slot <= 24; slot += 1) {
    inventorySlots[slot] = input[slot] ?? 0;
  }

  return inventorySlots;
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    return DEFAULT_CREATOR_SEED;
  }

  const normalized = Math.floor(seed) >>> 0;

  return normalized === 0 ? DEFAULT_CREATOR_SEED : normalized;
}

function isLegacySafeValue(value: number): boolean {
  return Number.isInteger(value) && value >= CREATOR_LEGACY_MIN && value <= CREATOR_LEGACY_MAX;
}
