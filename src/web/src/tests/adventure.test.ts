import { describe, expect, it } from 'vitest';

import {
  Adventure,
  deriveStageSeed,
  validateAdventureDefinition
} from '../adventure/model';
import type { AdventureDefinition, SerializedAdventure } from '../adventure/model';
import { lostIdolAdventure } from '../content/adventures';
import { LEGACY_CODES, createHeroStatus } from '../engine/catalog';
import { warriorStarter } from '../engine/fixtures';
import { defineLevelFromRows } from '../engine/levelBuilder';
import { parsePlaySession } from '../persist/save';
import { serializePlaySession } from '../play/session';

function createCompactAdventure(): AdventureDefinition {
  const openRows = [
    '###############',
    '#EX...........#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '###############'
  ];
  const finalRows = [...openRows];

  finalRows[1] = '#EI..........X#';

  return {
    id: 'compact-adventure',
    title: 'Compact Adventure',
    description: 'A compact deterministic test quest.',
    stages: [
      { id: 'one', title: 'One', level: defineLevelFromRows({ id: 1, rows: openRows }) },
      { id: 'two', title: 'Two', level: defineLevelFromRows({ id: 2, rows: openRows }) },
      { id: 'three', title: 'Three', level: defineLevelFromRows({ id: 3, rows: finalRows }) }
    ]
  };
}

function escapedAdventureSave(
  adventure: Adventure,
  heroPatch: Partial<SerializedAdventure['currentRun']['hero']> = {}
): SerializedAdventure {
  const save = adventure.serialize();

  save.status = 'playing';
  save.currentRun.runStatus = 'escaped';
  save.currentRun.hero = {
    ...save.currentRun.hero,
    ...heroPatch,
    status: { ...createHeroStatus(), escaped: true }
  };

  return save;
}

