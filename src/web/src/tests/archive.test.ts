import { describe, expect, test } from 'vitest';

import { Game } from '../engine/game';
import {
  convertLegacySnapshotToRun,
  inspectLegacyHero,
  inspectLegacyLevel,
  inspectLegacySnapshotPair,
  normalizeLegacyPayload,
  roundTripLegacyHero,
  roundTripLegacyLevel
} from '../persist/archive';
import { ARCHIVE_EXAMPLES, archiveExampleById } from '../persist/archiveExamples';
import { parseHeroString, parseLevelString } from '../persist/legacy';

describe('archive diagnostics', () => {
  test('reports hero byte structure and round-trips valid HERO payloads', () => {
    const example = archiveExampleById('starter-hero');

    expect(example).not.toBeNull();

    const report = inspectLegacyHero(example!.heroPayload);

    expect(report.kind).toBe('hero');
    expect(report.byteLength).toBeGreaterThan(35);
    expect(report.summary.join('\n')).toContain('Inventory slot count: 24');
    expect(report.summary.join('\n')).toContain('Display label:');
    expect(report.summary.join('\n')).toContain('Magic sources:');
    expect(report.diagnostics.some((entry) => entry.message.includes('Treasure'))).toBe(true);

    const roundTrip = roundTripLegacyHero(example!.heroPayload);

    expect(roundTrip.roundTripText).toBe(example!.heroPayload);
    expect(parseHeroString(roundTrip.roundTripText!).displayLabel).toBe('Rogan -warrior');
  });

  test('reports level geometry, record chunking, monsters, and round-trips LEVEL payloads', () => {
    const example = archiveExampleById('record-chunked-level');

    expect(example).not.toBeNull();

    const report = inspectLegacyLevel(example!.levelPayload);

    expect(report.kind).toBe('level');
    expect(report.byteLength).toBe(228);
    expect(report.recordChunks).toEqual([76, 76, 76]);
    expect(report.summary.join('\n')).toContain('Level id:');
    expect(report.summary.join('\n')).toContain('Metadata coordinates:');

    const monsterReport = inspectLegacyLevel(archiveExampleById('monster-level')!.levelPayload);

    expect(monsterReport.summary.join('\n')).toContain('tier I 1');
    expect(monsterReport.summary.join('\n')).toContain('tier II 1');

    const roundTrip = roundTripLegacyLevel(example!.levelPayload);

    expect(roundTrip.roundTripText).toBe(normalizeLegacyPayload(example!.levelPayload));
    expect(parseLevelString(roundTrip.roundTripText!).startPosition).toEqual({ x: 0, y: 0 });
  });

  test('malformed payloads become structured report errors', () => {
    const heroReport = inspectLegacyHero('bad');
    const levelReport = inspectLegacyLevel('bad');

    expect(heroReport.diagnostics.some((entry) => entry.severity === 'error')).toBe(true);
    expect(levelReport.diagnostics.some((entry) => entry.severity === 'error')).toBe(true);
  });

  test('inspects and converts generated mid-game snapshot pairs into modern runs', () => {
    const example = archiveExampleById('snapshot-pair');

    expect(example).not.toBeNull();

    const report = inspectLegacySnapshotPair({
      heroPayload: example!.heroPayload,
      levelPayload: example!.levelPayload
    });

    expect(report.currentPosition).toEqual({ x: 7, y: 6 });
    expect(report.diagnostics.some((entry) => entry.message.includes('lossy'))).toBe(true);

    const conversion = convertLegacySnapshotToRun(
      {
        heroPayload: example!.heroPayload,
        levelPayload: example!.levelPayload
      },
      1984
    );
    const game = Game.fromSerializedRun(conversion.run);
    const snapshot = game.snapshot();

    expect(snapshot.hero.position).toEqual({ x: 7, y: 6 });
    expect(snapshot.runStatus).toBe('playing');
    expect(conversion.run.level.startPosition).toEqual({ x: 7, y: 7 });
    expect(conversion.run.exploredKeys).toContain('7,6');
  });

  test('bundled archive examples are generated and parseable where populated', () => {
    for (const example of ARCHIVE_EXAMPLES) {
      if (example.heroPayload) {
        expect(parseHeroString(example.heroPayload).displayLabel.length).toBeGreaterThan(0);
      }

      if (example.levelPayload) {
        expect(parseLevelString(example.levelPayload).cells).toHaveLength(225);
      }
    }
  });
});
