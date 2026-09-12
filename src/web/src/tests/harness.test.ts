import { describe, expect, it } from 'vitest';

import { lostIdolAdventure } from '../content/adventures';
import { deriveClassId } from '../engine/catalog';
import { ARCHETYPES, buildArchetypeHero } from '../harness/heroes';
import { chooseAction, findPath } from '../harness/policy';
import { formatSummaryTable, simulateAdventure, summarizeRuns } from '../harness/simulate';
import { Adventure } from '../adventure/model';

describe('balance harness', () => {
  it('builds one legal hero per class through the creator rules', () => {
    const heroes = ARCHETYPES.map(buildArchetypeHero);

    expect(heroes.map((hero) => hero.classId)).toEqual([
      'barbarian',
      'warrior',
      'wanderer',
      'cleric',
      'mage'
    ]);

    for (const hero of heroes) {
      expect(deriveClassId(hero.stats)).toBe(hero.classId);
      expect(hero.gold).toBeGreaterThanOrEqual(0);
      expect(hero.inventorySlots[16]).toBe(1);
      expect((hero.inventorySlots[24] ?? 0) + (hero.inventorySlots[23] ?? 0)).toBeGreaterThan(0);
    }

    expect(heroes[4]!.inventorySlots[17]).toBeGreaterThan(0);
    expect(heroes[4]!.inventorySlots[18]).toBeGreaterThan(0);
    expect(heroes[0]!.inventorySlots[17]).toBe(0);
  });

  it('paths around walls and turns toward the next step', () => {
    const hero = buildArchetypeHero(ARCHETYPES[1]!);
    const adventure = new Adventure({ hero, definition: lostIdolAdventure, seed: 3 });
    const run = adventure.serialize().currentRun;
    const path = findPath(run, run.hero.position, { x: 13, y: 13 }, false);

    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 1, y: 1 });
    expect(path!.at(-1)).toEqual({ x: 13, y: 13 });
    expect(path!.every((point) => run.level.cells[point.y * 15 + point.x]!.kind !== 'wall')).toBe(true);

    const action = chooseAction({ run, isFinalStage: false });

    expect(['turnLeft', 'turnRight', 'moveForward']).toContain(action.type);
  });

  it('simulates deterministically and summarizes every class', () => {
    const hero = buildArchetypeHero(ARCHETYPES[1]!);
    const first = simulateAdventure(hero, lostIdolAdventure, 11, { maxTurnsPerStage: 400 });
    const second = simulateAdventure(hero, lostIdolAdventure, 11, { maxTurnsPerStage: 400 });

    expect(second).toEqual(first);
    expect(['won', 'dead', 'abandoned', 'blocked', 'stalled']).toContain(first.outcome);
    expect(first.turns).toBeGreaterThan(0);
    expect(first.stages.length).toBeGreaterThan(0);

    const records = ARCHETYPES.flatMap((archetype) =>
      [1, 2].map((seed) =>
        simulateAdventure(buildArchetypeHero(archetype), lostIdolAdventure, seed, { maxTurnsPerStage: 400 })
      )
    );
    const summaries = summarizeRuns(records, lostIdolAdventure.stages.length);

    expect(summaries).toHaveLength(5);
    expect(summaries.every((summary) => summary.runs === 2)).toBe(true);
    expect(formatSummaryTable(summaries, 3)).toContain('| barbarian |');
  });
});
