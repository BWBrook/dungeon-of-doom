import { describe, expect, it } from 'vitest';

import { RELIC_SLOT, createEmptyInventorySlots, createHeroStatus } from '../engine/catalog';
import type { HeroState, LevelDefinition, Snapshot, Stats } from '../engine/types';
import { createRunPresentation } from '../ui/runPresentation';

function createStats(overrides: Partial<Stats> = {}): Stats {
  return {
    strength: overrides.strength ?? 8,
    vitality: overrides.vitality ?? 7,
    agility: overrides.agility ?? 6,
    intelligence: overrides.intelligence ?? 5,
    experience: overrides.experience ?? 1,
    luck: overrides.luck ?? 5,
    aura: overrides.aura ?? 3,
    morality: overrides.morality ?? 5
  };
}

function createHero(overrides: Partial<HeroState> = {}): HeroState {
  const inventorySlots = {
    ...createEmptyInventorySlots(),
    ...(overrides.inventorySlots ?? {})
  };
  const stats = overrides.stats ?? createStats();

  return {
    name: overrides.name ?? 'Mira',
    displayLabel: overrides.displayLabel ?? 'Mira -wanderer',
    classId: overrides.classId ?? 'wanderer',
    stats,
    baseStats: overrides.baseStats ?? structuredClone(stats),
    gold: overrides.gold ?? 20,
    treasure: overrides.treasure ?? 0,
    facing: overrides.facing ?? 'N',
    position: overrides.position ?? { x: 7, y: 7 },
    inventorySlots,
    spellCharges:
      overrides.spellCharges ??
      {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0
      },
    lightUses: overrides.lightUses ?? 0,
    status: overrides.status ?? createHeroStatus()
  };
}

function createLevel(): LevelDefinition {
  return {
    id: 5,
    width: 15,
    height: 15,
    cells: [],
    startPosition: { x: 7, y: 7 },
    authoredEntrancePosition: { x: 7, y: 7 },
    monsterSpawns: []
  };
}

function createSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    hero: overrides.hero ?? createHero(),
    levelView:
      overrides.levelView ??
      {
        width: 15,
        height: 15,
        cells: []
      },
    visibleCells: overrides.visibleCells ?? [],
    activeMonster: overrides.activeMonster ?? null,
    messages: overrides.messages ?? ['The dungeon awaits.'],
    runStatus: overrides.runStatus ?? 'playing',
    score: overrides.score ?? null,
    turnCount: overrides.turnCount ?? 0,
    exitExperienceTarget: overrides.exitExperienceTarget ?? 2
  };
}

function commandEnabled(snapshot: Snapshot | null, commandId: string): boolean {
  return createRunPresentation(snapshot, createLevel()).commandStates.find((command) => command.id === commandId)
    ?.enabled ?? false;
}

