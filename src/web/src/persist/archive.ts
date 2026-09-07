import {
  GRID_SIZE,
  LEGACY_AS,
  LEGACY_CODES,
  LEVEL_PAYLOAD_LENGTH,
  clonePoint,
  createHeroStatus,
  isLegacyMonsterCode,
  pointKey
} from '../engine/catalog';
import { nextWholeExperienceTarget } from '../engine/game';
import type {
  BaseTileKind,
  HeroState,
  LevelDefinition,
  Point,
  SerializedRun
} from '../engine/types';
import {
  createLegacyRuntimeMonsters,
  formatHeroString,
  formatLevelString,
  parseHeroString,
  parseLevelString
} from './legacy';

export type LegacyDiagnosticSeverity = 'info' | 'warning' | 'error';

export interface LegacyDiagnostic {
  severity: LegacyDiagnosticSeverity;
  message: string;
}

export interface LegacyPayloadReport {
  kind: 'hero' | 'level' | 'snapshot';
  byteLength: number;
  recordChunks: number[];
  diagnostics: LegacyDiagnostic[];
  summary: string[];
  roundTripText?: string;
}

export type LegacyHeroReport = LegacyPayloadReport & { kind: 'hero' };
export type LegacyLevelReport = LegacyPayloadReport & { kind: 'level' };
export type LegacyRoundTripReport = LegacyHeroReport | LegacyLevelReport;

export interface LegacySnapshotInput {
  heroPayload: string;
  levelPayload: string;
}

export interface LegacySnapshotReport extends LegacyPayloadReport {
  kind: 'snapshot';
  heroReport: LegacyHeroReport;
  levelReport: LegacyLevelReport;
  currentPosition: Point | null;
}

export interface LegacySnapshotConversion {
  run: SerializedRun;
  diagnostics: LegacyDiagnostic[];
}

const LOSSY_SNAPSHOT_WARNINGS = [
  'Legacy snapshot conversion is lossy: modern RNG parity is not preserved.',
  'Legacy snapshot conversion is lossy: exact turn count and active monster id are not stored.',
  'Legacy snapshot conversion is lossy: fog history starts around the saved hero position.',
  'Legacy snapshot conversion is lossy: spell and light state use legacy load derivations.'
];

export function normalizeLegacyPayload(input: string): string {
  return input.replace(/[\r\n]+/g, '');
}

export function inspectLegacyHero(input: string): LegacyHeroReport {
  const normalized = normalizeLegacyPayload(input);
  const diagnostics = baseDiagnostics(input, normalized, 'HERO');
  const summary: string[] = [];

  try {
    const objectCount = normalized.length > 0 ? normalized.charCodeAt(0) - LEGACY_AS : 0;
    const hero = parseHeroString(input);
    const hasNecronomicon = (hero.inventorySlots[17] ?? 0) > 0;
    const hasScrolls = (hero.inventorySlots[18] ?? 0) > 0;

    summary.push(`Inventory slot count: ${objectCount}`);
    summary.push(`Stats: STR ${hero.stats.strength}, VIT ${hero.stats.vitality}, AGI ${hero.stats.agility}, INT ${hero.stats.intelligence}, EXP ${hero.stats.experience}, LUCK ${hero.stats.luck}, AUR ${hero.stats.aura}, MOR ${hero.stats.morality}`);
    summary.push(`Gold: ${hero.gold}; treasure byte: ${hero.treasure}`);
    summary.push(`Display label: ${hero.displayLabel}`);
    summary.push(`Name: ${hero.name}; class: ${hero.classId}`);
    summary.push(`Magic sources: ${hasNecronomicon ? 'Necronomicon' : 'no Necronomicon'}, ${hasScrolls ? 'Scrolls' : 'no Scrolls'}`);
    summary.push(`Light uses after legacy load: ${hero.lightUses}`);
    diagnostics.push({ severity: 'info', message: 'Treasure is interpreted from the byte after gold, not from label text.' });

    if (!hero.displayLabel.includes(' -')) {
      diagnostics.push({ severity: 'warning', message: 'Display label does not include the expected " -class" suffix; class was inferred from stats.' });
    }
  } catch (error) {
    diagnostics.push({ severity: 'error', message: errorMessage(error) });
  }

  return {
    kind: 'hero',
    byteLength: normalized.length,
    recordChunks: recordChunks(input, normalized),
    diagnostics,
    summary
  };
}

