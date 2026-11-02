import { describe, expect, it } from 'vitest';

import { lostIdolAdventure } from '../content/adventures';
import { deriveClassId } from '../engine/catalog';
import { ARCHETYPES, buildArchetypeHero } from '../harness/heroes';
import { chooseAction, findPath, fogView, omniscientView } from '../harness/policy';
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
    const view = omniscientView(run);
    const path = findPath(view, run.hero.position, { x: 13, y: 13 }, false);

    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 1, y: 1 });
    expect(path!.at(-1)).toEqual({ x: 13, y: 13 });
    expect(path!.every((point) => run.level.cells[point.y * 15 + point.x]!.kind !== 'wall')).toBe(true);

    const action = chooseAction({ view, isFinalStage: false });

    expect(['turnLeft', 'turnRight', 'moveForward']).toContain(action.type);
  });

  it('gives the fog bot only what the play screen shows', () => {
    const hero = buildArchetypeHero(ARCHETYPES[1]!);
    const adventure = new Adventure({ hero, definition: lostIdolAdventure, seed: 3 });
    const omniscient = omniscientView(adventure.serialize().currentRun);
    const fog = fogView(adventure.snapshot().currentRun);

    expect(omniscient.tiles.every((tile) => tile !== null)).toBe(true);
    expect(omniscient.monsters.length).toBeGreaterThan(0);
    expect(fog.tiles.filter((tile) => tile !== null)).toEqual(['entrance']);
    expect(fog.monsters).toEqual([]);

    adventure.step({ type: 'reveal' });
    const revealed = fogView(adventure.snapshot().currentRun);

    expect(revealed.tiles.filter((tile) => tile !== null)).toHaveLength(9);
    expect(revealed.tiles.filter((tile) => tile === 'wall').length).toBeGreaterThan(0);
  });

  it('spends light only above the level floor, and explores on foot otherwise', () => {
    const hero = buildArchetypeHero(ARCHETYPES[1]!);
    const adventure = new Adventure({ hero, definition: lostIdolAdventure, seed: 3 });
    const view = fogView(adventure.snapshot().currentRun);

    expect(chooseAction({ view, isFinalStage: false, lightFloor: 13 }).type).toBe('reveal');
    expect(['turnLeft', 'turnRight', 'moveForward']).toContain(
      chooseAction({ view, isFinalStage: false, lightFloor: view.hero.lightUses }).type
    );
    expect(['turnLeft', 'turnRight', 'moveForward']).toContain(
      chooseAction({ view: omniscientView(adventure.serialize().currentRun), isFinalStage: false, lightFloor: 0 }).type
    );
  });

  it('simulates deterministically and summarizes every class', () => {
    const hero = buildArchetypeHero(ARCHETYPES[1]!);
    const first = simulateAdventure(hero, lostIdolAdventure, 11, { maxTurnsPerStage: 400 });
    const second = simulateAdventure(hero, lostIdolAdventure, 11, { maxTurnsPerStage: 400 });

    expect(second).toEqual(first);
    expect(simulateAdventure(hero, lostIdolAdventure, 11, { vision: 'fog' })).toEqual(
      simulateAdventure(hero, lostIdolAdventure, 11, { vision: 'fog' })
    );
    expect(['won', 'dead', 'blocked', 'stalled']).toContain(first.outcome);
    expect(first.turns).toBeGreaterThan(0);
    expect(first.stages.length).toBeGreaterThan(0);

    const records = ARCHETYPES.flatMap((archetype) =>
      [1, 2].map((seed) =>
        simulateAdventure(buildArchetypeHero(archetype), lostIdolAdventure, seed, { maxTurnsPerStage: 400 })
      )
    );
    const summaries = summarizeRuns(records, lostIdolAdventure.stages.length);

    expect(summaries).toHaveLength(5);
    expect(summaries.every((summary) => summary.style === 'careful')).toBe(true);
    expect(summaries.every((summary) => summary.runs === 2)).toBe(true);
    expect(formatSummaryTable(summaries, 3)).toContain('| barbarian |');
  });

  it('leaves the relic alone when heeding the verse, and takes it when seeking', () => {
    const hero = buildArchetypeHero(ARCHETYPES.find((archetype) => archetype.classId === 'barbarian')!);

    for (const vision of ['omniscient', 'fog'] as const) {
      for (const seed of [1, 2, 3]) {
        const heeding = simulateAdventure(hero, lostIdolAdventure, seed, { vision, relicIntent: 'heed' });
        const seeking = simulateAdventure(hero, lostIdolAdventure, seed, { vision, relicIntent: 'seek' });

        expect(heeding.stages.some((stage) => stage.relicTaken), `${vision} seed ${seed} heeding`).toBe(false);
        expect(seeking.stages[1]?.relicTaken, `${vision} seed ${seed} seeking`).toBe(true);
      }
    }
  });
});