describe('run presentation', () => {
  it('disables run commands before a run exists', () => {
    const presentation = createRunPresentation(null, null);

    expect(presentation.headline).toBe('Choose thy quest');
    expect(presentation.latestMessage).toBe('The dungeon awaits.');
    expect(presentation.commandStates.every((command) => !command.enabled)).toBe(true);
  });

  it('derives playable command states from current resources', () => {
    const snapshot = createSnapshot({
      hero: createHero({
        inventorySlots: { 16: 1, 17: 4, 23: 1 },
        lightUses: 2
      }),
      activeMonster: {
        id: 'guard',
        legacyTileCode: 111,
        position: { x: 7, y: 6 },
        hp: 12,
        stepSize: 1,
        state: 'active'
      }
    });
    const presentation = createRunPresentation(snapshot, createLevel());

    expect(commandEnabled(snapshot, 'attack')).toBe(true);
    expect(commandEnabled(snapshot, 'restore')).toBe(true);
    expect(commandEnabled(snapshot, 'reveal')).toBe(true);
    expect(commandEnabled(snapshot, 'conjure')).toBe(true);
    expect(presentation.resources).toContainEqual({ label: 'MAGIC', value: 'BOOK' });
    expect(presentation.resources).toContainEqual({ label: 'ACTIVE', value: '12 HP' });
  });

  it('lists a held relic among the resources until it is spent', () => {
    const holding = createRunPresentation(
      createSnapshot({ hero: createHero({ inventorySlots: { [RELIC_SLOT]: 1 } }) }),
      createLevel()
    );
    const spent = createRunPresentation(createSnapshot(), createLevel());

    expect(holding.resources).toContainEqual({ label: 'RELIC', value: 'HELD' });
    expect(spent.resources.map((resource) => resource.label)).not.toContain('RELIC');
  });

  it('enables attack only when the active monster is within reach', () => {
    const farMonster = createSnapshot({
      activeMonster: {
        id: 'far',
        legacyTileCode: 111,
        position: { x: 10, y: 7 },
        hp: 42,
        stepSize: 1,
        state: 'active'
      }
    });
    const attack = createRunPresentation(farMonster, createLevel()).commandStates.find(
      (command) => command.id === 'attack'
    );

    expect(attack?.enabled).toBe(false);
    expect(attack?.hint).toBe('The monster is out of reach.');
    expect(commandEnabled(farMonster, 'rest')).toBe(true);
  });

  it('disables attack in sanctuary even with a monster at hand', () => {
    const cells = Array.from({ length: 225 }, (_, index) => ({
      position: { x: index % 15, y: Math.floor(index / 15) },
      visible: true,
      explored: true,
      tile: index === 7 * 15 + 7 ? ('safe' as const) : ('floor' as const),
      monster: null
    }));
    const sheltered = createSnapshot({
      levelView: { width: 15, height: 15, cells },
      activeMonster: {
        id: 'near',
        legacyTileCode: 111,
        position: { x: 8, y: 6 },
        hp: 42,
        stepSize: 1,
        state: 'active'
      }
    });
    const attack = createRunPresentation(sheltered, createLevel()).commandStates.find(
      (command) => command.id === 'attack'
    );

    expect(attack?.enabled).toBe(false);
    expect(attack?.hint).toBe('None may fight in sanctuary.');
  });

  it('keeps unavailable contextual commands visible but disabled', () => {
    const snapshot = createSnapshot({
      hero: createHero(),
      activeMonster: null
    });

    expect(commandEnabled(snapshot, 'attack')).toBe(false);
    expect(commandEnabled(snapshot, 'restore')).toBe(false);
    expect(commandEnabled(snapshot, 'reveal')).toBe(false);
    expect(commandEnabled(snapshot, 'conjure')).toBe(false);
  });

  it('promotes the latest message without mutating history', () => {
    const messages = ['A GOOD BLOW', 'THE MONSTER IS SLAIN'];
    const snapshot = createSnapshot({ messages });
    const presentation = createRunPresentation(snapshot, createLevel());

    expect(presentation.latestMessage).toBe('THE MONSTER IS SLAIN');
    expect(presentation.logRows).toEqual(messages);
    expect(snapshot.messages).toEqual(messages);
  });

  it('shows every message from the current turn in order', () => {
    const snapshot = createSnapshot({ messages: ['MISSED!', 'A GOOD BLOW', 'HIT THEE!!'] });
    const presentation = createRunPresentation(snapshot, createLevel(), [], {
      turnMessages: ['A GOOD BLOW', 'HIT THEE!!']
    });

    expect(presentation.latestMessage).toBe('A GOOD BLOW \u00b7 HIT THEE!!');
    expect(presentation.logRows).toEqual(['MISSED!', 'A GOOD BLOW', 'HIT THEE!!']);
  });

  it('reports terminal outcomes and disables commands after run end', () => {
    for (const outcome of ['won', 'escaped', 'dead'] as const) {
      const presentation = createRunPresentation(
        createSnapshot({
          runStatus: outcome,
          score: outcome === 'won' ? 88 : null
        }),
        createLevel()
      );

      expect(presentation.outcome).toBe(outcome);
      expect(presentation.commandStates.every((command) => !command.enabled)).toBe(true);
    }
  });
});
