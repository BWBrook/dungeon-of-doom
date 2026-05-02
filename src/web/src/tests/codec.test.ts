import { describe, expect, it } from 'vitest';

import { tileKindToLegacyCode } from '../engine/catalog';
import { clericStarter } from '../engine/fixtures';
import { formatHeroString, formatLevelString, parseHeroString, parseLevelString } from '../persist/legacy';
import type { BaseTileKind, LevelDefinition, LevelCell } from '../engine/types';

function createCell(kind: BaseTileKind): LevelCell {
  return {
    kind,
    legacyCode: tileKindToLegacyCode(kind)
  };
}

function createArchivalLevelFixture(): LevelDefinition {
  const cells = Array.from({ length: 225 }, () => createCell('floor'));

  cells[0] = createCell('entrance');
  cells[1] = createCell('exit');
  cells[16] = createCell('wall');
  cells[17] = createCell('vase');

  return {
    id: 2,
    width: 15,
    height: 15,
    cells,
    startPosition: { x: 0, y: 0 },
    authoredEntrancePosition: { x: 0, y: 0 },
    monsterSpawns: [
      {
        id: 'monster-1',
        position: { x: 2, y: 2 },
        legacyTileCode: 111
      }
    ]
  };
}

describe('legacy codecs', () => {
  it('round-trips hero payloads and keeps treasure separate from display label', () => {
    const heroString = formatHeroString(clericStarter);
    const parsed = parseHeroString(heroString);

    expect(parsed.treasure).toBe(clericStarter.treasure);
    expect(parsed.displayLabel).toBe(clericStarter.displayLabel);
    expect(parsed.displayLabel.startsWith('A')).toBe(false);
    expect(formatHeroString(parsed)).toBe(heroString);
  });

  it('round-trips authored levels and preserves start coordinates', () => {
    const level = createArchivalLevelFixture();
    const levelString = formatLevelString(level);
    const parsed = parseLevelString(levelString);

    expect(parsed.id).toBe(level.id);
    expect(parsed.startPosition).toEqual(level.startPosition);
    expect(parsed.authoredEntrancePosition).toEqual(level.authoredEntrancePosition);
    expect(parsed.monsterSpawns).toHaveLength(1);
    expect(formatLevelString(parsed)).toBe(levelString);
  });
});
