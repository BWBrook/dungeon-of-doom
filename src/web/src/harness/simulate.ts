import { Adventure } from '../adventure/model';
import type { AdventureDefinition, AdventureStatus } from '../adventure/model';
import { LEGACY_CODES, MESSAGE_TEXT, RELIC_SLOT, monsterHpFromLegacyCode } from '../engine/catalog';
import type { ClassId, HeroState, LevelDefinition } from '../engine/types';
import { chooseAction, fogView, omniscientView, withVerseKnowledge } from './policy';
import type { PolicyStyle, RelicIntent, VerseKnowledge } from './policy';

export type RunOutcome = 'won' | 'dead' | 'blocked' | 'stalled';

export type Vision = 'omniscient' | 'fog';

export const VISIONS: Vision[] = ['omniscient', 'fog'];

export interface StageRecord {
  stageIndex: number;
  turns: number;
  monstersSlain: number;
  gearBroken: number;
  restorativesUsed: number;
  spellsCast: number;
  lightUsed: number;
  wallBumps: number;
  relicTaken: boolean;
  relicSpent: boolean;
  strengthAtEnd: number;
  experienceAtEnd: number;
}

export interface RunRecord {
  classId: ClassId;
  heroName: string;
  style: PolicyStyle;
  vision: Vision;
  relicIntent: RelicIntent;
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
  style?: PolicyStyle;
  vision?: Vision;
  relicIntent?: RelicIntent;
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
  const style = options.style ?? 'careful';
  const vision = options.vision ?? 'omniscient';
  const relicIntent = options.relicIntent ?? 'heed';
  const stageCount = definition.stages.length;
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
    const lightFloor = Math.floor(
      (startRun.hero.lightUses * (stageCount - stageIndex - 1)) / (stageCount - stageIndex)
    );
    const stage = definition.stages[stageIndex]!;
    const knowledge = stage.verse ? verseKnowledge(stage.level) : null;
    let spellsCast = 0;
    let wallBumps = 0;
    let relicSpent = false;
    let turns = 0;
    let status: AdventureStatus = 'playing';

    while (status === 'playing' && turns < maxTurns) {
      const fog = vision === 'fog' ? fogView(adventure.snapshot().currentRun) : null;
      const view = fog
        ? knowledge
          ? withVerseKnowledge(fog, knowledge)
          : fog
        : omniscientView(adventure.serialize().currentRun);
      const action = chooseAction({ view, isFinalStage, style, lightFloor, relicIntent, explorerSeed: seed });

      if (action.type === 'castSpell') {
        spellsCast += 1;
      }

      const result = adventure.step(action);

      wallBumps += result.sounds.includes('bump') ? 1 : 0;
      relicSpent ||= result.messages.includes(MESSAGE_TEXT.relicSaves);
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
      lightUsed: startRun.hero.lightUses - endRun.hero.lightUses,
      wallBumps,
      relicTaken:
        (startRun.hero.inventorySlots[RELIC_SLOT] ?? 0) === 0 &&
        ((endRun.hero.inventorySlots[RELIC_SLOT] ?? 0) > 0 || relicSpent),
      relicSpent,
      strengthAtEnd: endRun.hero.stats.strength,
      experienceAtEnd: endRun.hero.stats.experience
    });

    if (status === 'playing') {
      outcome = 'stalled';
    } else if (status === 'won') {
      outcome = 'won';
    } else if (status === 'dead') {
      outcome = 'dead';
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
    style,
    vision,
    relicIntent,
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
  style: PolicyStyle;
  vision: Vision;
  relicIntent: RelicIntent;
  runs: number;
  outcomes: Record<RunOutcome, number>;
  winRate: number;
  deathsByStage: number[];
  deathRateByStage: number[];
  meanRestorativesByStage: number[];
  meanTurns: number;
  meanGearBroken: number;
  meanRestorativesUsed: number;
  meanLightUsed: number;
  meanWallBumps: number;
  relicTakenRate: number;
  relicSpentRate: number;
  meanFinalStrength: number;
  meanStagesCleared: number;
}