export function inspectLegacyLevel(input: string): LegacyLevelReport {
  const normalized = normalizeLegacyPayload(input);
  const diagnostics = baseDiagnostics(input, normalized, 'LEVEL');
  const summary: string[] = [];

  try {
    const level = parseLevelString(input);
    const tileCounts = countTiles(level);
    const monsterCounts = countMonsters(level);
    const entranceCount = tileCounts.entrance ?? 0;
    const exitCount = tileCounts.exit ?? 0;

    summary.push(`Level id: ${level.id}`);
    summary.push(`Metadata coordinates: x ${level.startPosition.x}, y ${level.startPosition.y} (0-based internal)`);
    summary.push(`Authored entrance: x ${level.authoredEntrancePosition.x}, y ${level.authoredEntrancePosition.y}`);
    summary.push(`Tiles: ${formatTileCounts(tileCounts)}`);
    summary.push(`Monsters: tier I ${monsterCounts.tier1}, tier II ${monsterCounts.tier2}, tier III ${monsterCounts.tier3}`);

    if (normalized.length > LEVEL_PAYLOAD_LENGTH) {
      diagnostics.push({ severity: 'warning', message: `Payload has ${normalized.length - LEVEL_PAYLOAD_LENGTH} trailing byte(s) beyond the canonical LEVEL payload.` });
    }

    if (entranceCount === 0) {
      diagnostics.push({ severity: 'warning', message: 'No entrance tile found; snapshot conversion will use the current position as fallback.' });
    }

    if (exitCount === 0) {
      diagnostics.push({ severity: 'warning', message: 'No exit tile found; authored level export may not be playable.' });
    }

    diagnostics.push({ severity: 'info', message: 'LEVEL metadata coordinates are 1-based in legacy data and converted to 0-based internally.' });
  } catch (error) {
    diagnostics.push({ severity: 'error', message: errorMessage(error) });
  }

  return {
    kind: 'level',
    byteLength: normalized.length,
    recordChunks: recordChunks(input, normalized),
    diagnostics,
    summary
  };
}

export function roundTripLegacyHero(input: string): LegacyRoundTripReport {
  const report = inspectLegacyHero(input);

  if (hasErrors(report)) {
    return report;
  }

  const roundTripText = formatHeroString(parseHeroString(input));
  const normalized = normalizeLegacyPayload(input);

  report.roundTripText = roundTripText;
  report.diagnostics.push({
    severity: roundTripText === normalized ? 'info' : 'warning',
    message: roundTripText === normalized ? 'Round-trip HERO matches normalized input.' : 'Round-trip HERO differs from normalized input.'
  });

  return report;
}

export function roundTripLegacyLevel(input: string): LegacyRoundTripReport {
  const report = inspectLegacyLevel(input);

  if (hasErrors(report)) {
    return report;
  }

  const roundTripText = formatLevelString(parseLevelString(input));
  const normalized = normalizeLegacyPayload(input);

  report.roundTripText = roundTripText;
  report.diagnostics.push({
    severity: roundTripText === normalized ? 'info' : 'warning',
    message: roundTripText === normalized ? 'Round-trip LEVEL matches normalized input.' : 'Round-trip LEVEL differs from normalized input.'
  });

  return report;
}

export function inspectLegacySnapshotPair(input: LegacySnapshotInput): LegacySnapshotReport {
  const heroReport = inspectLegacyHero(input.heroPayload);
  const levelReport = inspectLegacyLevel(input.levelPayload);
  const diagnostics: LegacyDiagnostic[] = [
    ...heroReport.diagnostics,
    ...levelReport.diagnostics,
    ...LOSSY_SNAPSHOT_WARNINGS.map((message) => ({ severity: 'warning' as const, message }))
  ];
  const summary: string[] = [];
  let currentPosition: Point | null = null;

  if (!hasErrors(heroReport) && !hasErrors(levelReport)) {
    const hero = parseHeroString(input.heroPayload);
    const level = parseLevelString(input.levelPayload);

    currentPosition = clonePoint(level.startPosition);
    summary.push(`Snapshot hero: ${hero.displayLabel}`);
    summary.push(`Current position from LEVEL metadata: x ${currentPosition.x}, y ${currentPosition.y}`);
    summary.push(`Level id: ${level.id}`);
    summary.push(`Runtime monsters rebuilt from tile codes: ${level.monsterSpawns.length}`);
  }

  return {
    kind: 'snapshot',
    byteLength: normalizeLegacyPayload(input.heroPayload).length + normalizeLegacyPayload(input.levelPayload).length,
    recordChunks: [
      ...recordChunks(input.heroPayload, normalizeLegacyPayload(input.heroPayload)),
      ...recordChunks(input.levelPayload, normalizeLegacyPayload(input.levelPayload))
    ],
    diagnostics,
    summary,
    heroReport,
    levelReport,
    currentPosition
  };
}

