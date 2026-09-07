import { GRID_SIZE } from '../engine/catalog';
import {
  Game,
  createGameInit,
  prepareHeroForFreshRun,
  prepareHeroForNextStage
} from '../engine/game';
import type {
  Action,
  HeroState,
  LevelDefinition,
  SerializedRun,
  Snapshot,
  StepResult
} from '../engine/types';

export interface AdventureStage {
  id: string;
  title: string;
  level: LevelDefinition;
}

export interface AdventureDefinition {
  id: string;
  title: string;
  description: string;
  stages: AdventureStage[];
}

export type AdventureStatus = 'playing' | 'betweenLevels' | 'won' | 'dead' | 'abandoned';

export interface CompletedStage {
  stageIndex: number;
  stageId: string;
  levelId: number;
  turns: number;
  experienceGained: number;
  goldGained: number;
  treasureGained: number;
}

export interface AdventureSnapshot {
  definitionId: string;
  title: string;
  stageIndex: number;
  stageCount: number;
  stageTitle: string;
  status: AdventureStatus;
  completedStages: CompletedStage[];
  cumulativeTurns: number;
  currentRun: Snapshot;
}

interface StageEntryMetrics {
  experience: number;
  gold: number;
  treasure: number;
}

export interface SerializedAdventure {
  version: 1;
  definitionId: string;
  rootSeed: number;
  stageIndex: number;
  status: AdventureStatus;
  completedStages: CompletedStage[];
  stageEntryMetrics: StageEntryMetrics;
  currentRun: SerializedRun;
}

export interface AdventureInit {
  hero: HeroState;
  definition: AdventureDefinition;
  seed: number;
}

export class Adventure {
  private definition: AdventureDefinition;
  private rootSeed: number;
  private stageIndex: number;
  private status: AdventureStatus;
  private completedStages: CompletedStage[];
  private stageEntryMetrics: StageEntryMetrics;
  private game: Game;

  constructor(init: AdventureInit) {
    assertValidAdventureDefinition(init.definition);

    this.definition = structuredClone(init.definition);
    this.rootSeed = init.seed >>> 0;
    this.stageIndex = 0;
    this.status = 'playing';
    this.completedStages = [];

    const firstStage = this.definition.stages[0]!;
    const hero = prepareHeroForFreshRun(init.hero, firstStage.level);

    this.stageEntryMetrics = metricsFromHero(hero);
    this.game = new Game(
      createGameInit(hero, firstStage.level, deriveStageSeed(this.rootSeed, this.stageIndex))
    );
  }

  static fromSerialized(
    serialized: SerializedAdventure,
    definition: AdventureDefinition
  ): Adventure {
    if (serialized.version !== 1) {
      throw new Error('Saved adventure uses an unsupported format.');
    }

    assertValidAdventureDefinition(definition);

    if (serialized.definitionId !== definition.id) {
      throw new Error('Saved adventure does not match the selected quest.');
    }

    if (
      !Number.isInteger(serialized.stageIndex) ||
      serialized.stageIndex < 0 ||
      serialized.stageIndex >= definition.stages.length
    ) {
      throw new Error('Saved adventure stage is invalid.');
    }

    const adventure = Object.create(Adventure.prototype) as Adventure;

    adventure.definition = structuredClone(definition);
    adventure.rootSeed = serialized.rootSeed >>> 0;
    adventure.stageIndex = serialized.stageIndex;
    adventure.status = serialized.status;
    adventure.completedStages = structuredClone(serialized.completedStages);
    adventure.stageEntryMetrics = structuredClone(serialized.stageEntryMetrics);
    adventure.game = Game.fromSerializedRun(serialized.currentRun);

    return adventure;
  }

  step(action: Action): StepResult {
    const result = this.game.step(action);

    if (this.status !== 'playing') {
      return result;
    }

    const runStatus = this.game.snapshot().runStatus;

    if (runStatus === 'won') {
      this.recordCompletedStage();
      this.status = 'won';
    } else if (runStatus === 'dead') {
      this.status = 'dead';
    } else if (runStatus === 'escaped') {
      if (this.stageIndex === this.definition.stages.length - 1) {
        this.status = 'abandoned';
      } else {
        this.recordCompletedStage();
        this.status = 'betweenLevels';
      }
    }

    return result;
  }

