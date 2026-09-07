import type { AdventureDefinition } from '../adventure/model';
import type { LibraryLevel } from '../persist/library';
import type { QuestDraft } from '../quest/model';
import { escapeHtml } from './dom';
import type { ViewStatusState } from './modeRenderers';

export interface QuestViewRefs {
  levelName: HTMLInputElement;
  levelList: HTMLUListElement;
  title: HTMLInputElement;
  description: HTMLInputElement;
  stages: HTMLOListElement;
  questList: HTMLUListElement;
  status: HTMLParagraphElement;
  messages: HTMLUListElement;
}

export interface QuestViewState {
  levels: LibraryLevel[];
  quests: AdventureDefinition[];
  draft: QuestDraft;
  statusMessage: string;
  statusState: ViewStatusState;
  messageRows: string[];
}

export function renderQuestView(refs: QuestViewRefs, state: QuestViewState): void {
  if (document.activeElement !== refs.title) {
    refs.title.value = state.draft.title;
  }

  if (document.activeElement !== refs.description) {
    refs.description.value = state.draft.description;
  }

  refs.levelList.innerHTML =
    state.levels.length > 0
      ? state.levels
          .map(
            (entry) => `
              <li>
                <span>${escapeHtml(entry.name)} <small>${describeLevel(entry)}</small></span>
                <span class="library-actions">
                  <button data-library-action="load" data-level-id="${escapeHtml(entry.id)}" type="button">Load</button>
                  <button data-library-action="add" data-level-id="${escapeHtml(entry.id)}" type="button">Add To Quest</button>
                  <button data-library-action="delete" data-level-id="${escapeHtml(entry.id)}" type="button">Delete</button>
                </span>
              </li>
            `
          )
          .join('')
      : '<li class="library-empty">No saved levels yet. Name the level above and save it.</li>';

  refs.stages.innerHTML =
    state.draft.stages.length > 0
      ? state.draft.stages
          .map(
            (stage, index) => `
              <li>
                <span>Level ${index + 1}: ${escapeHtml(stage.title)} <small>${describeStage(stage.level.monsterSpawns.length, stage.level.cells.some((cell) => cell.kind === 'idol'))}</small></span>
                <span class="library-actions">
                  <button data-stage-action="up" data-stage-index="${index}" type="button" aria-label="Move level ${index + 1} up" ${index === 0 ? 'disabled' : ''}>Up</button>
                  <button data-stage-action="down" data-stage-index="${index}" type="button" aria-label="Move level ${index + 1} down" ${index === state.draft.stages.length - 1 ? 'disabled' : ''}>Down</button>
                  <button data-stage-action="remove" data-stage-index="${index}" type="button" aria-label="Remove level ${index + 1}">Remove</button>
                </span>
              </li>
            `
          )
          .join('')
      : '<li class="library-empty">No levels in this quest. Add saved levels in the order they should be played.</li>';

  refs.questList.innerHTML =
    state.quests.length > 0
      ? state.quests
          .map(
            (quest) => `
              <li>
                <span>${escapeHtml(quest.title)} <small>${quest.stages.length} level${quest.stages.length === 1 ? '' : 's'}</small></span>
                <span class="library-actions">
                  <button data-quest-action="load" data-quest-id="${escapeHtml(quest.id)}" type="button">Load</button>
                  <button data-quest-action="delete" data-quest-id="${escapeHtml(quest.id)}" type="button">Delete</button>
                </span>
              </li>
            `
          )
          .join('')
      : '<li class="library-empty">No saved quests yet.</li>';

  refs.status.textContent = state.statusMessage;
  refs.status.dataset.state = state.statusState;
  refs.messages.innerHTML = state.messageRows
    .map((message) => `<li>${escapeHtml(message)}</li>`)
    .join('');
}

function describeLevel(entry: LibraryLevel): string {
  return describeStage(
    entry.level.monsterSpawns.length,
    entry.level.cells.some((cell) => cell.kind === 'idol')
  );
}

function describeStage(monsterCount: number, hasIdol: boolean): string {
  const parts = [`${monsterCount} monster${monsterCount === 1 ? '' : 's'}`];

  if (hasIdol) {
    parts.push('Idol');
  }

  return parts.join(', ');
}
