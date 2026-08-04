import { ADJUSTABLE_CREATOR_STAT_KEYS, itemsForCreatorPage } from '../creator/model';
import type { CreatorDraft, CreatorStatKey } from '../creator/model';
import { CLASS_LABELS, deriveClassId } from '../engine/catalog';
import type { EditorDraft } from '../editor/model';
import type { EditorRenderer } from './editorRenderer';
import { escapeHtml, renderStat } from './dom';

export type ViewStatusState = 'idle' | 'success' | 'error';

export interface EditorViewRefs {
  toolPalette: HTMLDivElement;
}

export function renderEditorView(
  renderer: EditorRenderer,
  refs: EditorViewRefs,
  draft: EditorDraft
): void {
  renderer.draw(draft);

  for (const button of refs.toolPalette.querySelectorAll<HTMLButtonElement>('button[data-tool]')) {
    button.setAttribute('aria-pressed', String(button.dataset.tool === draft.selectedTool));
  }
}

export interface CreatorViewRefs {
  seedInput: HTMLInputElement;
  nameInput: HTMLInputElement;
  bargainOffer: HTMLInputElement;
  summary: HTMLDListElement;
  stats: HTMLDivElement;
  storePages: HTMLDivElement;
  storeItems: HTMLDivElement;
  status: HTMLParagraphElement;
  messages: HTMLUListElement;
}

export function renderCreatorView(
  refs: CreatorViewRefs,
  draft: CreatorDraft,
  statusMessage: string,
  statusState: ViewStatusState,
  messageRows: string[]
): void {
  const classId = deriveClassId(draft.stats);

  refs.seedInput.value = String(draft.seed);
  refs.nameInput.value = draft.name;
  refs.bargainOffer.value = String(draft.bargainOffer);
  refs.summary.innerHTML = `
    ${renderStat('CLASS', CLASS_LABELS[classId].toUpperCase())}
    ${renderStat('GOLD', draft.gold)}
    ${renderStat('POINTS', draft.modificationPoints)}
    ${renderStat('SEED', draft.seed)}
  `;
  refs.stats.innerHTML = `
    ${ADJUSTABLE_CREATOR_STAT_KEYS.map(
      (stat) => `
        <div class="stat-control">
          <span>${escapeHtml(formatStatLabel(stat))}</span>
          <button data-stat="${stat}" data-delta="-1" type="button" aria-label="Lower ${escapeHtml(formatStatLabel(stat))}">-</button>
          <strong>${draft.stats[stat]}</strong>
          <button data-stat="${stat}" data-delta="1" type="button" aria-label="Raise ${escapeHtml(formatStatLabel(stat))}">+</button>
        </div>
      `
    ).join('')}
    <div class="stat-control stat-control-locked">
      <span>EXP</span>
      <em>fixed</em>
      <strong>${draft.stats.experience}</strong>
    </div>
  `;

  for (const button of refs.storePages.querySelectorAll<HTMLButtonElement>(
    'button[data-store-page]'
  )) {
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.storePage === draft.selectedStorePage)
    );
  }

  refs.storeItems.innerHTML = itemsForCreatorPage(draft.selectedStorePage)
    .map((item) => {
      const owned = draft.inventorySlots[item.slot] ?? 0;
      const allowed = item.allowedClasses.includes(classId);

      return `
        <article class="store-item" data-allowed="${String(allowed)}">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>Slot ${item.slot} - ${item.price} gold - value ${item.power}</span>
          </div>
          <div class="store-item-meta">
            <span>${allowed ? 'Allowed' : `Not for ${CLASS_LABELS[classId]}`}</span>
            <span>Owned ${owned}</span>
          </div>
          <div class="store-item-actions">
            <button data-slot="${item.slot}" data-purchase-mode="fullPrice" type="button">Buy</button>
            <button data-slot="${item.slot}" data-purchase-mode="bargain" type="button">Bargain</button>
          </div>
        </article>
      `;
    })
    .join('');
  refs.status.textContent = statusMessage;
  refs.status.dataset.state = statusState;
  refs.messages.innerHTML = messageRows
    .map((message) => `<li>${escapeHtml(message)}</li>`)
    .join('');
}

export interface ArchiveViewRefs {
  status: HTMLParagraphElement;
  messages: HTMLUListElement;
}

export function renderArchiveView(
  refs: ArchiveViewRefs,
  statusMessage: string,
  statusState: ViewStatusState,
  messageRows: string[]
): void {
  refs.status.textContent = statusMessage;
  refs.status.dataset.state = statusState;
  refs.messages.innerHTML = messageRows
    .map((message) => `<li>${escapeHtml(message)}</li>`)
    .join('');
}

export function formatStatLabel(stat: CreatorStatKey): string {
  switch (stat) {
    case 'strength':
      return 'STR';
    case 'vitality':
      return 'VIT';
    case 'agility':
      return 'AGI';
    case 'intelligence':
      return 'INT';
    case 'experience':
      return 'EXP';
    case 'luck':
      return 'LUC';
    case 'aura':
      return 'AUR';
    case 'morality':
      return 'MOR';
  }
}
