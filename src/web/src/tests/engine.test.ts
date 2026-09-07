import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LIGHT_USES,
  computeSpellChargesFromInventory,
  createEmptyInventorySlots,
  createHeroStatus,
  tileKindToLegacyCode
} from '../engine/catalog';
import { warriorStarter } from '../engine/fixtures';
import {
  Game,
  createGameInit,
  nextWholeExperienceTarget,
  prepareHeroForFreshRun,
  prepareHeroForNextStage
} from '../engine/game';
import type { BaseTileKind, HeroState, LevelCell, LevelDefinition, MonsterSpawn, Stats } from '../engine/types';

function createStats(overrides: Partial<Stats> = {}): Stats {
  return {
    strength: overrides.strength ?? 10,
    vitality: overrides.vitality ?? 10,
    agility: overrides.agility ?? 8,
    intelligence: overrides.intelligence ?? 5,
    experience: overrides.experience ?? 1,
    luck: overrides.luck ?? 8,
    aura: overrides.aura ?? 2,
    morality: overrides.morality ?? 5
  };
}

function createHero(overrides: Partial<HeroState> = {}): HeroState {
  const stats = overrides.stats ? structuredClone(overrides.stats) : createStats();
  const inventorySlots = overrides.inventorySlots
    ? { ...createEmptyInventorySlots(), ...overrides.inventorySlots }
    : createEmptyInventorySlots();
  const hero: HeroState = {
    name: overrides.name ?? 'Tester',
    displayLabel: overrides.displayLabel ?? 'Tester -wanderer',
    classId: overrides.classId ?? 'wanderer',
    stats,
    baseStats: overrides.baseStats ? structuredClone(overrides.baseStats) : structuredClone(stats),
    gold: overrides.gold ?? 12,
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
    lightUses: overrides.lightUses ?? ((inventorySlots[16] ?? 0) > 0 ? DEFAULT_LIGHT_USES : 0),
    status: overrides.status ?? createHeroStatus()
  };

  if (!overrides.spellCharges) {
    hero.spellCharges = computeSpellChargesFromInventory(hero);
  }

  return hero;
}

function createCell(kind: BaseTileKind): LevelCell {
  return {
    kind,
    legacyCode: tileKindToLegacyCode(kind)
  };
}

function createLevel(
  startPosition = { x: 7, y: 7 },
  tiles: Array<{ x: number; y: number; kind: BaseTileKind }> = [],
  monsters: MonsterSpawn[] = []
): LevelDefinition {
  const cells = Array.from({ length: 225 }, () => createCell('floor'));

  for (const tile of tiles) {
    cells[tile.y * 15 + tile.x] = createCell(tile.kind);
  }

  return {
    id: 1,
    width: 15,
    height: 15,
    cells,
    startPosition,
    authoredEntrancePosition: structuredClone(startPosition),
    monsterSpawns: monsters
  };
}

function createGame(hero: HeroState, level: LevelDefinition, seed = 1984) {
  return new Game(createGameInit(hero, level, seed));
}

