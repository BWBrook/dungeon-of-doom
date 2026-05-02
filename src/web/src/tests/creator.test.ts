import { describe, expect, it } from 'vitest';

import {
  adjustCreatorStat,
  attemptCreatorPurchase,
  createDefaultCreatorDraft,
  heroFromCreatorDraft,
  rollCreatorDraft,
  validateCreatorDraft
} from '../creator/model';
import type { CreatorDraft } from '../creator/model';
import { DEFAULT_LIGHT_USES, createEmptyInventorySlots } from '../engine/catalog';
import type { Stats } from '../engine/types';
import { formatHeroString, parseHeroString } from '../persist/legacy';
import { formatHeroDocument, parseHeroDocument } from '../persist/heroDocument';

function withStats(draft: CreatorDraft, stats: Partial<Stats>): CreatorDraft {
  return {
    ...draft,
    stats: {
      ...draft.stats,
      ...stats
    }
  };
}

function classDraft(classStats: Partial<Stats>): CreatorDraft {
  return {
    ...withStats(createDefaultCreatorDraft(123), classStats),
    name: 'Test',
    gold: 180,
    modificationPoints: 0,
    inventorySlots: createEmptyInventorySlots()
  };
}

describe('character creator model', () => {
  it('rolls deterministic starting drafts within archival ranges', () => {
    const first = rollCreatorDraft(1984);
    const second = rollCreatorDraft(1984);

    expect(second).toEqual(first);
    expect(first.modificationPoints).toBeGreaterThanOrEqual(4);
    expect(first.modificationPoints).toBeLessThanOrEqual(8);
    expect(first.gold).toBeGreaterThanOrEqual(121);
    expect(first.gold).toBeLessThanOrEqual(180);
    expect(first.stats.experience).toBe(1);

    for (const [key, value] of Object.entries(first.stats)) {
      if (key === 'experience') {
        continue;
      }

      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
    }
  });

  it('adjusts stats with modification points but never edits experience', () => {
    const draft = {
      ...createDefaultCreatorDraft(2),
      modificationPoints: 1,
      stats: {
        ...createDefaultCreatorDraft(2).stats,
        strength: 3,
        experience: 1
      }
    };
    const raised = adjustCreatorStat(draft, 'strength', 1);
    const blocked = adjustCreatorStat(raised, 'vitality', 1);
    const lowered = adjustCreatorStat(raised, 'strength', -1);
    const experience = adjustCreatorStat(draft, 'experience', 1);

    expect(raised.stats.strength).toBe(4);
    expect(raised.modificationPoints).toBe(0);
    expect(blocked.stats.vitality).toBe(raised.stats.vitality);
    expect(lowered.stats.strength).toBe(3);
    expect(lowered.modificationPoints).toBe(1);
    expect(experience.stats.experience).toBe(1);
    expect(experience.modificationPoints).toBe(1);
  });

  it('derives all five implemented classes from creator stats', () => {
    const cases: Array<[string, Partial<Stats>]> = [
      ['wanderer', { strength: 5, vitality: 5, intelligence: 5, aura: 5, morality: 5 }],
      ['cleric', { strength: 5, vitality: 5, intelligence: 7, aura: 5, morality: 8 }],
      ['mage', { strength: 5, vitality: 5, intelligence: 9, aura: 8, morality: 8 }],
      ['warrior', { strength: 8, vitality: 3, intelligence: 5, aura: 5, morality: 6 }],
      ['barbarian', { strength: 9, vitality: 7, agility: 6, intelligence: 5, aura: 5, morality: 5 }]
    ];

    for (const [classId, stats] of cases) {
      expect(heroFromCreatorDraft(classDraft(stats)).classId).toBe(classId);
    }
  });

  it('buys allowed items, rejects forbidden and duplicate items, and stacks restoratives', () => {
    const warrior = classDraft({
      strength: 8,
      vitality: 4,
      intelligence: 5,
      aura: 5,
      morality: 6
    });
    const firstSword = attemptCreatorPurchase(warrior, 2, 'fullPrice');
    const duplicateSword = attemptCreatorPurchase(firstSword.draft, 2, 'fullPrice');
    const salveOne = attemptCreatorPurchase(firstSword.draft, 23, 'fullPrice');
    const salveTwo = attemptCreatorPurchase(salveOne.draft, 23, 'fullPrice');
    const mage = classDraft({
      strength: 5,
      vitality: 5,
      intelligence: 9,
      aura: 8,
      morality: 8
    });
    const forbidden = attemptCreatorPurchase(mage, 1, 'fullPrice');

    expect(firstSword.success).toBe(true);
    expect(firstSword.draft.gold).toBe(warrior.gold - 16);
    expect(firstSword.draft.inventorySlots[2]).toBe(4);
    expect(duplicateSword.success).toBe(false);
    expect(duplicateSword.message).toBe('You have it sire.');
    expect(salveTwo.draft.inventorySlots[23]).toBe(2);
    expect(forbidden.success).toBe(false);
    expect(forbidden.message).toBe('Not for mage.');
    expect(forbidden.draft).toEqual(mage);
  });

  it('handles deterministic bargaining success and rejection', () => {
    const draft = classDraft({
      strength: 5,
      vitality: 5,
      intelligence: 5,
      aura: 5,
      morality: 5
    });
    const accepted = attemptCreatorPurchase(draft, 23, 'bargain', 6);
    const acceptedAgain = attemptCreatorPurchase(draft, 23, 'bargain', 6);
    const rejected = attemptCreatorPurchase(draft, 23, 'bargain', 0);

    expect(accepted.success).toBe(true);
    expect(acceptedAgain).toEqual(accepted);
    expect(accepted.draft.gold).toBeLessThan(draft.gold);
    expect(accepted.draft.gold).toBeGreaterThanOrEqual(draft.gold - 6);
    expect(rejected.success).toBe(false);
    expect(rejected.message).toBe('Offer rejected.');
    expect(rejected.draft.rngState).not.toBe(draft.rngState);
  });

  it('converts drafts to modern and legacy hero documents', () => {
    const inventorySlots = createEmptyInventorySlots();

    inventorySlots[16] = 1;
    inventorySlots[17] = 4;
    inventorySlots[18] = 3;

    const draft = {
      ...classDraft({ aura: 5 }),
      name: 'Mira',
      inventorySlots
    };
    const hero = heroFromCreatorDraft(draft);
    const modernDocument = parseHeroDocument(formatHeroDocument(hero));
    const legacyHero = parseHeroString(formatHeroString(hero));

    expect(hero.baseStats).toEqual(hero.stats);
    expect(hero.treasure).toBe(0);
    expect(hero.lightUses).toBe(DEFAULT_LIGHT_USES);
    expect(hero.spellCharges[1]).toBe(20);
    expect(hero.spellCharges[4]).toBe(15);
    expect(modernDocument.hero).toEqual(hero);
    expect(legacyHero.displayLabel).toBe(hero.displayLabel);
  });

  it('validates names, fixed experience, and legacy-safe values', () => {
    const blank = {
      ...createDefaultCreatorDraft(4),
      name: '',
      modificationPoints: 0
    };
    const tooLong = {
      ...blank,
      name: 'LongerThan10'
    };
    const badExperience = {
      ...classDraft({}),
      stats: {
        ...classDraft({}).stats,
        experience: 2
      }
    };

    expect(validateCreatorDraft(blank).errors).toContain('Hero name is required.');
    expect(validateCreatorDraft(tooLong).errors).toContain(
      'Hero name must be 10 characters or fewer.'
    );
    expect(validateCreatorDraft(badExperience).errors).toContain(
      'Experience must remain fixed at 1 during character creation.'
    );
    expect(validateCreatorDraft(classDraft({})).canCreate).toBe(true);
  });
});
