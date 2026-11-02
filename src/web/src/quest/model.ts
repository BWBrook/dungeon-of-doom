import { validateAdventureDefinition } from '../adventure/model';
import type { AdventureDefinition, AdventureStage } from '../adventure/model';
import type { LevelDefinition } from '../engine/types';

export interface QuestDraft {
  id: string;
  title: string;
  description: string;
  stages: AdventureStage[];
}

export interface QuestValidation {
  errors: string[];
  warnings: string[];
  canPlay: boolean;
}

export const QUEST_TITLE_MAX_LENGTH = 40;

export function createQuestDraft(id = newQuestId()): QuestDraft {
  return {
    id,
    title: 'New Quest',
    description: '',
    stages: []
  };
}

export function questDraftFromDefinition(definition: AdventureDefinition): QuestDraft {
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    stages: structuredClone(definition.stages)
  };
}

export function renameQuest(
  draft: QuestDraft,
  patch: { title?: string; description?: string }
): QuestDraft {
  return {
    ...structuredClone(draft),
    title: patch.title ?? draft.title,
    description: patch.description ?? draft.description
  };
}

export function addQuestStage(draft: QuestDraft, title: string, level: LevelDefinition): QuestDraft {
  const nextDraft = structuredClone(draft);

  nextDraft.stages.push({
    id: `${draft.id}-stage-${nextDraft.stages.length + 1}`,
    title: title.trim() || `Level ${nextDraft.stages.length + 1}`,
    level: structuredClone(level)
  });

  return nextDraft;
}

export function moveQuestStage(draft: QuestDraft, index: number, delta: number): QuestDraft {
  const target = index + delta;

  if (index < 0 || index >= draft.stages.length || target < 0 || target >= draft.stages.length) {
    return structuredClone(draft);
  }

  const nextDraft = structuredClone(draft);
  const [stage] = nextDraft.stages.splice(index, 1);

  nextDraft.stages.splice(target, 0, stage!);

  return nextDraft;
}

export function removeQuestStage(draft: QuestDraft, index: number): QuestDraft {
  const nextDraft = structuredClone(draft);

  nextDraft.stages.splice(index, 1);

  return nextDraft;
}

export function questDefinitionFromDraft(draft: QuestDraft): AdventureDefinition {
  return {
    id: draft.id,
    title: draft.title.trim(),
    description: draft.description.trim(),
    stages: draft.stages.map((stage, index) => ({
      id: `${draft.id}-stage-${index + 1}`,
      title: stage.title.trim() || `Level ${index + 1}`,
      level: { ...structuredClone(stage.level), id: index + 1 },
      ...(stage.verse ? { verse: stage.verse } : {})
    }))
  };
}

export function validateQuestDraft(draft: QuestDraft): QuestValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const title = draft.title.trim();

  if (title.length === 0) {
    errors.push('Quest title is required.');
  }

  if (title.length > QUEST_TITLE_MAX_LENGTH) {
    errors.push(`Quest title must be ${QUEST_TITLE_MAX_LENGTH} characters or fewer.`);
  }

  if (draft.stages.length === 0) {
    errors.push('Add at least one level from the library.');
  } else {
    errors.push(...validateAdventureDefinition(questDefinitionFromDraft(draft)));
  }

  if (draft.stages.length === 1) {
    warnings.push('A single-level quest ends as soon as the Idol is taken.');
  }

  if (draft.stages.some((stage) => stage.level.monsterSpawns.length === 0)) {
    warnings.push('Some levels have no monsters; experience to open the exit comes only from spells.');
  }

  return {
    errors,
    warnings,
    canPlay: errors.length === 0
  };
}

export function newQuestId(): string {
  return `quest-${crypto.randomUUID()}`;
}
