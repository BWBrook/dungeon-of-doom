import { describe, expect, it } from 'vitest';

import { LEGACY_CODES, tileKindToLegacyCode } from '../engine/catalog';
import type { BaseTileKind } from '../engine/types';
import {
  createDefaultEditorDraft,
  editorDraftFromLevel,
  levelFromEditorDraft,
  paintEditorCell,
  validateEditorDraft
} from '../editor/model';
import type { EditorDraft } from '../editor/model';
import { formatLevelString, parseLevelString } from '../persist/legacy';
import { formatLevelDocument } from '../persist/levelDocument';

const BASE_TILES: BaseTileKind[] = [
  'floor',
  'wall',
  'vase',
  'chest',
  'idol',
  'entrance',
  'exit',
  'trap',
  'safe'
];

function withIdolAndMonster(draft: EditorDraft): EditorDraft {
  let nextDraft = paintEditorCell(draft, { x: 6, y: 6 }, 'idol');

  nextDraft = paintEditorCell(nextDraft, { x: 5, y: 5 }, 'monster1');

  return nextDraft;
}

describe('dungeon editor model', () => {
  it('creates a default draft that validates and converts to a playable level', () => {
    const draft = createDefaultEditorDraft();
    const validation = validateEditorDraft(draft);
    const level = levelFromEditorDraft(draft);

    expect(validation.canPlay).toBe(true);
    expect(validation.canExportLegacy).toBe(true);
    expect(level.width).toBe(15);
    expect(level.height).toBe(15);
    expect(level.cells).toHaveLength(225);
    expect(level.startPosition).toEqual({ x: 7, y: 7 });
  });

  it('paints every base tile and emits matching legacy cell codes', () => {
    for (const tile of BASE_TILES) {
      const draft = paintEditorCell(createDefaultEditorDraft(), { x: 2, y: 2 }, tile);
      const level = levelFromEditorDraft(draft);
      const cell = level.cells[2 + 2 * 15];

      expect(cell?.kind).toBe(tile);
      expect(cell?.legacyCode).toBe(tileKindToLegacyCode(tile));
    }
  });

  it('creates floor-backed monster spawns and clears them when repainting a base tile', () => {
    const withMonster = paintEditorCell(createDefaultEditorDraft(), { x: 3, y: 4 }, 'monster2');
    const monsterLevel = levelFromEditorDraft(withMonster);

    expect(monsterLevel.cells[3 + 4 * 15]?.kind).toBe('floor');
    expect(monsterLevel.monsterSpawns).toEqual([
      {
        id: 'monster-editor-1',
        position: { x: 3, y: 4 },
        legacyTileCode: LEGACY_CODES.monster2
      }
    ]);

    const cleared = paintEditorCell(withMonster, { x: 3, y: 4 }, 'wall');
    const clearedLevel = levelFromEditorDraft(cleared);

    expect(clearedLevel.cells[3 + 4 * 15]?.kind).toBe('wall');
    expect(clearedLevel.monsterSpawns).toHaveLength(0);
  });

  it('keeps entrance and exit as singleton markers', () => {
    let draft = paintEditorCell(createDefaultEditorDraft(), { x: 2, y: 2 }, 'entrance');

    draft = paintEditorCell(draft, { x: 3, y: 3 }, 'exit');

    expect(draft.cells.filter((cell) => cell.kind === 'entrance')).toHaveLength(1);
    expect(draft.cells.filter((cell) => cell.kind === 'exit')).toHaveLength(1);
    expect(draft.cells[7 + 7 * 15]?.kind).toBe('floor');
    expect(draft.cells[13 + 13 * 15]?.kind).toBe('floor');
    expect(draft.authoredEntrancePosition).toEqual({ x: 2, y: 2 });
  });

  it('blocks play when the start is on a wall or overlaps a monster', () => {
    const wallStart = paintEditorCell(
      paintEditorCell(createDefaultEditorDraft(), { x: 0, y: 0 }, 'start'),
      { x: 6, y: 6 },
      'idol'
    );

    expect(validateEditorDraft(wallStart).canPlay).toBe(false);
    expect(validateEditorDraft(wallStart).errors).toContain(
      'Start must be on floor, entrance, or safe tile.'
    );

    const monsterStart = paintEditorCell(createDefaultEditorDraft(), { x: 7, y: 7 }, 'monster1');

    expect(validateEditorDraft(monsterStart).canPlay).toBe(false);
    expect(validateEditorDraft(monsterStart).errors).toContain('Start cannot overlap a monster.');
  });

  it('blocks legacy export for level ids outside the lossless range', () => {
    const draft = withIdolAndMonster({
      ...createDefaultEditorDraft(),
      id: 160
    });
    const validation = validateEditorDraft(draft);

    expect(validation.canPlay).toBe(true);
    expect(validation.canExportLegacy).toBe(false);
    expect(validation.warnings).toContain(
      'Level id must be an integer from 0 to 159 for lossless legacy export.'
    );
  });

  it('round-trips modern level documents and legacy level exports', () => {
    const draft = withIdolAndMonster(createDefaultEditorDraft());
    const level = levelFromEditorDraft(draft);
    const document = JSON.parse(formatLevelDocument(level)) as {
      kind: string;
      version: number;
      level: typeof level;
    };
    const legacyLevel = parseLevelString(formatLevelString(level));

    expect(document.kind).toBe('dungeon-of-doom.level');
    expect(document.version).toBe(1);
    expect(document.level).toEqual(level);
    expect(legacyLevel.startPosition).toEqual(level.startPosition);
    expect(legacyLevel.monsterSpawns[0]?.legacyTileCode).toBe(LEGACY_CODES.monster1);
  });

  it('converts levels into editable drafts without losing monsters', () => {
    const level = levelFromEditorDraft(withIdolAndMonster(createDefaultEditorDraft()));
    const draft = editorDraftFromLevel(level);

    expect(draft.cells[5 + 5 * 15]?.monsterLegacyCode).toBe(LEGACY_CODES.monster1);
    expect(levelFromEditorDraft(draft)).toEqual(level);
  });
});