  continueToNextLevel(): void {
    if (this.status !== 'betweenLevels') {
      throw new Error('No completed level is waiting to continue.');
    }

    const nextStage = this.definition.stages[this.stageIndex + 1];

    if (!nextStage) {
      throw new Error('The adventure has no deeper level.');
    }

    const currentHero = this.game.serializeRun().hero;

    if (nextStage.level.id > currentHero.stats.experience) {
      throw new Error('LEVEL TOO DEEP');
    }

    this.stageIndex += 1;
    const hero = prepareHeroForNextStage(currentHero, nextStage.level);

    this.stageEntryMetrics = metricsFromHero(hero);
    this.game = new Game(
      createGameInit(hero, nextStage.level, deriveStageSeed(this.rootSeed, this.stageIndex))
    );
    this.status = 'playing';
  }

  snapshot(): AdventureSnapshot {
    const currentRun = this.game.snapshot();
    const priorTurns = this.completedStages
      .filter((stage) => stage.stageIndex < this.stageIndex)
      .reduce((total, stage) => total + stage.turns, 0);

    return {
      definitionId: this.definition.id,
      title: this.definition.title,
      stageIndex: this.stageIndex,
      stageCount: this.definition.stages.length,
      stageTitle: this.definition.stages[this.stageIndex]!.title,
      status: this.status,
      completedStages: structuredClone(this.completedStages),
      cumulativeTurns: priorTurns + currentRun.turnCount,
      currentRun
    };
  }

  serialize(): SerializedAdventure {
    return {
      version: 1,
      definitionId: this.definition.id,
      rootSeed: this.rootSeed,
      stageIndex: this.stageIndex,
      status: this.status,
      completedStages: structuredClone(this.completedStages),
      stageEntryMetrics: structuredClone(this.stageEntryMetrics),
      currentRun: this.game.serializeRun()
    };
  }

  private recordCompletedStage() {
    if (this.completedStages.some((stage) => stage.stageIndex === this.stageIndex)) {
      return;
    }

    const stage = this.definition.stages[this.stageIndex]!;
    const run = this.game.serializeRun();

    this.completedStages.push({
      stageIndex: this.stageIndex,
      stageId: stage.id,
      levelId: stage.level.id,
      turns: run.turnCount,
      experienceGained: run.hero.stats.experience - this.stageEntryMetrics.experience,
      goldGained: run.hero.gold - this.stageEntryMetrics.gold,
      treasureGained: run.hero.treasure - this.stageEntryMetrics.treasure
    });
  }
}

export function deriveStageSeed(rootSeed: number, stageIndex: number): number {
  let value = (rootSeed + Math.imul(stageIndex + 1, 0x9e3779b9)) >>> 0;

  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;

  return (value >>> 0) || 0x6d2b79f5;
}

export function validateAdventureDefinition(definition: AdventureDefinition): string[] {
  const errors: string[] = [];
  const stageIds = new Set<string>();

  if (definition.stages.length === 0) {
    return ['Adventure must contain at least one level.'];
  }

  definition.stages.forEach((stage, index) => {
    const level = stage.level;
    const entranceCount = level.cells.filter((cell) => cell.kind === 'entrance').length;
    const exitCount = level.cells.filter((cell) => cell.kind === 'exit').length;
    const idolCount = level.cells.filter((cell) => cell.kind === 'idol').length;
    const isFinal = index === definition.stages.length - 1;

    if (stageIds.has(stage.id)) {
      errors.push(`Adventure stage id "${stage.id}" is duplicated.`);
    }
    stageIds.add(stage.id);

    if (
      level.width !== GRID_SIZE ||
      level.height !== GRID_SIZE ||
      level.cells.length !== GRID_SIZE * GRID_SIZE
    ) {
      errors.push(`${stage.title} must be a ${GRID_SIZE}x${GRID_SIZE} level.`);
    }
    if (level.id !== index + 1) {
      errors.push(`${stage.title} must use level id ${index + 1}.`);
    }
    if (entranceCount !== 1) {
      errors.push(`${stage.title} must contain exactly one entrance.`);
    }
    if (exitCount !== 1) {
      errors.push(`${stage.title} must contain exactly one exit.`);
    }
    if (!isFinal && idolCount !== 0) {
      errors.push(`${stage.title} cannot contain the quest Idol before the final level.`);
    }
    if (isFinal && idolCount !== 1) {
      errors.push(`${stage.title} must contain exactly one quest Idol.`);
    }
  });

  return errors;
}

function assertValidAdventureDefinition(definition: AdventureDefinition) {
  const errors = validateAdventureDefinition(definition);

  if (errors.length > 0) {
    throw new Error(`Invalid adventure: ${errors.join(' ')}`);
  }
}

function metricsFromHero(hero: HeroState): StageEntryMetrics {
  return {
    experience: hero.stats.experience,
    gold: hero.gold,
    treasure: hero.treasure
  };
}
