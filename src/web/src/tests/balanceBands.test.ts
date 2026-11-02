import { describe, expect, it } from 'vitest';

import { lostIdolAdventure } from '../content/adventures';
import { ARCHETYPES, buildArchetypeHero } from '../harness/heroes';
import { simulateAdventure, summarizeRuns } from '../harness/simulate';

const SEEDS = Array.from({ length: 30 }, (_, index) => index + 1);

describe('Lost Idol balance bands', () => {
  it('keeps every class winnable and every later level lethal for a careful player', () => {
    const records = ARCHETYPES.flatMap((archetype) => {
      const hero = buildArchetypeHero(archetype);

      return SEEDS.map((seed) => simulateAdventure(hero, lostIdolAdventure, seed, { style: 'careful' }));
    });
    const summaries = summarizeRuns(records, lostIdolAdventure.stages.length);

    for (const summary of summaries) {
      expect(summary.winRate, `${summary.classId} win rate`).toBeGreaterThanOrEqual(0.7);
      expect(summary.outcomes.stalled + summary.outcomes.blocked, `${summary.classId} stuck runs`).toBe(0);
    }

    const deathsOnLevelTwo = summaries.reduce((total, summary) => total + summary.deathsByStage[1]!, 0);
    const deathsOnLevelThree = summaries.reduce((total, summary) => total + summary.deathsByStage[2]!, 0);

    expect(deathsOnLevelTwo).toBeGreaterThan(0);
    expect(deathsOnLevelThree).toBeGreaterThan(0);
  }, 60_000);

  it('rarely lets the warm-up level kill a careful player without the map, and never strands a fog bot', () => {
    const records = ARCHETYPES.flatMap((archetype) => {
      const hero = buildArchetypeHero(archetype);

      return SEEDS.slice(0, 8).map((seed) => simulateAdventure(hero, lostIdolAdventure, seed, { vision: 'fog', style: 'careful' }));
    });
    const lostOnLevelOne = records.filter((record) => record.stagesCleared === 0);

    expect(lostOnLevelOne.length, 'careful dark runs lost on level one').toBeLessThanOrEqual(1);
    for (const record of records) {
      expect(['blocked', 'stalled'], `${record.classId} seed ${record.seed}`).not.toContain(record.outcome);
    }
  }, 60_000);
});
