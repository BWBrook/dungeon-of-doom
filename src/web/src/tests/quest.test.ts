import { beforeEach, describe, expect, it } from 'vitest';

import { Adventure } from '../adventure/model';
import { lostIdolAdventure } from '../content/adventures';
import { warriorStarter } from '../engine/fixtures';
import { createDefaultEditorDraft, levelFromEditorDraft, paintEditorCell } from '../editor/model';
import {
  findLibraryQuest,
  formatQuestDocument,
  loadLevelLibrary,
  loadQuestLibrary,
  parseQuestDocument,
  removeLevelFromLibrary,
  saveLevelToLibrary,
  saveQuestToLibrary
} from '../persist/library';
import {
  addQuestStage,
  createQuestDraft,
  moveQuestStage,
  questDefinitionFromDraft,
  questDraftFromDefinition,
  removeQuestStage,
  validateQuestDraft
} from '../quest/model';

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

const plainLevel = levelFromEditorDraft(createDefaultEditorDraft());
const idolLevel = levelFromEditorDraft(
  paintEditorCell(createDefaultEditorDraft(), { x: 6, y: 6 }, 'idol')
);

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true
  });
});

describe('quest builder model', () => {
  it('orders library levels into a playable quest with renumbered depths', () => {
    let draft = createQuestDraft('quest-test');

    draft = addQuestStage(draft, 'Gate', plainLevel);
    draft = addQuestStage(draft, 'Vault', idolLevel);

    const definition = questDefinitionFromDraft(draft);

    expect(definition.stages.map((stage) => stage.level.id)).toEqual([1, 2]);
    expect(definition.stages.map((stage) => stage.title)).toEqual(['Gate', 'Vault']);
    expect(validateQuestDraft(draft).canPlay).toBe(true);

    const adventure = new Adventure({ hero: warriorStarter, definition, seed: 7 });

    expect(adventure.snapshot().stageCount).toBe(2);
    expect(adventure.snapshot().stageTitle).toBe('Gate');
  });

  it('rejects idols before the final level and empty quests', () => {
    let draft = createQuestDraft('quest-test');

    expect(validateQuestDraft(draft).errors).toContain('Add at least one level from the library.');

    draft = addQuestStage(draft, 'Vault', idolLevel);
    draft = addQuestStage(draft, 'Gate', plainLevel);

    const validation = validateQuestDraft(draft);

    expect(validation.canPlay).toBe(false);
    expect(validation.errors.join(' ')).toMatch(/Idol/);

    draft = moveQuestStage(draft, 1, -1);
    expect(validateQuestDraft(draft).canPlay).toBe(true);

    draft = removeQuestStage(draft, 1);
    expect(validateQuestDraft(draft).canPlay).toBe(false);
  });

  it('round-trips quests through the document format and rejects malformed input', () => {
    const definition = questDefinitionFromDraft(
      addQuestStage(addQuestStage(createQuestDraft('quest-doc'), 'One', plainLevel), 'Two', idolLevel)
    );
    const parsed = parseQuestDocument(formatQuestDocument(definition));

    expect(parsed).toEqual(definition);
    expect(questDraftFromDefinition(parsed).stages).toHaveLength(2);
    expect(() => parseQuestDocument('not json')).toThrow(/parsed/);
    expect(() => parseQuestDocument(JSON.stringify({ kind: 'other' }))).toThrow(/dungeon-of-doom.quest/);

    const broken = formatQuestDocument({
      ...definition,
      stages: definition.stages.map((stage) => ({
        ...stage,
        level: { ...stage.level, cells: stage.level.cells.slice(0, 10) }
      }))
    });

    expect(() => parseQuestDocument(broken)).toThrow(/15x15/);
    expect(parseQuestDocument(formatQuestDocument(lostIdolAdventure))).toEqual(lostIdolAdventure);
  });
});

describe('local libraries', () => {
  it('saves, replaces, and removes library levels', () => {
    saveLevelToLibrary({ id: 'lvl-a', name: 'Alpha', level: plainLevel, savedAt: '2026-09-07' });
    saveLevelToLibrary({ id: 'lvl-b', name: 'Beta', level: idolLevel, savedAt: '2026-09-07' });
    saveLevelToLibrary({ id: 'lvl-a', name: 'Alpha II', level: plainLevel, savedAt: '2026-09-08' });

    expect(loadLevelLibrary().map((entry) => entry.name)).toEqual(['Beta', 'Alpha II']);
    expect(removeLevelFromLibrary('lvl-b').map((entry) => entry.id)).toEqual(['lvl-a']);
  });

  it('skips corrupt entries and finds saved quests by id', () => {
    localStorage.setItem(
      'dungeon-of-doom:quest-library',
      JSON.stringify([{ id: 'bad' }, questDefinitionFromDraft(addQuestStage(createQuestDraft('quest-ok'), 'Only', idolLevel))])
    );

    expect(loadQuestLibrary().map((quest) => quest.id)).toEqual(['quest-ok']);
    expect(findLibraryQuest('quest-ok')?.stages).toHaveLength(1);
    expect(findLibraryQuest('missing')).toBeNull();

    saveQuestToLibrary(lostIdolAdventure);
    expect(findLibraryQuest(lostIdolAdventure.id)?.title).toBe('The Lost Idol');
  });
});
