import { GRID_SIZE, LEGACY_CODES, tileKindToLegacyCode } from '../engine/catalog';
import type { BaseTileKind, LevelCell, LevelDefinition, MonsterSpawn, Point } from '../engine/types';

export type EditorTool = BaseTileKind | 'monster1' | 'monster2' | 'monster3' | 'start';

export interface EditorCell {
  kind: BaseTileKind;
  monsterLegacyCode: number | null;
}

export interface EditorDraft {
  id: number;
  width: number;
  height: number;
  cells: EditorCell[];
  startPosition: Point;
  authoredEntrancePosition: Point;
  selectedTool: EditorTool;
}

export interface EditorValidation {
  errors: string[];
  warnings: string[];
  canPlay: boolean;
  canExportLegacy: boolean;
}

const LEGACY_EXPORT_LEVEL_ID_MIN = 0;
const LEGACY_EXPORT_LEVEL_ID_MAX = 159;
const MONSTER_TOOL_CODES: Record<'monster1' | 'monster2' | 'monster3', number> = {
  monster1: LEGACY_CODES.monster1,
  monster2: LEGACY_CODES.monster2,
  monster3: LEGACY_CODES.monster3
};

export const EDITOR_TOOLS: Array<{ tool: EditorTool; label: string }> = [
  { tool: 'floor', label: 'Floor' },
  { tool: 'wall', label: 'Wall' },
  { tool: 'vase', label: 'Vase' },
  { tool: 'chest', label: 'Chest' },
  { tool: 'idol', label: 'Idol' },
  { tool: 'entrance', label: 'Entrance' },
  { tool: 'exit', label: 'Exit' },
  { tool: 'trap', label: 'Trap' },
  { tool: 'safe', label: 'Safe' },
  { tool: 'monster1', label: 'Monster I' },
  { tool: 'monster2', label: 'Monster II' },
  { tool: 'monster3', label: 'Monster III' },
  { tool: 'start', label: 'Start' }
];

export function createDefaultEditorDraft(): EditorDraft {
  const cells = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index): EditorCell => {
    const point = pointFromIndex(index, GRID_SIZE);
    const isPerimeter =
      point.x === 0 || point.y === 0 || point.x === GRID_SIZE - 1 || point.y === GRID_SIZE - 1;

    return {
      kind: isPerimeter ? 'wall' : 'floor',
      monsterLegacyCode: null
    };
  });
  const startPosition = { x: 7, y: 7 };

  cells[indexFromPoint(startPosition, GRID_SIZE)] = {
    kind: 'entrance',
    monsterLegacyCode: null
  };
  cells[indexFromPoint({ x: 13, y: 13 }, GRID_SIZE)] = {
    kind: 'exit',
    monsterLegacyCode: null
  };

  return {
    id: 7,
    width: GRID_SIZE,
    height: GRID_SIZE,
    cells,
    startPosition,
    authoredEntrancePosition: structuredClone(startPosition),
    selectedTool: 'floor'
  };
}

export function editorDraftFromLevel(level: LevelDefinition): EditorDraft {
  const cells = level.cells.map((cell): EditorCell => ({
    kind: cell.kind,
    monsterLegacyCode: null
  }));

  for (const monster of level.monsterSpawns) {
    if (!isPointInBounds(monster.position, level.width, level.height)) {
      continue;
    }

    cells[indexFromPoint(monster.position, level.width)] = {
      kind: 'floor',
      monsterLegacyCode: monster.legacyTileCode
    };
  }

  return {
    id: level.id,
    width: level.width,
    height: level.height,
    cells,
    startPosition: structuredClone(level.startPosition),
    authoredEntrancePosition: structuredClone(level.authoredEntrancePosition),
    selectedTool: 'floor'
  };
}

export function levelFromEditorDraft(draft: EditorDraft): LevelDefinition {
  const cells: LevelCell[] = draft.cells.map((cell) => ({
    kind: cell.kind,
    legacyCode: tileKindToLegacyCode(cell.kind)
  }));
  const monsterSpawns: MonsterSpawn[] = [];

  for (let index = 0; index < draft.cells.length; index += 1) {
    const cell = draft.cells[index];

    if (!cell?.monsterLegacyCode) {
      continue;
    }

    monsterSpawns.push({
      id: `monster-editor-${monsterSpawns.length + 1}`,
      position: pointFromIndex(index, draft.width),
      legacyTileCode: cell.monsterLegacyCode
    });
  }

  return {
    id: draft.id,
    width: draft.width,
    height: draft.height,
    cells,
    startPosition: structuredClone(draft.startPosition),
    authoredEntrancePosition: structuredClone(draft.authoredEntrancePosition),
    monsterSpawns
  };
}