export function summarizeRuns(records: RunRecord[], stageCount: number): ClassSummary[] {
  const groups = new Map<string, RunRecord[]>();

  for (const record of records) {
    const groupKey = `${record.vision}|${record.relicIntent}|${record.style}|${record.classId}`;

    groups.set(groupKey, [...(groups.get(groupKey) ?? []), record]);
  }

  return Array.from(groups.values()).map((runs) => {
    const { classId, style, vision, relicIntent } = runs[0]!;
    const outcomes: Record<RunOutcome, number> = { won: 0, dead: 0, blocked: 0, stalled: 0 };
    const deathsByStage = Array.from({ length: stageCount }, () => 0);
    const enteredByStage = Array.from({ length: stageCount }, () => 0);
    const restorativesByStage = Array.from({ length: stageCount }, (): number[] => []);

    for (const run of runs) {
      outcomes[run.outcome] += 1;

      for (const stage of run.stages) {
        enteredByStage[stage.stageIndex]! += 1;
        restorativesByStage[stage.stageIndex]!.push(stage.restorativesUsed);
      }

      if (run.outcome === 'dead') {
        deathsByStage[run.stages.length - 1]! += 1;
      }
    }

    return {
      classId,
      style,
      vision,
      relicIntent,
      runs: runs.length,
      outcomes,
      winRate: outcomes.won / runs.length,
      deathsByStage,
      deathRateByStage: deathsByStage.map((deaths, index) =>
        enteredByStage[index]! > 0 ? deaths / enteredByStage[index]! : 0
      ),
      meanRestorativesByStage: restorativesByStage.map(mean),
      meanTurns: mean(runs.map((run) => run.turns)),
      meanGearBroken: mean(runs.map((run) => run.gearBroken)),
      meanRestorativesUsed: mean(runs.map((run) => run.restorativesUsed)),
      meanLightUsed: mean(runs.map((run) => run.stages.reduce((total, stage) => total + stage.lightUsed, 0))),
      meanWallBumps: mean(runs.map((run) => run.stages.reduce((total, stage) => total + stage.wallBumps, 0))),
      relicTakenRate: mean(runs.map((run) => (run.stages.some((stage) => stage.relicTaken) ? 1 : 0))),
      relicSpentRate: mean(runs.map((run) => (run.stages.some((stage) => stage.relicSpent) ? 1 : 0))),
      meanFinalStrength: mean(runs.map((run) => run.finalStrength)),
      meanStagesCleared: mean(runs.map((run) => run.stagesCleared))
    };
  });
}

export function formatSummaryTable(summaries: ClassSummary[], stageCount: number): string {
  const stageIndexes = Array.from({ length: stageCount }, (_, index) => index);
  const header = [
    'Class',
    'Vision',
    'Relic',
    'Style',
    'Runs',
    'Win %',
    ...stageIndexes.map((index) => `Death % L${index + 1}`),
    'Stuck',
    'Actions',
    'Restoratives',
    'Light',
    'Bumps',
    'Relic taken %',
    'Saved %',
    'Gear broken'
  ];
  const rows = summaries.map((summary) => [
    summary.classId,
    summary.vision,
    summary.relicIntent,
    summary.style,
    String(summary.runs),
    (summary.winRate * 100).toFixed(0),
    ...summary.deathRateByStage.map((rate) => (rate * 100).toFixed(0)),
    String(summary.outcomes.blocked + summary.outcomes.stalled),
    summary.meanTurns.toFixed(0),
    summary.meanRestorativesUsed.toFixed(1),
    summary.meanLightUsed.toFixed(1),
    summary.meanWallBumps.toFixed(1),
    (summary.relicTakenRate * 100).toFixed(0),
    (summary.relicSpentRate * 100).toFixed(0),
    summary.meanGearBroken.toFixed(2)
  ]);

  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n');
}

function verseKnowledge(level: LevelDefinition): VerseKnowledge {
  const relicIndex = level.cells.findIndex((cell) => cell.kind === 'relic');

  return {
    relic: relicIndex < 0 ? null : { x: relicIndex % level.width, y: Math.floor(relicIndex / level.width) },
    wardens: level.monsterSpawns
      .filter((spawn) => spawn.legacyTileCode >= LEGACY_CODES.warden)
      .map((spawn) => ({
        id: spawn.id,
        position: { ...spawn.position },
        hp: monsterHpFromLegacyCode(spawn.legacyTileCode),
        legacyTileCode: spawn.legacyTileCode
      }))
  };
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
