import {
  attemptCreatorPurchase,
  createDefaultCreatorDraft,
  heroFromCreatorDraft
} from '../creator/model';
import type { CreatorDraft } from '../creator/model';
import { deriveClassId } from '../engine/catalog';
import type { ClassId, HeroState, Stats } from '../engine/types';

export interface Archetype {
  classId: ClassId;
  name: string;
  stats: Stats;
  shoppingList: number[];
}

const ARCHETYPE_GOLD = 150;
const RESTORATIVE_TARGETS: Array<{ slot: number; count: number }> = [
  { slot: 24, count: 4 },
  { slot: 23, count: 3 }
];

export const ARCHETYPES: Archetype[] = [
  {
    classId: 'barbarian',
    name: 'Krull',
    stats: stats({ strength: 10, vitality: 9, agility: 7, intelligence: 3, luck: 7, aura: 1, morality: 4 }),
    shoppingList: [1, 9, 10, 16]
  },
  {
    classId: 'warrior',
    name: 'Rogan',
    stats: stats({ strength: 9, vitality: 8, agility: 6, intelligence: 4, luck: 7, aura: 3, morality: 7 }),
    shoppingList: [2, 9, 10, 16]
  },
  {
    classId: 'wanderer',
    name: 'Tamsin',
    stats: stats({ strength: 6, vitality: 6, agility: 6, intelligence: 6, luck: 7, aura: 5, morality: 6 }),
    shoppingList: [3, 11, 14, 15, 16, 17]
  },
  {
    classId: 'cleric',
    name: 'Selene',
    stats: stats({ strength: 5, vitality: 6, agility: 6, intelligence: 7, luck: 6, aura: 7, morality: 8 }),
    shoppingList: [7, 12, 14, 15, 16, 17]
  },
  {
    classId: 'mage',
    name: 'Ismene',
    stats: stats({ strength: 4, vitality: 5, agility: 6, intelligence: 9, luck: 6, aura: 9, morality: 5 }),
    shoppingList: [17, 18, 7, 12, 16]
  }
];

export function buildArchetypeHero(archetype: Archetype): HeroState {
  if (deriveClassId(archetype.stats) !== archetype.classId) {
    throw new Error(`Archetype ${archetype.name} does not derive ${archetype.classId}.`);
  }

  let draft: CreatorDraft = {
    ...createDefaultCreatorDraft(),
    name: archetype.name,
    stats: structuredClone(archetype.stats),
    modificationPoints: 0,
    gold: ARCHETYPE_GOLD
  };

  for (const slot of archetype.shoppingList) {
    draft = attemptCreatorPurchase(draft, slot, 'fullPrice').draft;
  }

  for (const target of RESTORATIVE_TARGETS) {
    while ((draft.inventorySlots[target.slot] ?? 0) < target.count) {
      const result = attemptCreatorPurchase(draft, target.slot, 'fullPrice');

      if (!result.success) {
        break;
      }

      draft = result.draft;
    }
  }

  return heroFromCreatorDraft(draft);
}

export function archetypeById(classId: ClassId): Archetype {
  const archetype = ARCHETYPES.find((entry) => entry.classId === classId);

  if (!archetype) {
    throw new Error(`No archetype for ${classId}.`);
  }

  return archetype;
}

function stats(values: Omit<Stats, 'experience'>): Stats {
  return { ...values, experience: 1 };
}
