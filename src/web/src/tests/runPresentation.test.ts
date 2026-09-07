import { describe, expect, it } from 'vitest';

import { createEmptyInventorySlots, createHeroStatus } from '../engine/catalog';
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