export function validateEditorDraft(draft: EditorDraft): EditorValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let canExportLegacy = true;

  if (draft.width !== GRID_SIZE || draft.height !== GRID_SIZE || draft.cells.length !== GRID_SIZE * GRID_SIZE) {
    errors.push('Level must be a 15x15 grid with exactly 225 cells.');
    canExportLegacy = false;
  }

  if (
    !Number.isInteger(draft.id) ||
    draft.id < LEGACY_EXPORT_LEVEL_ID_MIN ||
    draft.id > LEGACY_EXPORT_LEVEL_ID_MAX
  ) {
    warnings.push('Level id must be an integer from 0 to 159 for lossless legacy export.');
    canExportLegacy = false;
  }

  const entranceCells = draft.cells.filter((cell) => cell.kind === 'entrance');
  const exitCells = draft.cells.filter((cell) => cell.kind === 'exit');

  if (entranceCells.length !== 1) {
    errors.push('Level must have exactly one entrance.');
  }

  if (exitCells.length !== 1) {
    errors.push('Level must have exactly one exit.');
  }

  if (!isPointInBounds(draft.startPosition, draft.width, draft.height)) {
    errors.push('Start position must be inside the 15x15 grid.');
  } else {
    const startCell = draft.cells[indexFromPoint(draft.startPosition, draft.width)];

    if (!startCell || !['floor', 'entrance', 'safe'].includes(startCell.kind)) {
      errors.push('Start must be on floor, entrance, or safe tile.');
    }

    if (startCell && startCell.monsterLegacyCode !== null) {
      errors.push('Start cannot overlap a monster.');
    }
  }

  let monsterCount = 0;
  let hasIdol = false;

  for (let index = 0; index < draft.cells.length; index += 1) {
    const cell = draft.cells[index];

    if (!cell) {
      continue;
    }

    if (cell.kind === 'idol') {
      hasIdol = true;
    }

    if (cell.monsterLegacyCode !== null) {
      monsterCount += 1;

      if (cell.kind !== 'floor') {
        errors.push('Monsters must be placed on floor cells.');
      }
    }
  }

  if (!hasIdol) {
    warnings.push('No idol is present; this level may not have a quest finish.');
  }

  if (monsterCount === 0) {
    warnings.push('No monsters are present.');
  }

  if (!hasSealedPerimeter(draft)) {
    warnings.push('Perimeter is not fully sealed with walls.');
  }

  return {
    errors,
    warnings,
    canPlay: errors.length === 0,
    canExportLegacy: errors.length === 0 && canExportLegacy
  };
}

export function paintEditorCell(draft: EditorDraft, point: Point, tool: EditorTool): EditorDraft {
  if (!isPointInBounds(point, draft.width, draft.height)) {
    return structuredClone(draft);
  }

  const nextDraft = structuredClone(draft);
  const targetIndex = indexFromPoint(point, nextDraft.width);
  const targetCell = nextDraft.cells[targetIndex];

  if (!targetCell) {
    return nextDraft;
  }

  nextDraft.selectedTool = tool;

  if (tool === 'start') {
    nextDraft.startPosition = structuredClone(point);
    return nextDraft;
  }

  if (isMonsterTool(tool)) {
    nextDraft.cells[targetIndex] = {
      kind: 'floor',
      monsterLegacyCode: MONSTER_TOOL_CODES[tool]
    };
    return nextDraft;
  }

  if (tool === 'entrance') {
    clearSingletonTile(nextDraft, 'entrance');
    nextDraft.authoredEntrancePosition = structuredClone(point);
  }

  if (tool === 'exit') {
    clearSingletonTile(nextDraft, 'exit');
  }

  nextDraft.cells[targetIndex] = {
    kind: tool,
    monsterLegacyCode: null
  };

  return nextDraft;
}

export function pointFromIndex(index: number, width: number): Point {
  return {
    x: index % width,
    y: Math.floor(index / width)
  };
}

export function indexFromPoint(point: Point, width: number): number {
  return point.y * width + point.x;
}

export function isPointInBounds(point: Point, width = GRID_SIZE, height = GRID_SIZE): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < width && point.y < height;
}

export function isMonsterTool(tool: EditorTool): tool is 'monster1' | 'monster2' | 'monster3' {
  return tool === 'monster1' || tool === 'monster2' || tool === 'monster3';
}

function clearSingletonTile(draft: EditorDraft, kind: 'entrance' | 'exit') {
  draft.cells = draft.cells.map((cell) =>
    cell.kind === kind
      ? {
          kind: 'floor',
          monsterLegacyCode: null
        }
      : cell
  );
}

function hasSealedPerimeter(draft: EditorDraft): boolean {
  if (draft.width !== GRID_SIZE || draft.height !== GRID_SIZE || draft.cells.length !== GRID_SIZE * GRID_SIZE) {
    return false;
  }

  for (let index = 0; index < draft.cells.length; index += 1) {
    const point = pointFromIndex(index, draft.width);
    const isPerimeter =
      point.x === 0 || point.y === 0 || point.x === draft.width - 1 || point.y === draft.height - 1;

    if (isPerimeter && draft.cells[index]?.kind !== 'wall') {
      return false;
    }
  }

  return true;
}