export function convertLegacySnapshotToRun(input: LegacySnapshotInput, seed: number): LegacySnapshotConversion {
  const report = inspectLegacySnapshotPair(input);

  if (hasErrors(report)) {
    throw new Error(firstError(report) ?? 'Legacy snapshot pair cannot be converted.');
  }

  const hero = parseHeroString(input.heroPayload);
  const parsedLevel = parseLevelString(input.levelPayload);
  const currentPosition = clonePoint(parsedLevel.startPosition);
  const entrancePosition = findEntrancePosition(parsedLevel) ?? currentPosition;
  const level: LevelDefinition = {
    ...structuredClone(parsedLevel),
    startPosition: clonePoint(entrancePosition),
    authoredEntrancePosition: clonePoint(entrancePosition)
  };
  const runtimeHero: HeroState = {
    ...structuredClone(hero),
    position: clonePoint(currentPosition),
    facing: 'N',
    status: createHeroStatus()
  };
  const visibleKeys = visibleKeysAround(currentPosition, level);
  const runSeed = seed >>> 0;

  return {
    run: {
      version: 2,
      seed: runSeed,
      rngState: runSeed,
      hero: runtimeHero,
      level,
      monsters: createLegacyRuntimeMonsters(level),
      exploredKeys: visibleKeys,
      visibleKeys,
      messages: ['Converted legacy snapshot. Save Run to persist as modern JSON.'],
      activeMonsterId: null,
      runStatus: 'playing',
      score: null,
      turnCount: 0,
      exitExperienceTarget: nextWholeExperienceTarget(runtimeHero.stats.experience)
    },
    diagnostics: report.diagnostics
  };
}

export function formatLegacyReport(report: LegacyPayloadReport): string {
  const title = `Legacy ${report.kind.toUpperCase()} Report`;
  const lines = [
    title,
    '='.repeat(title.length),
    `Byte length: ${report.byteLength}`,
    `Record chunks: ${report.recordChunks.join(', ') || 'none'}`,
    '',
    'Summary:',
    ...prefixLines(report.summary, '- '),
    '',
    'Diagnostics:',
    ...prefixLines(report.diagnostics.map((entry) => `${entry.severity.toUpperCase()}: ${entry.message}`), '- ')
  ];

  if (report.roundTripText) {
    lines.push('', `Round-trip payload length: ${report.roundTripText.length}`);
  }

  return lines.join('\n');
}

function baseDiagnostics(input: string, normalized: string, label: 'HERO' | 'LEVEL'): LegacyDiagnostic[] {
  const diagnostics: LegacyDiagnostic[] = [
    { severity: 'info', message: `${label} normalized byte length is ${normalized.length}.` }
  ];

  if (input !== normalized) {
    diagnostics.push({ severity: 'info', message: 'Record breaks were stripped before parsing.' });
  }

  if (normalized.length === 0) {
    diagnostics.push({ severity: 'error', message: `${label} payload is empty.` });
  }

  return diagnostics;
}

function recordChunks(input: string, normalized: string): number[] {
  const chunks = input.split(/\r?\n/g).filter((line) => line.length > 0).map((line) => line.length);

  return chunks.length > 0 ? chunks : normalized.length > 0 ? [normalized.length] : [];
}

function countTiles(level: LevelDefinition): Partial<Record<BaseTileKind, number>> {
  const counts: Partial<Record<BaseTileKind, number>> = {};

  for (const cell of level.cells) {
    counts[cell.kind] = (counts[cell.kind] ?? 0) + 1;
  }

  return counts;
}

function countMonsters(level: LevelDefinition) {
  return level.monsterSpawns.reduce(
    (counts, spawn) => {
      if (spawn.legacyTileCode === LEGACY_CODES.monster1) {
        counts.tier1 += 1;
      } else if (spawn.legacyTileCode === LEGACY_CODES.monster2) {
        counts.tier2 += 1;
      } else if (spawn.legacyTileCode === LEGACY_CODES.monster3 || isLegacyMonsterCode(spawn.legacyTileCode)) {
        counts.tier3 += 1;
      }

      return counts;
    },
    { tier1: 0, tier2: 0, tier3: 0 }
  );
}

function formatTileCounts(counts: Partial<Record<BaseTileKind, number>>): string {
  return Object.entries(counts)
    .map(([kind, count]) => `${kind} ${count}`)
    .join(', ');
}

function findEntrancePosition(level: LevelDefinition): Point | null {
  const index = level.cells.findIndex((cell) => cell.kind === 'entrance');

  if (index === -1) {
    return null;
  }

  return {
    x: index % level.width,
    y: Math.floor(index / level.width)
  };
}

function visibleKeysAround(position: Point, level: LevelDefinition): string[] {
  const keys: string[] = [];

  for (let y = position.y - 1; y <= position.y + 1; y += 1) {
    for (let x = position.x - 1; x <= position.x + 1; x += 1) {
      if (x >= 0 && y >= 0 && x < level.width && y < level.height && x < GRID_SIZE && y < GRID_SIZE) {
        keys.push(pointKey({ x, y }));
      }
    }
  }

  return keys;
}

function hasErrors(report: LegacyPayloadReport): boolean {
  return report.diagnostics.some((entry) => entry.severity === 'error');
}

function firstError(report: LegacyPayloadReport): string | null {
  return report.diagnostics.find((entry) => entry.severity === 'error')?.message ?? null;
}

function prefixLines(lines: string[], prefix: string): string[] {
  return lines.length > 0 ? lines.map((line) => `${prefix}${line}`) : [`${prefix}None`];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