describe('engine rules', () => {
  it('cycles facing correctly', () => {
    const hero = createHero({ facing: 'N' });
    const level = createLevel();
    const game = createGame(hero, level);

    game.step({ type: 'turnRight' });
    game.step({ type: 'turnRight' });
    game.step({ type: 'turnLeft' });

    expect(game.snapshot().hero.facing).toBe('E');
  });

  it('bumps against walls and applies the wall penalty', () => {
    const hero = createHero();
    const level = createLevel({ x: 7, y: 7 }, [{ x: 7, y: 6, kind: 'wall' }]);
    const game = createGame(hero, level, 5);
    const before = game.snapshot().hero.stats.strength;

    const result = game.step({ type: 'moveForward' });
    const after = game.snapshot().hero;

    expect(after.position).toEqual({ x: 7, y: 7 });
    expect(after.stats.strength).toBeLessThan(before);
    expect(result.messages.at(-1)).toBe('THOU STRIKEST A WALL');
  });

  it('sticks on traps and can break free on later move attempts', () => {
    const hero = createHero({ stats: createStats({ strength: 10, vitality: 10, luck: 8 }) });
    const level = createLevel({ x: 7, y: 7 }, [{ x: 7, y: 6, kind: 'trap' }]);
    const game = createGame(hero, level, 1);

    game.step({ type: 'moveForward' });
    expect(game.snapshot().hero.status.trapped).toBe(true);
    expect(game.snapshot().hero.position).toEqual({ x: 7, y: 6 });

    for (let index = 0; index < 20; index += 1) {
      game.step({ type: 'moveForward' });
      if (!game.snapshot().hero.status.trapped) {
        break;
      }
    }

    expect(game.snapshot().hero.status.trapped).toBe(false);
  });

  it('gets vase, chest, and idol correctly', () => {
    const vaseGame = createGame(
      createHero(),
      createLevel({ x: 7, y: 7 }, [{ x: 7, y: 6, kind: 'vase' }]),
      2
    );
    vaseGame.step({ type: 'get' });
    expect(vaseGame.snapshot().hero.inventorySlots[23]).toBe(1);
    expect(vaseGame.snapshot().hero.inventorySlots[24]).toBe(1);

    const chestGame = createGame(
      createHero(),
      createLevel({ x: 7, y: 7 }, [{ x: 7, y: 6, kind: 'chest' }]),
      2
    );
    chestGame.step({ type: 'get' });
    expect(chestGame.snapshot().hero.treasure).toBe(1);

    const idolGame = createGame(
      createHero(),
      createLevel({ x: 7, y: 7 }, [{ x: 7, y: 6, kind: 'idol' }]),
      2
    );
    idolGame.step({ type: 'get' });
    expect(idolGame.snapshot().runStatus).toBe('won');
    expect(idolGame.snapshot().score).not.toBeNull();
  });

  it('blocks reveal without light and reveals a 3x3 area with the nearest monster active', () => {
    const noLightHero = createHero({ lightUses: 0 });
    const withLightHero = createHero({ inventorySlots: { 16: 1 }, lightUses: DEFAULT_LIGHT_USES });
    const level = createLevel(
      { x: 7, y: 7 },
      [],
      [
        { id: 'near', position: { x: 7, y: 6 }, legacyTileCode: 111 },
        { id: 'far', position: { x: 9, y: 6 }, legacyTileCode: 112 }
      ]
    );

    const noLightGame = createGame(noLightHero, level, 4);
    const noLightResult = noLightGame.step({ type: 'reveal' });
    expect(noLightResult.messages.at(-1)).toBe('NO LIGHT');

    const litGame = createGame(withLightHero, level, 4);
    litGame.step({ type: 'reveal' });
    const snapshot = litGame.snapshot();

    expect(snapshot.visibleCells).toContainEqual({ x: 6, y: 6 });
    expect(snapshot.visibleCells).toContainEqual({ x: 7, y: 7 });
    expect(snapshot.visibleCells).not.toContainEqual({ x: 5, y: 5 });
    expect(snapshot.activeMonster?.id).toBe('near');
  });

  it('applies attack hit and miss behavior without letting misses damage monsters', () => {
    const level = createLevel(
      { x: 7, y: 7 },
      [],
      [{ id: 'guard', position: { x: 7, y: 6 }, legacyTileCode: 111 }]
    );
    const hitHero = createHero({
      stats: createStats({ agility: 30, luck: 30 }),
      inventorySlots: { 1: 5, 16: 1 },
      lightUses: DEFAULT_LIGHT_USES
    });
    const hitGame = createGame(hitHero, level, 2);

    hitGame.step({ type: 'reveal' });
    const beforeHitHp = hitGame.snapshot().activeMonster?.hp ?? 0;
    hitGame.step({ type: 'attack' });
    const afterHitHp = hitGame.snapshot().activeMonster?.hp ?? 0;

    expect(afterHitHp).toBeLessThan(beforeHitHp);

    const missHero = createHero({
      stats: createStats({ agility: 0, luck: 0 }),
      inventorySlots: { 1: 5, 16: 1 },
      lightUses: DEFAULT_LIGHT_USES
    });
    const missGame = createGame(missHero, level, 2);

    missGame.step({ type: 'reveal' });
    const beforeMissHp = missGame.snapshot().activeMonster?.hp ?? 0;
    const missResult = missGame.step({ type: 'attack' });
    const afterMissHp = missGame.snapshot().activeMonster?.hp ?? 0;

    expect(missResult.messages).toContain('MISSED!');
    expect(afterMissHp).toBe(beforeMissHp);
  });

  it('allows monsters to attack and can break the lowest occupied slot', () => {
    const level = createLevel(
      { x: 7, y: 7 },
      [],
      [{ id: 'guard', position: { x: 7, y: 6 }, legacyTileCode: 111 }]
    );
    let foundSeed: number | null = null;

    for (let seed = 1; seed < 200 && foundSeed === null; seed += 1) {
      const hero = createHero({
        stats: createStats({ agility: 0, luck: 0 }),
        inventorySlots: { 1: 5, 9: 5, 16: 1 },
        lightUses: DEFAULT_LIGHT_USES
      });
      const game = createGame(hero, level, seed);

      game.step({ type: 'reveal' });
      game.step({ type: 'wait' });

      if ((game.snapshot().hero.inventorySlots[1] ?? 0) === 0) {
        foundSeed = seed;
        expect(game.snapshot().messages).toContain('BROKEN THY 2 HAND SWORD');
      }
    }

    expect(foundSeed).not.toBeNull();
  });

  it('lets luck save gear from breaking', () => {
    const level = createLevel(
      { x: 7, y: 7 },
      [],
      [{ id: 'guard', position: { x: 7, y: 6 }, legacyTileCode: 111 }]
    );

    for (let seed = 1; seed < 200; seed += 1) {
      const hero = createHero({
        stats: createStats({ agility: 0, luck: 9 }),
        inventorySlots: { 1: 5, 9: 5, 16: 1 },
        lightUses: DEFAULT_LIGHT_USES
      });
      const game = createGame(hero, level, seed);

      game.step({ type: 'reveal' });
      game.step({ type: 'wait' });
      game.step({ type: 'wait' });

      expect(game.snapshot().hero.inventorySlots[1]).toBe(5);
      expect(game.snapshot().hero.inventorySlots[9]).toBe(5);
    }
  });

  it('wakes a dormant monster when the hero walks into it', () => {
    const hero = createHero({ facing: 'N' });
    const level = createLevel(
      { x: 7, y: 7 },
      [],
      [{ id: 'lurker', position: { x: 7, y: 6 }, legacyTileCode: 111 }]
    );
    const game = createGame(hero, level, 11);

    expect(game.snapshot().activeMonster).toBeNull();

    const result = game.step({ type: 'moveForward' });
    const snapshot = game.snapshot();

    expect(snapshot.hero.position).toEqual({ x: 7, y: 7 });
    expect(result.messages[0]).toBe('A MONSTER BLOCKS THE WAY');
    expect(snapshot.activeMonster?.id).toBe('lurker');
    expect(snapshot.messages).toContain('HIT THEE!!');
  });

  it('uses restoratives and restores baseline stats', () => {
    const hero = createHero({
      stats: createStats({ strength: 6, vitality: 7 }),
      baseStats: createStats({ strength: 10, vitality: 10 }),
      inventorySlots: { 23: 1, 24: 1 }
    });
    const game = createGame(hero, createLevel(), 3);

    game.step({ type: 'useRestorative' });
    const snapshot = game.snapshot().hero;

    expect(snapshot.stats.strength).toBeGreaterThanOrEqual(10);
    expect(snapshot.stats.vitality).toBe(10);
    expect(snapshot.inventorySlots[23]).toBe(0);
    expect(snapshot.inventorySlots[24]).toBe(0);
  });

  it('gates spell sources and resolves representative spells', () => {
    const spellHero = createHero({
      inventorySlots: { 16: 1, 17: 4, 18: 3 },
      stats: createStats({ aura: 4 })
    });
    spellHero.spellCharges = computeSpellChargesFromInventory(spellHero);
    const level = createLevel(
      { x: 7, y: 7 },
      [],
      [{ id: 'guard', position: { x: 7, y: 6 }, legacyTileCode: 111 }]
    );
    const game = createGame(spellHero, level, 9);

    game.step({ type: 'reveal' });
    game.step({ type: 'castSpell', slot: 1 });
    expect(game.snapshot().activeMonster).toBeNull();

    game.step({ type: 'castSpell', slot: 2 });
    expect(game.snapshot().levelView.cells.find((cell) => cell.position.x === 7 && cell.position.y === 7)?.tile).toBe('safe');

    const healedBefore = game.snapshot().hero.stats.strength;
    game.step({ type: 'castSpell', slot: 4 });
    expect(game.snapshot().hero.stats.strength).toBeGreaterThanOrEqual(healedBefore);

    game.step({ type: 'castSpell', slot: 6 });
    expect(game.snapshot().hero.stats.strength).toBe(game.snapshot().hero.baseStats.strength);
  });

  it('serializes and restores modern runs faithfully', () => {
    const hero = prepareHeroForFreshRun(structuredClone(warriorStarter), createLevel());
    const game = createGame(hero, createLevel({ x: 7, y: 7 }, [{ x: 7, y: 6, kind: 'trap' }]), 12);

    game.step({ type: 'moveForward' });
    game.step({ type: 'wait' });
    const restored = Game.fromSerializedRun(game.serializeRun());

    expect(restored.snapshot()).toEqual(game.snapshot());
  });

  it('gates exits at the next whole experience value', () => {
    const hero = createHero({ stats: createStats({ experience: 1.35 }) });
    const level = createLevel(
      { x: 7, y: 7 },
      [{ x: 7, y: 6, kind: 'exit' }]
    );
    const game = createGame(hero, level);

    expect(game.snapshot().exitExperienceTarget).toBe(2);
    game.step({ type: 'moveForward' });
    expect(game.snapshot().runStatus).toBe('playing');
    expect(game.snapshot().messages.at(-1)).toBe('YOU NEED EXPERIENCE');
    expect(nextWholeExperienceTarget(2)).toBe(3);
  });

  it('prepares a next-stage hero without replenishing depleted resources', () => {
    const hero = createHero({
      stats: createStats({ strength: 4, vitality: 6, experience: 2.2 }),
      inventorySlots: { 16: 1, 17: 2 },
      lightUses: 3,
      spellCharges: { 1: 1, 2: 0, 3: 2, 4: 0, 5: 0, 6: 0 },
      status: { trapped: true, won: false, dead: false, escaped: true }
    });
    const level = createLevel({ x: 2, y: 3 });
    const prepared = prepareHeroForNextStage(hero, level);

    expect(prepared.position).toEqual({ x: 2, y: 3 });
    expect(prepared.facing).toBe('N');
    expect(prepared.stats).toEqual(hero.stats);
    expect(prepared.lightUses).toBe(3);
    expect(prepared.spellCharges).toEqual(hero.spellCharges);
    expect(prepared.status).toEqual(createHeroStatus());
  });
});