describe('adventure progression', () => {
  it('validates the bundled three-level quest and deterministic stage seeds', () => {
    expect(validateAdventureDefinition(lostIdolAdventure)).toEqual([]);
    expect(lostIdolAdventure.stages.map((stage) => stage.level.id)).toEqual([1, 2, 3]);
    expect(deriveStageSeed(1984, 0)).toBe(deriveStageSeed(1984, 0));
    expect(deriveStageSeed(1984, 0)).not.toBe(deriveStageSeed(1984, 1));
  });

  it('carries exact depleted hero state into the next level', () => {
    const definition = createCompactAdventure();
    const adventure = new Adventure({ hero: warriorStarter, definition, seed: 1984 });
    const save = adventure.serialize();

    save.currentRun.hero.stats = {
      ...warriorStarter.stats,
      strength: 4.25,
      vitality: 6.5,
      experience: 2.2
    };
    save.currentRun.hero.position = { x: 1, y: 1 };
    save.currentRun.hero.facing = 'E';
    save.currentRun.hero.lightUses = 3;
    save.currentRun.hero.spellCharges = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    save.currentRun.hero.gold = 51;
    save.currentRun.hero.treasure = 2;
    const resumed = Adventure.fromSerialized(save, definition);

    resumed.step({ type: 'moveForward' });
    expect(resumed.snapshot().status).toBe('betweenLevels');
    const carriedHero = resumed.serialize().currentRun.hero;

    resumed.continueToNextLevel();

    const snapshot = resumed.snapshot();

    expect(snapshot.stageIndex).toBe(1);
    expect(snapshot.currentRun.hero.position).toEqual({ x: 1, y: 1 });
    expect(snapshot.currentRun.hero.facing).toBe('N');
    expect(snapshot.currentRun.hero.stats).toEqual(carriedHero.stats);
    expect(snapshot.currentRun.hero.lightUses).toBe(carriedHero.lightUses);
    expect(snapshot.currentRun.hero.spellCharges).toEqual(carriedHero.spellCharges);
    expect(snapshot.currentRun.hero.gold).toBe(carriedHero.gold);
    expect(snapshot.currentRun.hero.treasure).toBe(carriedHero.treasure);
    expect(snapshot.currentRun.hero.status).toEqual(createHeroStatus());
    expect(snapshot.currentRun.exitExperienceTarget).toBe(3);
  });

  it('blocks a level that is deeper than current experience', () => {
    const definition = createCompactAdventure();
    const adventure = new Adventure({ hero: warriorStarter, definition, seed: 7 });
    const save = escapedAdventureSave(adventure, {
      stats: { ...warriorStarter.stats, experience: 1.9 }
    });
    const resumed = Adventure.fromSerialized(save, definition);

    resumed.step({ type: 'wait' });
    expect(() => resumed.continueToNextLevel()).toThrow('LEVEL TOO DEEP');
    expect(resumed.snapshot().status).toBe('betweenLevels');
  });

  it('restores a serialized adventure and its current run exactly', () => {
    const definition = createCompactAdventure();
    const adventure = new Adventure({ hero: warriorStarter, definition, seed: 12 });

    adventure.step({ type: 'turnRight' });
    adventure.step({ type: 'wait' });
    const restored = Adventure.fromSerialized(adventure.serialize(), definition);

    expect(restored.snapshot()).toEqual(adventure.snapshot());

    const session = serializePlaySession({ kind: 'adventure', adventure });
    expect(parsePlaySession(JSON.stringify(session))).toEqual(session);
    expect(parsePlaySession(JSON.stringify(adventure.serialize()))).toBeNull();
  });

  it('carves the level-two verse above the stair down, over a relic its warden guards', () => {
    const verse = lostIdolAdventure.stages[1]!.verse;
    const galleries = lostIdolAdventure.stages[1]!.level;
    const adventure = new Adventure({ hero: warriorStarter, definition: lostIdolAdventure, seed: 5 });

    expect(verse?.split('\n')).toHaveLength(4);
    expect(galleries.cells[13 * 15 + 1]?.kind).toBe('relic');
    expect(galleries.monsterSpawns).toContainEqual(
      expect.objectContaining({ position: { x: 2, y: 13 }, legacyTileCode: LEGACY_CODES.warden })
    );
    expect(adventure.snapshot().stageVerse).toBeNull();

    const resumed = Adventure.fromSerialized(
      escapedAdventureSave(adventure, { stats: { ...warriorStarter.stats, experience: 2 } }),
      lostIdolAdventure
    );

    resumed.step({ type: 'wait' });
    expect(resumed.snapshot().status).toBe('betweenLevels');
    expect(resumed.snapshot().nextStageVerse).toBe(verse);
    resumed.continueToNextLevel();
    expect(resumed.snapshot().stageVerse).toBe(verse);
    expect(resumed.snapshot().nextStageVerse).toBeNull();
  });

  it('progresses through real exits and completes only when the Idol is taken', () => {
    const definition = createCompactAdventure();
    let adventure = new Adventure({ hero: warriorStarter, definition, seed: 33 });

    for (let stage = 0; stage < 2; stage += 1) {
      const save = adventure.serialize();

      save.currentRun.hero.stats.experience = save.currentRun.exitExperienceTarget;
      save.currentRun.hero.position = { x: 1, y: 1 };
      save.currentRun.hero.facing = 'E';
      adventure = Adventure.fromSerialized(save, definition);
      adventure.step({ type: 'moveForward' });
      expect(adventure.snapshot().status).toBe('betweenLevels');
      adventure.continueToNextLevel();
    }

    adventure.step({ type: 'turnRight' });
    adventure.step({ type: 'get' });

    expect(adventure.snapshot().status).toBe('won');
    expect(adventure.snapshot().currentRun.runStatus).toBe('won');
    expect(adventure.snapshot().completedStages).toHaveLength(3);
  });

  it('ends on death, and holds the hero in the final level until the Idol is taken', () => {
    const definition = createCompactAdventure();
    const dying = new Adventure({ hero: warriorStarter, definition, seed: 44 });
    const dyingSave = dying.serialize();

    dyingSave.currentRun.hero.stats.strength = 0.5;
    const resumedDying = Adventure.fromSerialized(dyingSave, definition);
    resumedDying.step({ type: 'wait' });
    expect(resumedDying.snapshot().status).toBe('dead');

    let escaping = new Adventure({ hero: warriorStarter, definition, seed: 45 });

    for (let stage = 0; stage < 2; stage += 1) {
      escaping = Adventure.fromSerialized(escapedAdventureSave(escaping, {
        stats: {
          ...escaping.serialize().currentRun.hero.stats,
          experience: stage + 2
        }
      }), definition);
      escaping.step({ type: 'wait' });
      escaping.continueToNextLevel();
    }

    const finalSave = escaping.serialize();

    finalSave.currentRun.hero.stats.experience = finalSave.currentRun.exitExperienceTarget;
    finalSave.currentRun.hero.position = { x: 12, y: 1 };
    finalSave.currentRun.hero.facing = 'E';
    escaping = Adventure.fromSerialized(finalSave, definition);
    escaping.step({ type: 'moveForward' });

    expect(escaping.snapshot().status).toBe('playing');
    expect(escaping.snapshot().currentRun.hero.position).toEqual({ x: 12, y: 1 });
    expect(escaping.snapshot().currentRun.messages.at(-1)).toBe('YOU NEED THE IDOL');
  });
});
