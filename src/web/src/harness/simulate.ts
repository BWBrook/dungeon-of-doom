import { Adventure } from '../adventure/model';
import type { AdventureDefinition, AdventureStatus } from '../adventure/model';
import type { ClassId, HeroState } from '../engine/types';
import { chooseAction } from './policy';

export type RunOutcome = 'won' | 'dead' | 'abandoned' | 'blocked' | 'stalled';

export interface StageRecord {
  stageIndex: number;
  turns: number;
  monstersSlain: number;
  gearBroken: number;
  restorativesUsed: number;
  spellsCast: number;
  strengthAtEnd: number;
  experienceAtEnd: number;
}

export interface RunRecord {
  classId: ClassId;
  heroName: string;
  seed: number;
  outcome: RunOutcome;
  stagesCleared: number;
  turns: number;
  stages: StageRecord[];
  finalStrength: number;
  finalExperience: number;
  gearBroken: number;
  restorativesUsed: number;
  score: number | null;
}

export interface SimulationOptions {
  maxTurnsPerStage?: number;
}

const GEAR_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const DEFAULT_MAX_TURNS = 600;

export function simulateAdventure(
  hero: HeroState,
  definition: AdventureDefinition,
  seed: number,
  options: SimulationOptions = {}
): RunRecord {
  const maxTurns = options.maxTurnsPerStage ?? DEFAULT_MAX_TURNS;
  const adventure = new Adventure({ hero, definition, seed });
  const stages: StageRecord[] = [];
  let outcome: RunOutcome | null = null;

  while (outcome === null) {
    const stageIndex = adventure.snapshot().stageIndex;
    const isFinalStage = stageIndex === definition.stages.length - 1;
    const startRun = adventure.serialize().currentRun;
    const startGear = countGear(startRun.hero.inventorySlots);
    const startRestoratives = countRestoratives(startRun.hero.inventorySlots);
    const startMonsters = startRun.monsters.filter((monster) => monster.state !== 'dead').length;
    let spellsCast = 0;
    let turns = 0;
    let status: AdventureStatus = 'playing';

    while (status === 'playing' && turns < maxTurns) {
      const run = adventure.serialize().currentRun;
      const action = chooseAction({ run, isFinalStage });

      if (action.type === 'castSpell') {
        spellsCast += 1;
      }

      adventure.step(action);
      turns += 1;
      status = adventure.snapshot().status;
    }

    const endRun = adventure.serialize().currentRun;
    const bought = countRestoratives(endRun.hero.inventorySlots);

    stages.push({
      stageIndex,
      turns,
      monstersSlain: startMonsters - endRun.monsters.filter((monster) => monster.state !== 'dead').length,
      gearBroken: Math.max(0, startGear - countGear(endRun.hero.inventorySlots)),
      restorativesUsed: Math.max(0, startRestoratives + vasesTaken(startRun, endRun) * 2 - bought),
      spellsCast,
      strengthAtEnd: endRun.hero.stats.strength,
      experienceAtEnd: endRun.hero.stats.experience
    });

    if (status === 'playing') {
      outcome = 'stalled';
    } else if (status === 'won') {
      outcome = 'won';
    } else if (status === 'dead') {
      outcome = 'dead';
    } else if (status === 'abandoned') {
      outcome = 'abandoned';
    } else {
      try {
        adventure.continueToNextLevel();
      } catch {
        outcome = 'blocked';
      }
    }
  }

  const finalRun = adventure.serialize().currentRun;

  return {
    classId: hero.classId,
    heroName: hero.name,
    seed,
    outcome,
    stagesCleared: adventure.snapshot().completedStages.length,
    turns: stages.reduce((total, stage) => total + stage.turns, 0),
    stages,
    finalStrength: finalRun.hero.stats.strength,
    finalExperience: finalRun.hero.stats.experience,
    gearBroken: stages.reduce((total, stage) => total + stage.gearBroken, 0),
    restorativesUsed: stages.reduce((total, stage) => total + stage.restorativesUsed, 0),
    score: finalRun.score
  };
}

export interface ClassSummary {
  classId: ClassId;
  runs: number;
  outcomes: Record<RunOutcome, number>;
  winRate: number;
  deathsByStage: number[];
  meanTurns: number;
  meanGearBroken: number;
  meanRestorativesUsed: number;
  meanFinalStrength: number;
  meanStagesCleared: number;
}

export function summarizeRuns(records: RunRecord[], stageCount: number): ClassSummary[] {
  const byClass = new Map<ClassId, RunRecord[]>();

  for (const record of records) {
    byClass.set(record.classId, [...(byClass.get(record.classId) ?? []), record]);
  }

  return Array.from(byClass.entries()).map(([classId, runs]) => {
    const outcomes: Record<RunOutcome, number> = { won: 0, dead: 0, abandoned: 0, blocked: 0, stalled: 0 };
    const deathsByStage = Array.from({ length: stageCount }, () => 0);

    for (const run of runs) {
      outcomes[run.outcome] += 1;

      if (run.outcome === 'dead') {
        deathsByStage[run.stages.length - 1]! += 1;
      }
    }

    return {
      classId,
      runs: runs.length,
      outcomes,
      winRate: outcomes.won / runs.length,
      deathsByStage,
      meanTurns: mean(runs.map((run) => run.turns)),
      meanGearBroken: mean(runs.map((run) => run.gearBroken)),
      meanRestorativesUsed: mean(runs.map((run) => run.restorativesUsed)),
      meanFinalStrength: mean(runs.map((run) => run.finalStrength)),
      meanStagesCleared: mean(runs.map((run) => run.stagesCleared))
    };
  });
}

export function formatSummaryTable(summaries: ClassSummary[], stageCount: number): string {
  const deathHeaders = Array.from({ length: stageCount }, (_, index) => `Died L${index + 1}`);
  const header = [
    'Class',
    'Runs',
    'Win %',
    ...deathHeaders,
    'Abandoned',
    'Blocked',
    'Stalled',
    'Mean turns',
    'Gear broken',
    'Restoratives',
    'Final STR'
  ];
  const rows = summaries.map((summary) => [
    summary.classId,
    String(summary.runs),
    (summary.winRate * 100).toFixed(0),
    ...summary.deathsByStage.map(String),
    String(summary.outcomes.abandoned),
    String(summary.outcomes.blocked),
    String(summary.outcomes.stalled),
    summary.meanTurns.toFixed(0),
    summary.meanGearBroken.toFixed(2),
    summary.meanRestorativesUsed.toFixed(2),
    summary.meanFinalStrength.toFixed(1)
  ]);

  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n');
}

function countGear(slots: Record<number, number>): number {
  return GEAR_SLOTS.filter((slot) => (slots[slot] ?? 0) > 0).length;
}

function countRestoratives(slots: Record<number, number>): number {
  return (slots[23] ?? 0) + (slots[24] ?? 0);
}

function vasesTaken(start: { level: { cells: Array<{ kind: string }> } }, end: { level: { cells: Array<{ kind: string }> } }): number {
  const before = start.level.cells.filter((cell) => cell.kind === 'vase').length;
  const after = end.level.cells.filter((cell) => cell.kind === 'vase').length;

  return before - after;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}
