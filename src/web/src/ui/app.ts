import {
  CREATOR_STORE_PAGES,
  adjustCreatorStat,
  attemptCreatorPurchase,
  createDefaultCreatorDraft,
  heroFromCreatorDraft,
  validateCreatorDraft
} from '../creator/model';
import type {
  CreatorDraft,
  CreatorPurchaseMode,
  CreatorStatKey,
  CreatorStorePage,
  CreatorValidation
} from '../creator/model';
import { Adventure } from '../adventure/model';
import type { AdventureSnapshot } from '../adventure/model';
import { adventureCatalog, lostIdolAdventure } from '../content/adventures';
import { SPELL_NAMES } from '../engine/catalog';
import {
  EDITOR_TOOLS,
  createDefaultEditorDraft,
  editorDraftFromLevel,
  levelFromEditorDraft,
  paintEditorCell,
  validateEditorDraft
} from '../editor/model';
import type { EditorDraft, EditorTool, EditorValidation } from '../editor/model';
import { heroFixtures, levelFixtures } from '../engine/fixtures';
import { Game, createGameInit, prepareHeroForFreshRun } from '../engine/game';
import type {
  Action,
  HeroState,
  LevelDefinition,
  RunStatus,
  Snapshot,
  SpellSlot,
  StepResult
} from '../engine/types';
import {
  convertLegacySnapshotToRun,
  formatLegacyReport,
  inspectLegacyHero,
  inspectLegacyLevel,
  inspectLegacySnapshotPair,
  roundTripLegacyHero,
  roundTripLegacyLevel
} from '../persist/archive';
import type { LegacyDiagnostic, LegacyPayloadReport } from '../persist/archive';
import { ARCHIVE_EXAMPLES, archiveExampleById } from '../persist/archiveExamples';
import { formatHeroString, formatLevelString, parseHeroString, parseLevelString } from '../persist/legacy';
import { formatHeroDocument } from '../persist/heroDocument';
import { formatLevelDocument } from '../persist/levelDocument';
import { loadPlaySession, savePlaySession } from '../persist/save';
import type { SerializedPlaySession } from '../persist/save';
import {
  currentAdventureSnapshot,
  currentRunSnapshot,
  currentSerializedRun,
  restorePlaySession,
  serializePlaySession,
  stepPlaySession
} from '../play/session';
import type { ActivePlaySession } from '../play/session';
import { renderAdventureOutcome, renderAdventureProgress } from './adventureView';
import { AudioEngine } from './audio';
import { EditorRenderer } from './editorRenderer';
import { DungeonRenderer } from './renderer';
import { createRunPresentation } from './runPresentation';
import type { CommandId, RunPresentation } from './runPresentation';
import { loadSensoryPreferences, saveSensoryPreferences } from './sensoryPreferences';
import type { SensoryPreferences } from './sensoryPreferences';
import { effectIntensity } from './visualEffects';
import type { VisualEffectKind } from './visualCatalog';
import { APP_TEMPLATE } from './appTemplate';
import { escapeHtml, renderStat, requireElement } from './dom';
import {
  formatStatLabel,
  renderArchiveView,
  renderCreatorView,
  renderEditorView
} from './modeRenderers';
import type { ArchiveViewRefs, CreatorViewRefs, ViewStatusState } from './modeRenderers';

const IMPORTED_HERO_VALUE = '__imported_legacy_hero__';
const CREATED_HERO_VALUE = '__created_creator_hero__';
const IMPORTED_LEVEL_VALUE = '__imported_legacy_level__';
const AUTHORED_LEVEL_VALUE = '__authored_editor_level__';
const CONVERTED_HERO_VALUE = '__converted_legacy_snapshot_hero__';
const CONVERTED_LEVEL_VALUE = '__converted_legacy_snapshot_level__';

const HERO_OPTIONS = [
  { value: 'warrior_starter', label: 'Warrior Starter' },
  { value: 'cleric_starter', label: 'Cleric Starter' }
] as const;

const LEVEL_OPTIONS = [
  { value: 'mixed_demo_level', label: 'Mixed Demo' },
  { value: 'wall_bump_level', label: 'Wall Bump' },
  { value: 'trap_escape_level', label: 'Trap Escape' },
  { value: 'reveal_guard_level', label: 'Reveal Guard' },
  { value: 'idol_finish_level', label: 'Idol Finish' }
] as const;

const ADVENTURE_OPTIONS = [{ value: lostIdolAdventure.id, label: lostIdolAdventure.title }] as const;

type AppMode = 'play' | 'editor' | 'creator' | 'archive';
type PlayKind = ActivePlaySession['kind'];
type StatusState = ViewStatusState;

const PLAY_COMMANDS: Array<{ id: CommandId; action: Action | null }> = [
  { id: 'turnLeft', action: { type: 'turnLeft' } },
  { id: 'turnRight', action: { type: 'turnRight' } },
  { id: 'moveForward', action: { type: 'moveForward' } },
  { id: 'attack', action: { type: 'attack' } },
  { id: 'get', action: { type: 'get' } },
  { id: 'restore', action: { type: 'useRestorative' } },
  { id: 'reveal', action: { type: 'reveal' } },
  { id: 'conjure', action: null },
  { id: 'wait', action: { type: 'wait' } },
  { id: 'save', action: null }
];

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

export function mountApp(root: HTMLDivElement) {
  root.innerHTML = APP_TEMPLATE;

  const modePlayButton = requireElement(root, '[data-role="mode-play-button"]', HTMLButtonElement);
  const modeEditorButton = requireElement(root, '[data-role="mode-editor-button"]', HTMLButtonElement);
  const modeCreatorButton = requireElement(root, '[data-role="mode-creator-button"]', HTMLButtonElement);
  const modeArchiveButton = requireElement(root, '[data-role="mode-archive-button"]', HTMLButtonElement);
  const soundToggle = requireElement(root, '[data-role="sound-toggle"]', HTMLButtonElement);
  const motionToggle = requireElement(root, '[data-role="motion-toggle"]', HTMLButtonElement);
  const playModePanel = requireElement(root, '[data-role="play-mode"]', HTMLElement);
  const editorModePanel = requireElement(root, '[data-role="editor-mode"]', HTMLElement);
  const creatorModePanel = requireElement(root, '[data-role="creator-mode"]', HTMLElement);
  const archiveModePanel = requireElement(root, '[data-role="archive-mode"]', HTMLElement);
  const playKindSelect = requireElement(root, '[data-role="play-kind-select"]', HTMLSelectElement);
  const heroSelect = requireElement(root, '[data-role="hero-select"]', HTMLSelectElement);
  const adventureField = requireElement(root, '[data-role="adventure-field"]', HTMLElement);
  const adventureSelect = requireElement(root, '[data-role="adventure-select"]', HTMLSelectElement);
  const levelField = requireElement(root, '[data-role="level-field"]', HTMLElement);
  const levelSelect = requireElement(root, '[data-role="level-select"]', HTMLSelectElement);
  const seedInput = requireElement(root, '[data-role="seed-input"]', HTMLInputElement);
  const startButton = requireElement(root, '[data-role="start-button"]', HTMLButtonElement);
  const saveButton = requireElement(root, '[data-role="save-button"]', HTMLButtonElement);
  const resumeButton = requireElement(root, '[data-role="resume-button"]', HTMLButtonElement);
  const canvas = requireElement(root, '[data-role="canvas"]', HTMLCanvasElement);
  const runSubline = requireElement(root, '[data-role="run-subline"]', HTMLParagraphElement);
  const runHeadline = requireElement(root, '[data-role="run-headline"]', HTMLHeadingElement);
  const latestEvent = requireElement(root, '[data-role="latest-event"]', HTMLParagraphElement);
  const hud = requireElement(root, '[data-role="hud"]', HTMLDListElement);
  const commandGrid = requireElement(root, '[data-role="command-grid"]', HTMLDivElement);
  const spellChooser = requireElement(root, '[data-role="spell-chooser"]', HTMLDivElement);
  const spellButtons = requireElement(root, '[data-role="spell-buttons"]', HTMLDivElement);
  const saveStatus = requireElement(root, '[data-role="save-status"]', HTMLParagraphElement);
  const messages = requireElement(root, '[data-role="messages"]', HTMLOListElement);
  const adventureProgress = requireElement(root, '[data-role="adventure-progress"]', HTMLElement);
  const adventureProgressTitle = requireElement(
    root,
    '[data-role="adventure-progress-title"]',
    HTMLHeadingElement
  );
  const adventureProgressDetail = requireElement(
    root,
    '[data-role="adventure-progress-detail"]',
    HTMLParagraphElement
  );
  const adventureProgressStage = requireElement(
    root,
    '[data-role="adventure-progress-stage"]',
    HTMLElement
  );
  const adventureProgressMarkers = requireElement(
    root,
    '[data-role="adventure-progress-markers"]',
    HTMLDivElement
  );
  const outcomePanel = requireElement(root, '[data-role="outcome-panel"]', HTMLElement);
  const outcomeSubline = requireElement(root, '[data-role="outcome-subline"]', HTMLParagraphElement);
  const outcomeTitle = requireElement(root, '[data-role="outcome-title"]', HTMLHeadingElement);
  const outcomeBody = requireElement(root, '[data-role="outcome-body"]', HTMLParagraphElement);
  const outcomeContinueButton = requireElement(
    root,
    '[data-role="outcome-continue-button"]',
    HTMLButtonElement
  );
  const outcomeStartButton = requireElement(root, '[data-role="outcome-start-button"]', HTMLButtonElement);
  const outcomeExportHeroButton = requireElement(root, '[data-role="outcome-export-hero-button"]', HTMLButtonElement);
  const outcomeExportLevelButton = requireElement(root, '[data-role="outcome-export-level-button"]', HTMLButtonElement);
  const heroPayload = requireElement(root, '[data-role="hero-payload"]', HTMLTextAreaElement);
  const levelPayload = requireElement(root, '[data-role="level-payload"]', HTMLTextAreaElement);
  const legacyStatus = requireElement(root, '[data-role="legacy-status"]', HTMLParagraphElement);
  const importHeroButton = requireElement(root, '[data-role="import-hero-button"]', HTMLButtonElement);
  const importLevelButton = requireElement(root, '[data-role="import-level-button"]', HTMLButtonElement);
  const exportHeroButton = requireElement(root, '[data-role="export-hero-button"]', HTMLButtonElement);
  const exportLevelButton = requireElement(root, '[data-role="export-level-button"]', HTMLButtonElement);
  const clearLegacyButton = requireElement(root, '[data-role="clear-legacy-button"]', HTMLButtonElement);
  const editorCanvas = requireElement(root, '[data-role="editor-canvas"]', HTMLCanvasElement);
  const editorToolPalette = requireElement(root, '[data-role="editor-tool-palette"]', HTMLDivElement);
  const editorNewButton = requireElement(root, '[data-role="editor-new-button"]', HTMLButtonElement);
  const editorEditSelectedButton = requireElement(
    root,
    '[data-role="editor-edit-selected-button"]',
    HTMLButtonElement
  );
  const editorValidateButton = requireElement(root, '[data-role="editor-validate-button"]', HTMLButtonElement);
  const editorPlayButton = requireElement(root, '[data-role="editor-play-button"]', HTMLButtonElement);
  const editorExportJsonButton = requireElement(root, '[data-role="editor-export-json-button"]', HTMLButtonElement);
  const editorExportLegacyButton = requireElement(
    root,
    '[data-role="editor-export-legacy-button"]',
    HTMLButtonElement
  );
  const editorClearOutputButton = requireElement(
    root,
    '[data-role="editor-clear-output-button"]',
    HTMLButtonElement
  );
  const editorStatus = requireElement(root, '[data-role="editor-status"]', HTMLParagraphElement);
  const editorMessages = requireElement(root, '[data-role="editor-messages"]', HTMLUListElement);
  const editorOutput = requireElement(root, '[data-role="editor-output"]', HTMLTextAreaElement);
  const creatorSeedInput = requireElement(root, '[data-role="creator-seed-input"]', HTMLInputElement);
  const creatorNameInput = requireElement(root, '[data-role="creator-name-input"]', HTMLInputElement);
  const creatorRollButton = requireElement(root, '[data-role="creator-roll-button"]', HTMLButtonElement);
  const creatorSummary = requireElement(root, '[data-role="creator-summary"]', HTMLDListElement);
  const creatorStats = requireElement(root, '[data-role="creator-stats"]', HTMLDivElement);
  const creatorStorePages = requireElement(root, '[data-role="creator-store-pages"]', HTMLDivElement);
  const creatorBargainOffer = requireElement(root, '[data-role="creator-bargain-offer"]', HTMLInputElement);
  const creatorStoreItems = requireElement(root, '[data-role="creator-store-items"]', HTMLDivElement);
  const creatorValidateButton = requireElement(root, '[data-role="creator-validate-button"]', HTMLButtonElement);
  const creatorPlayButton = requireElement(root, '[data-role="creator-play-button"]', HTMLButtonElement);
  const creatorExportJsonButton = requireElement(
    root,
    '[data-role="creator-export-json-button"]',
    HTMLButtonElement
  );
  const creatorExportLegacyButton = requireElement(
    root,
    '[data-role="creator-export-legacy-button"]',
    HTMLButtonElement
  );
  const creatorClearOutputButton = requireElement(
    root,
    '[data-role="creator-clear-output-button"]',
    HTMLButtonElement
  );
  const creatorStatus = requireElement(root, '[data-role="creator-status"]', HTMLParagraphElement);
  const creatorMessages = requireElement(root, '[data-role="creator-messages"]', HTMLUListElement);
  const creatorOutput = requireElement(root, '[data-role="creator-output"]', HTMLTextAreaElement);
  const archiveExampleSelect = requireElement(root, '[data-role="archive-example-select"]', HTMLSelectElement);
  const archiveLoadExampleButton = requireElement(
    root,
    '[data-role="archive-load-example-button"]',
    HTMLButtonElement
  );
  const archiveInspectHeroButton = requireElement(
    root,
    '[data-role="archive-inspect-hero-button"]',
    HTMLButtonElement
  );
  const archiveInspectLevelButton = requireElement(
    root,
    '[data-role="archive-inspect-level-button"]',
    HTMLButtonElement
  );
  const archiveRoundTripHeroButton = requireElement(
    root,
    '[data-role="archive-roundtrip-hero-button"]',
    HTMLButtonElement
  );
  const archiveRoundTripLevelButton = requireElement(
    root,
    '[data-role="archive-roundtrip-level-button"]',
    HTMLButtonElement
  );
  const archiveInspectSnapshotButton = requireElement(
    root,
    '[data-role="archive-inspect-snapshot-button"]',
    HTMLButtonElement
  );
  const archiveConvertSnapshotButton = requireElement(
    root,
    '[data-role="archive-convert-snapshot-button"]',
    HTMLButtonElement
  );
  const archiveClearButton = requireElement(root, '[data-role="archive-clear-button"]', HTMLButtonElement);
  const archiveHeroPayload = requireElement(root, '[data-role="archive-hero-payload"]', HTMLTextAreaElement);
  const archiveLevelPayload = requireElement(root, '[data-role="archive-level-payload"]', HTMLTextAreaElement);
  const archiveStatus = requireElement(root, '[data-role="archive-status"]', HTMLParagraphElement);
  const archiveMessages = requireElement(root, '[data-role="archive-messages"]', HTMLUListElement);
  const archiveOutput = requireElement(root, '[data-role="archive-output"]', HTMLTextAreaElement);

  const editorViewRefs = {
    toolPalette: editorToolPalette
  };
  const creatorViewRefs: CreatorViewRefs = {
    seedInput: creatorSeedInput,
    nameInput: creatorNameInput,
    bargainOffer: creatorBargainOffer,
    summary: creatorSummary,
    stats: creatorStats,
    storePages: creatorStorePages,
    storeItems: creatorStoreItems,
    status: creatorStatus,
    messages: creatorMessages
  };
  const archiveViewRefs: ArchiveViewRefs = {
    status: archiveStatus,
    messages: archiveMessages
  };
  const adventureProgressViewRefs = {
    panel: adventureProgress,
    title: adventureProgressTitle,
    detail: adventureProgressDetail,
    stage: adventureProgressStage,
    markers: adventureProgressMarkers
  };
  const adventureOutcomeViewRefs = {
    panel: outcomePanel,
    subline: outcomeSubline,
    title: outcomeTitle,
    body: outcomeBody,
    continueButton: outcomeContinueButton
  };

  for (const option of HERO_OPTIONS) {
    heroSelect.add(new Option(option.label, option.value));
  }

  for (const option of ADVENTURE_OPTIONS) {
    adventureSelect.add(new Option(option.label, option.value));
  }

  for (const option of LEVEL_OPTIONS) {
    levelSelect.add(new Option(option.label, option.value));
  }

  for (const example of ARCHIVE_EXAMPLES) {
    archiveExampleSelect.add(new Option(example.label, example.id));
  }

  for (const option of EDITOR_TOOLS) {
    const button = document.createElement('button');

    button.type = 'button';
    button.dataset.tool = option.tool;
    button.textContent = option.label;
    editorToolPalette.append(button);
  }

  for (const option of CREATOR_STORE_PAGES) {
    const button = document.createElement('button');

    button.type = 'button';
    button.dataset.storePage = option.page;
    button.textContent = option.label;
    creatorStorePages.append(button);
  }

  for (const command of PLAY_COMMANDS) {
    const button = document.createElement('button');

    button.type = 'button';
    button.dataset.command = command.id;
    commandGrid.append(button);
  }

  for (let slot = 1; slot <= 6; slot += 1) {
    const button = document.createElement('button');

    button.type = 'button';
    button.dataset.spellSlot = String(slot);
    button.textContent = String(slot);
    spellButtons.append(button);
  }

  heroSelect.value = HERO_OPTIONS[0].value;
  adventureSelect.value = ADVENTURE_OPTIONS[0].value;
  levelSelect.value = LEVEL_OPTIONS[0].value;

  const renderer = new DungeonRenderer(canvas);
  const editorRenderer = new EditorRenderer(editorCanvas);
  const audio = new AudioEngine();
  let sensoryPreferences: SensoryPreferences = loadSensoryPreferences();
  let mode: AppMode = 'play';
  let playSession: ActivePlaySession | null = null;
  let lastSnapshot: Snapshot | null = null;
  let lastAdventureSnapshot: AdventureSnapshot | null = null;
  let lastPresentation: RunPresentation = createRunPresentation(null, null);
  let lastTurnMessages: string[] = [];
  let lastChangedCells: Array<{ x: number; y: number }> = [];
  let lastEffectKind: VisualEffectKind = 'idle';
  let lastEffectStartedAtMs = 0;
  let uiClockMs = 0;
  let saveStatusMessage = 'No run saved this session.';
  let importedHero: HeroState | null = null;
  let createdHero: HeroState | null = null;
  let convertedHero: HeroState | null = null;
  let importedLevel: LevelDefinition | null = null;
  let authoredLevel: LevelDefinition | null = null;
  let convertedLevel: LevelDefinition | null = null;
  let editorDraft: EditorDraft = createDefaultEditorDraft();
  let creatorDraft: CreatorDraft = createDefaultCreatorDraft(Number(creatorSeedInput.value) || 1984);
  let creatorStatusMessage = 'Roll a hero, spend points, buy gear, then launch.';
  let creatorStatusState: StatusState = 'idle';
  let creatorMessageRows: string[] = [];
  let archiveStatusMessage = 'Load or paste archival payloads to inspect them.';
  let archiveStatusState: StatusState = 'idle';
  let archiveMessageRows: string[] = [];
  let appMessages: string[] = [];

  audio.setEnabled(sensoryPreferences.audioEnabled);

  function renderApp() {
    renderMode();
    renderSensoryControls();

    if (mode === 'play') {
      renderCurrentGame();
    } else if (mode === 'editor') {
      renderEditorView(editorRenderer, editorViewRefs, editorDraft);
    } else if (mode === 'creator') {
      renderCreatorView(
        creatorViewRefs,
        creatorDraft,
        creatorStatusMessage,
        creatorStatusState,
        creatorMessageRows
      );
    } else {
      renderArchiveView(archiveViewRefs, archiveStatusMessage, archiveStatusState, archiveMessageRows);
    }
  }

  function renderMode() {
    playModePanel.hidden = mode !== 'play';
    editorModePanel.hidden = mode !== 'editor';
    creatorModePanel.hidden = mode !== 'creator';
    archiveModePanel.hidden = mode !== 'archive';
    modePlayButton.setAttribute('aria-pressed', String(mode === 'play'));
    modeEditorButton.setAttribute('aria-pressed', String(mode === 'editor'));
    modeCreatorButton.setAttribute('aria-pressed', String(mode === 'creator'));
    modeArchiveButton.setAttribute('aria-pressed', String(mode === 'archive'));

    if (mode === 'editor') {
      editorRenderer.resize();
    } else if (mode === 'play') {
      renderer.resize();
    }
  }

  function renderCurrentGame() {
    renderPlaySetup();

    if (!playSession) {
      lastSnapshot = null;
      lastAdventureSnapshot = null;
      lastPresentation = createRunPresentation(null, null, ['The dungeon awaits.', ...appMessages]);
      renderRunPresentation(lastPresentation);
      const previewSession = buildNewPlaySession();

      renderer.draw(currentRunSnapshot(previewSession), {
        changedCells: [],
        effect: 'idle',
        elapsedMs: 0,
        motionEnabled: sensoryPreferences.motionEnabled
      });
      saveButton.disabled = true;
      resumeButton.disabled = loadPlaySession() === null;
      adventureProgress.hidden = true;
      outcomePanel.hidden = true;
      return;
    }

    const snapshot = currentRunSnapshot(playSession);
    const level = currentSerializedRun(playSession).level;
    const adventureSnapshot = currentAdventureSnapshot(playSession);
    const presentation = createRunPresentation(snapshot, level, appMessages, {
      saveAllowedAfterRun: adventureSnapshot?.status === 'betweenLevels',
      turnMessages: lastTurnMessages
    });

    lastSnapshot = snapshot;
    lastAdventureSnapshot = adventureSnapshot;
    lastPresentation = presentation;
    renderer.draw(snapshot, {
      changedCells: lastChangedCells,
      effect: lastEffectKind,
      elapsedMs: currentEffectElapsedMs(),
      motionEnabled: sensoryPreferences.motionEnabled
    });
    renderRunPresentation(presentation);
    saveButton.disabled = !canSaveCurrentSession();
    resumeButton.disabled = loadPlaySession() === null;
    renderAdventureProgress(adventureProgressViewRefs, adventureSnapshot);
    renderOutcome(presentation, snapshot, adventureSnapshot);
  }

  function renderPlaySetup() {
    const kind = selectedPlayKind();

    adventureField.hidden = kind !== 'adventure';
    adventureSelect.disabled = kind !== 'adventure';
    levelField.hidden = kind !== 'single';
    levelSelect.disabled = kind !== 'single';
    startButton.textContent = kind === 'adventure' ? 'Begin Adventure' : 'Start Run';
  }

  function renderRunPresentation(presentation: RunPresentation) {
    runHeadline.textContent = presentation.headline;
    runSubline.textContent = presentation.subline;
    latestEvent.textContent = presentation.latestMessage;
    hud.innerHTML =
      presentation.resources.length > 0
        ? presentation.resources
            .map((resource) => renderStat(resource.label, resource.value))
            .join('')
        : '<div class="empty-state">Choose a hero and level, then begin.</div>';
    renderMessages(presentation.logRows);
    saveStatus.textContent = saveStatusMessage;

    for (const button of commandGrid.querySelectorAll<HTMLButtonElement>('button[data-command]')) {
      const state = presentation.commandStates.find((command) => command.id === button.dataset.command);

      if (!state) {
        continue;
      }

      button.innerHTML = `<span>${escapeHtml(state.label)}</span><kbd>${escapeHtml(state.hotkey)}</kbd>`;
      button.disabled = !state.enabled;
      button.title = state.hint;
      button.dataset.enabled = String(state.enabled);
    }

    renderSpellChooser();
  }

  function renderSensoryControls() {
    soundToggle.setAttribute('aria-pressed', String(sensoryPreferences.audioEnabled));
    motionToggle.setAttribute('aria-pressed', String(sensoryPreferences.motionEnabled));
    soundToggle.textContent = `Sound ${sensoryPreferences.audioEnabled ? 'On' : 'Off'}`;
    motionToggle.textContent = `Motion ${sensoryPreferences.motionEnabled ? 'On' : 'Still'}`;
    root.dataset.motion = sensoryPreferences.motionEnabled ? 'on' : 'off';
  }

  function renderOutcome(
    presentation: RunPresentation,
    snapshot: NonNullable<typeof lastSnapshot>,
    adventureSnapshot: AdventureSnapshot | null
  ) {
    outcomeContinueButton.hidden = true;
    outcomeStartButton.hidden = false;
    outcomeStartButton.textContent = adventureSnapshot ? 'Restart Adventure' : 'Start Run';

    if (adventureSnapshot) {
      renderAdventureOutcome(adventureOutcomeViewRefs, adventureSnapshot, snapshot);
      return;
    }

    if (!presentation.outcome) {
      outcomePanel.hidden = true;
      return;
    }

    outcomePanel.hidden = false;
    outcomeSubline.textContent = `Final turn ${snapshot.turnCount}`;

    if (presentation.outcome === 'won') {
      outcomeTitle.textContent = 'Quest Complete';
      outcomeBody.textContent = `Score ${snapshot.score ?? '--'} with ${snapshot.hero.treasure} treasure and ${snapshot.hero.gold} gold.`;
      return;
    }

    if (presentation.outcome === 'escaped') {
      outcomeTitle.textContent = 'Escaped The Level';
      outcomeBody.textContent = `Experience ${snapshot.hero.stats.experience.toFixed(2)}. Prepare the next dungeon when thy hero is ready.`;
      return;
    }

    outcomeTitle.textContent = 'Thou Hast Fallen';
    outcomeBody.textContent = `Final STR ${Math.floor(snapshot.hero.stats.strength)}, VIT ${Math.floor(snapshot.hero.stats.vitality)}. Last word: ${presentation.latestMessage}`;
  }

  function renderSpellChooser() {
    const snapshot = lastSnapshot;

    for (const button of spellButtons.querySelectorAll<HTMLButtonElement>('button[data-spell-slot]')) {
      const slot = Number(button.dataset.spellSlot) as SpellSlot;
      const enabled = snapshot?.runStatus === 'playing' && isSpellButtonAvailable(snapshot.hero, slot);

      button.textContent = `${slot}. ${SPELL_NAMES[slot]}`;
      button.disabled = !enabled;
    }
  }

  function buildNewPlaySession(): ActivePlaySession {
    if (selectedPlayKind() === 'adventure') {
      const adventure = new Adventure({
        hero: resolveSelectedHero(),
        definition: resolveSelectedAdventure(),
        seed: Number(seedInput.value) || 1984
      });

      return { kind: 'adventure', adventure };
    }

    return { kind: 'single', game: buildNewSingleGame() };
  }

  function buildNewSingleGame() {
    const heroFixture = resolveSelectedHero();
    const levelFixture = resolveSelectedLevel();
    const hero = prepareHeroForFreshRun(heroFixture, levelFixture);
    const seed = Number(seedInput.value) || 1984;

    return new Game(createGameInit(hero, levelFixture, seed));
  }

  function selectedPlayKind(): PlayKind {
    return playKindSelect.value === 'single' ? 'single' : 'adventure';
  }

  function resolveSelectedAdventure() {
    const adventure = adventureCatalog[adventureSelect.value];

    if (!adventure) {
      throw new Error('Selected adventure is not available.');
    }

    return adventure;
  }

  function resolveSelectedHero(): HeroState {
    if (heroSelect.value === IMPORTED_HERO_VALUE && importedHero) {
      return structuredClone(importedHero);
    }

    if (heroSelect.value === CREATED_HERO_VALUE && createdHero) {
      return structuredClone(createdHero);
    }

    if (heroSelect.value === CONVERTED_HERO_VALUE && convertedHero) {
      return structuredClone(convertedHero);
    }

    const hero = heroFixtures[heroSelect.value as keyof typeof heroFixtures];

    if (!hero) {
      throw new Error('Selected hero is not available.');
    }

    return structuredClone(hero);
  }

  function resolveSelectedLevel(): LevelDefinition {
    if (levelSelect.value === IMPORTED_LEVEL_VALUE && importedLevel) {
      return structuredClone(importedLevel);
    }

    if (levelSelect.value === AUTHORED_LEVEL_VALUE && authoredLevel) {
      return structuredClone(authoredLevel);
    }

    if (levelSelect.value === CONVERTED_LEVEL_VALUE && convertedLevel) {
      return structuredClone(convertedLevel);
    }

    const level = levelFixtures[levelSelect.value as keyof typeof levelFixtures];

    if (!level) {
      throw new Error('Selected level is not available.');
    }

    return structuredClone(level);
  }

  function importHeroPayload() {
    try {
      const hero = parseHeroString(heroPayload.value);

      importedHero = hero;
      ensureOption(heroSelect, IMPORTED_HERO_VALUE, 'Imported Legacy Hero');
      heroSelect.value = IMPORTED_HERO_VALUE;
      setLegacyStatus(`Imported hero: ${hero.displayLabel}`, 'success');
      pushAppMessage('Imported legacy hero.');
      renderApp();
    } catch (error) {
      const message = getErrorMessage(error);

      setLegacyStatus(message, 'error');
      pushAppMessage(message);
      renderApp();
    }
  }

  function importLevelPayload() {
    try {
      const level = parseLevelString(levelPayload.value);

      importedLevel = level;
      ensureOption(levelSelect, IMPORTED_LEVEL_VALUE, 'Imported Legacy Level');
      levelSelect.value = IMPORTED_LEVEL_VALUE;
      playKindSelect.value = 'single';
      setLegacyStatus(`Imported level ${level.id}.`, 'success');
      pushAppMessage('Imported legacy level.');
      renderApp();
    } catch (error) {
      const message = getErrorMessage(error);

      setLegacyStatus(message, 'error');
      pushAppMessage(message);
      renderApp();
    }
  }

  function exportHeroPayload() {
    try {
      const hero = playSession ? currentSerializedRun(playSession).hero : resolveSelectedHero();

      heroPayload.value = formatHeroString(hero);
      setLegacyStatus(`Exported hero: ${hero.displayLabel}`, 'success');
      pushAppMessage('Exported legacy hero.');
      renderApp();
    } catch (error) {
      const message = getErrorMessage(error);

      setLegacyStatus(message, 'error');
      pushAppMessage(message);
      renderApp();
    }
  }

  function exportLevelPayload() {
    try {
      const level = playSession ? currentSerializedRun(playSession).level : resolveSelectedLevel();

      levelPayload.value = formatLevelString(level);
      setLegacyStatus(`Exported level ${level.id}.`, 'success');
      pushAppMessage('Exported legacy level.');
      renderApp();
    } catch (error) {
      const message = getErrorMessage(error);

      setLegacyStatus(message, 'error');
      pushAppMessage(message);
      renderApp();
    }
  }

  function clearLegacyPayloads() {
    importedHero = null;
    importedLevel = null;
    heroPayload.value = '';
    levelPayload.value = '';
    removeOption(heroSelect, IMPORTED_HERO_VALUE);
    removeOption(levelSelect, IMPORTED_LEVEL_VALUE);
    if (heroSelect.value === IMPORTED_HERO_VALUE) {
      heroSelect.value = HERO_OPTIONS[0].value;
    }
    if (levelSelect.value === IMPORTED_LEVEL_VALUE) {
      levelSelect.value = LEVEL_OPTIONS[0].value;
    }
    setLegacyStatus('Legacy imports cleared.', 'idle');
    pushAppMessage('Legacy imports cleared.');
    renderApp();
  }

  function startRun() {
    playSession = buildNewPlaySession();
    appMessages = [];
    lastTurnMessages = [];
    lastChangedCells = [];
    lastEffectKind = 'idle';
    lastEffectStartedAtMs = uiClockMs;
    saveStatusMessage =
      playSession.kind === 'adventure'
        ? `${currentAdventureSnapshot(playSession)?.title ?? 'Adventure'} begun. No save yet.`
        : 'Run started. No save yet.';
    spellChooser.hidden = true;
    renderApp();
  }

  function saveCurrentGame() {
    if (!playSession || !canSaveCurrentSession()) {
      return;
    }

    const run = currentSerializedRun(playSession);
    const adventure = currentAdventureSnapshot(playSession);

    savePlaySession(serializePlaySession(playSession));
    audio.playAll(['save']);
    saveStatusMessage = adventure
      ? `Saved ${adventure.title}, level ${adventure.stageIndex + 1}, turn ${run.turnCount}.`
      : `Saved turn ${run.turnCount}.`;
    lastEffectKind = 'save';
    lastEffectStartedAtMs = uiClockMs;
    renderApp();
  }

  function loadCurrentGame(serialized: SerializedPlaySession | null) {
    if (!serialized) {
      return;
    }

    try {
      playSession = restorePlaySession(serialized);
      playKindSelect.value = playSession.kind;
      appMessages = [];
      lastTurnMessages = [];
      lastChangedCells = [];
      lastEffectKind = 'idle';
      lastEffectStartedAtMs = uiClockMs;
      const run = currentSerializedRun(playSession);
      const adventure = currentAdventureSnapshot(playSession);

      saveStatusMessage = adventure
        ? `Resumed ${adventure.title}, level ${adventure.stageIndex + 1}, turn ${run.turnCount}.`
        : `Resumed saved turn ${run.turnCount}.`;
      spellChooser.hidden = true;
      renderApp();
    } catch (error) {
      saveStatusMessage = getErrorMessage(error);
      renderApp();
    }
  }

  function performAction(action: Action) {
    if (!playSession || mode !== 'play') {
      return;
    }

    const result = stepPlaySession(playSession, action);
    const snapshot = currentRunSnapshot(playSession);

    lastTurnMessages = result.messages;
    lastChangedCells = result.cellsChanged;
    lastEffectKind = effectKindFromResult(action, result, snapshot.runStatus);
    lastEffectStartedAtMs = uiClockMs;
    spellChooser.hidden = true;
    audio.playAll(result.sounds);
    renderApp();
  }

  function continueAdventure() {
    if (playSession?.kind !== 'adventure') {
      return;
    }

    try {
      playSession.adventure.continueToNextLevel();
      const adventure = playSession.adventure.snapshot();

      lastTurnMessages = [];
      lastChangedCells = [];
      lastEffectKind = 'idle';
      lastEffectStartedAtMs = uiClockMs;
      saveStatusMessage = `${adventure.stageTitle} begun. Save when ready.`;
      spellChooser.hidden = true;
      pushAppMessage(`Descended to level ${adventure.stageIndex + 1}.`);
      renderApp();
    } catch (error) {
      pushAppMessage(getErrorMessage(error));
      renderApp();
    }
  }

  function canSaveCurrentSession(): boolean {
    if (!playSession) {
      return false;
    }

    if (playSession.kind === 'single') {
      return playSession.game.snapshot().runStatus === 'playing';
    }

    const status = playSession.adventure.snapshot().status;

    return status === 'playing' || status === 'betweenLevels';
  }

  function toggleAudioPreference() {
    sensoryPreferences = {
      ...sensoryPreferences,
      audioEnabled: !sensoryPreferences.audioEnabled
    };
    audio.setEnabled(sensoryPreferences.audioEnabled);
    saveSensoryPreferences(sensoryPreferences);
    renderApp();
  }

  function toggleMotionPreference() {
    sensoryPreferences = {
      ...sensoryPreferences,
      motionEnabled: !sensoryPreferences.motionEnabled
    };
    saveSensoryPreferences(sensoryPreferences);
    renderApp();
  }

  function currentEffectElapsedMs() {
    return Math.max(0, uiClockMs - lastEffectStartedAtMs);
  }

  function performCommand(commandId: CommandId) {
    const commandState = lastPresentation.commandStates.find((command) => command.id === commandId);

    if (!commandState?.enabled) {
      return;
    }

    if (commandId === 'save') {
      saveCurrentGame();
      return;
    }

    if (commandId === 'conjure') {
      toggleSpellChooser();
      return;
    }

    const command = PLAY_COMMANDS.find((entry) => entry.id === commandId);

    if (command?.action) {
      performAction(command.action);
    }
  }

  function toggleSpellChooser() {
    const commandState = lastPresentation.commandStates.find((command) => command.id === 'conjure');

    if (!commandState?.enabled) {
      return;
    }

    spellChooser.hidden = !spellChooser.hidden;
  }

  function castSpellFromChooser(slot: SpellSlot) {
    if (!lastSnapshot || !isSpellButtonAvailable(lastSnapshot.hero, slot)) {
      return;
    }

    performAction({ type: 'castSpell', slot });
  }

  function setMode(nextMode: AppMode) {
    mode = nextMode;
    renderApp();
  }

  function setSelectedTool(tool: EditorTool) {
    editorDraft = {
      ...editorDraft,
      selectedTool: tool
    };
    renderApp();
  }

  function paintEditorFromEvent(event: PointerEvent) {
    const point = editorRenderer.pointFromPointer(event);

    if (!point) {
      return;
    }

    editorDraft = paintEditorCell(editorDraft, point, editorDraft.selectedTool);
    renderApp();
  }

  function resetEditorDraft() {
    editorDraft = createDefaultEditorDraft();
    editorOutput.value = '';
    setEditorStatus('New editor level ready.', 'idle', validateEditorDraft(editorDraft));
    renderApp();
  }

  function editSelectedLevel() {
    try {
      editorDraft = editorDraftFromLevel(resolveSelectedLevel());
      editorOutput.value = '';
      setEditorStatus(`Loaded selected level ${editorDraft.id} into the editor.`, 'success', validateEditorDraft(editorDraft));
      setMode('editor');
    } catch (error) {
      setEditorStatus(getErrorMessage(error), 'error');
      renderApp();
    }
  }

  function validateEditor() {
    const validation = validateEditorDraft(editorDraft);

    setEditorStatus(validation.canPlay ? 'Level validates for play.' : 'Level has blocking errors.', validation.canPlay ? 'success' : 'error', validation);
    renderApp();
  }

  function playAuthoredLevel() {
    const validation = validateEditorDraft(editorDraft);

    if (!validation.canPlay) {
      setEditorStatus('Cannot play this level yet.', 'error', validation);
      renderApp();
      return;
    }

    authoredLevel = levelFromEditorDraft(editorDraft);
    ensureOption(levelSelect, AUTHORED_LEVEL_VALUE, 'Authored Editor Level');
    levelSelect.value = AUTHORED_LEVEL_VALUE;
    playKindSelect.value = 'single';
    mode = 'play';
    playSession = { kind: 'single', game: buildNewSingleGame() };
    pushAppMessage('Started authored editor level.');
    setEditorStatus('Authored level launched in play mode.', 'success', validation);
    renderApp();
  }

  function exportEditorJson() {
    const validation = validateEditorDraft(editorDraft);

    if (!validation.canPlay) {
      setEditorStatus('Cannot export JSON until blocking errors are fixed.', 'error', validation);
      renderApp();
      return;
    }

    const level = levelFromEditorDraft(editorDraft);

    editorOutput.value = formatLevelDocument(level);
    setEditorStatus('Exported modern level JSON.', 'success', validation);
    renderApp();
  }

  function exportEditorLegacy() {
    const validation = validateEditorDraft(editorDraft);

    if (!validation.canExportLegacy) {
      setEditorStatus('Cannot export legacy level until blocking export issues are fixed.', 'error', validation);
      renderApp();
      return;
    }

    const level = levelFromEditorDraft(editorDraft);

    editorOutput.value = formatLevelString(level);
    setEditorStatus(`Exported legacy level ${level.id}.`, 'success', validation);
    renderApp();
  }

  function clearEditorOutput() {
    editorOutput.value = '';
    setEditorStatus('Editor output cleared.', 'idle');
    renderApp();
  }

  function rollCreatorHero() {
    const seed = Number(creatorSeedInput.value) || 1984;

    creatorDraft = createDefaultCreatorDraft(seed);
    creatorOutput.value = '';
    setCreatorStatus('Rolled a new hero draft.', 'success');
    renderApp();
  }

  function syncCreatorInputs() {
    creatorDraft = {
      ...creatorDraft,
      name: creatorNameInput.value,
      bargainOffer: Number(creatorBargainOffer.value)
    };
  }

  function setCreatorStorePage(page: CreatorStorePage) {
    creatorDraft = {
      ...creatorDraft,
      selectedStorePage: page
    };
    renderApp();
  }

  function adjustCreator(stat: CreatorStatKey, delta: number) {
    syncCreatorInputs();

    const previous = creatorDraft;
    const next = adjustCreatorStat(previous, stat, delta);
    const didChange =
      next.stats[stat] !== previous.stats[stat] ||
      next.modificationPoints !== previous.modificationPoints;

    creatorDraft = next;

    if (didChange) {
      setCreatorStatus(`Adjusted ${formatStatLabel(stat)}.`, 'success');
    } else if (delta > 0) {
      setCreatorStatus('No modification points remain.', 'error');
    } else {
      setCreatorStatus(`${formatStatLabel(stat)} cannot be lowered further.`, 'error');
    }

    renderApp();
  }

  function purchaseCreatorItem(slot: number, mode: CreatorPurchaseMode) {
    syncCreatorInputs();

    const result = attemptCreatorPurchase(creatorDraft, slot, mode, Number(creatorBargainOffer.value));

    creatorDraft = result.draft;
    setCreatorStatus(result.message, result.success ? 'success' : 'error');
    renderApp();
  }

  function validateCreator() {
    syncCreatorInputs();

    const validation = validateCreatorDraft(creatorDraft);

    setCreatorStatus(
      validation.canCreate ? 'Hero validates for play.' : 'Hero has blocking errors.',
      validation.canCreate ? 'success' : 'error',
      validation
    );
    renderApp();
  }

  function playCreatedHero() {
    syncCreatorInputs();

    const validation = validateCreatorDraft(creatorDraft);

    if (!validation.canCreate) {
      setCreatorStatus('Cannot play this hero yet.', 'error', validation);
      renderApp();
      return;
    }

    createdHero = heroFromCreatorDraft(creatorDraft);
    ensureOption(heroSelect, CREATED_HERO_VALUE, 'Created Hero');
    heroSelect.value = CREATED_HERO_VALUE;
    playKindSelect.value = 'single';
    mode = 'play';
    playSession = { kind: 'single', game: buildNewSingleGame() };
    pushAppMessage('Started created hero.');
    setCreatorStatus('Created hero launched in play mode.', 'success', validation);
    renderApp();
  }

  function exportCreatorJson() {
    syncCreatorInputs();

    const validation = validateCreatorDraft(creatorDraft);

    if (!validation.canCreate) {
      setCreatorStatus('Cannot export JSON until blocking errors are fixed.', 'error', validation);
      renderApp();
      return;
    }

    creatorOutput.value = formatHeroDocument(heroFromCreatorDraft(creatorDraft));
    setCreatorStatus('Exported modern hero JSON.', 'success', validation);
    renderApp();
  }

  function exportCreatorLegacy() {
    syncCreatorInputs();

    const validation = validateCreatorDraft(creatorDraft);

    if (!validation.canExportLegacy) {
      setCreatorStatus('Cannot export legacy hero until blocking errors are fixed.', 'error', validation);
      renderApp();
      return;
    }

    creatorOutput.value = formatHeroString(heroFromCreatorDraft(creatorDraft));
    setCreatorStatus('Exported legacy hero.', 'success', validation);
    renderApp();
  }

  function clearCreatorOutput() {
    creatorOutput.value = '';
    setCreatorStatus('Creator output cleared.', 'idle');
    renderApp();
  }

  function loadArchiveExample() {
    const example = archiveExampleById(archiveExampleSelect.value);

    if (!example) {
      setArchiveStatus('Archive example is not available.', 'error');
      renderApp();
      return;
    }

    archiveHeroPayload.value = example.heroPayload;
    archiveLevelPayload.value = example.levelPayload;
    archiveOutput.value = '';
    setArchiveStatus(`Loaded example: ${example.label}.`, 'success', [
      { severity: 'info', message: example.description }
    ]);
    renderApp();
  }

  function inspectArchiveHero() {
    showArchiveReport(inspectLegacyHero(archiveHeroPayload.value));
  }

  function inspectArchiveLevel() {
    showArchiveReport(inspectLegacyLevel(archiveLevelPayload.value));
  }

  function roundTripArchiveHero() {
    const report = roundTripLegacyHero(archiveHeroPayload.value);

    archiveOutput.value = report.roundTripText ?? formatLegacyReport(report);
    setArchiveStatusFromReport(report, 'HERO round-trip complete.');
    renderApp();
  }

  function roundTripArchiveLevel() {
    const report = roundTripLegacyLevel(archiveLevelPayload.value);

    archiveOutput.value = report.roundTripText ?? formatLegacyReport(report);
    setArchiveStatusFromReport(report, 'LEVEL round-trip complete.');
    renderApp();
  }

  function inspectArchiveSnapshotPair() {
    showArchiveReport(
      inspectLegacySnapshotPair({
        heroPayload: archiveHeroPayload.value,
        levelPayload: archiveLevelPayload.value
      })
    );
  }

  function convertArchiveSnapshotPair() {
    try {
      const conversion = convertLegacySnapshotToRun(
        {
          heroPayload: archiveHeroPayload.value,
          levelPayload: archiveLevelPayload.value
        },
        Number(seedInput.value) || 1984
      );

      convertedHero = structuredClone(conversion.run.hero);
      convertedLevel = structuredClone(conversion.run.level);
      ensureOption(heroSelect, CONVERTED_HERO_VALUE, 'Converted Legacy Hero');
      ensureOption(levelSelect, CONVERTED_LEVEL_VALUE, 'Converted Legacy Snapshot');
      heroSelect.value = CONVERTED_HERO_VALUE;
      levelSelect.value = CONVERTED_LEVEL_VALUE;
      playKindSelect.value = 'single';
      playSession = { kind: 'single', game: Game.fromSerializedRun(conversion.run) };
      mode = 'play';
      lastChangedCells = [];
      lastEffectKind = 'idle';
      lastEffectStartedAtMs = uiClockMs;
      saveStatusMessage = 'Converted legacy snapshot. Save Run to persist.';
      spellChooser.hidden = true;
      archiveOutput.value = formatLegacyReport(
        inspectLegacySnapshotPair({
          heroPayload: archiveHeroPayload.value,
          levelPayload: archiveLevelPayload.value
        })
      );
      setArchiveStatus('Converted legacy snapshot into a modern run.', 'success', conversion.diagnostics);
      pushAppMessage('Converted legacy snapshot.');
      renderApp();
    } catch (error) {
      setArchiveStatus(getErrorMessage(error), 'error');
      renderApp();
    }
  }

  function clearArchive() {
    archiveHeroPayload.value = '';
    archiveLevelPayload.value = '';
    archiveOutput.value = '';
    setArchiveStatus('Archive payloads cleared.', 'idle');
    renderApp();
  }

  function showArchiveReport(report: LegacyPayloadReport) {
    archiveOutput.value = formatLegacyReport(report);
    setArchiveStatusFromReport(report, `${report.kind.toUpperCase()} inspection complete.`);
    renderApp();
  }

  function setArchiveStatusFromReport(report: LegacyPayloadReport, successMessage: string) {
    const hasError = report.diagnostics.some((entry) => entry.severity === 'error');

    setArchiveStatus(hasError ? 'Archive report contains errors.' : successMessage, hasError ? 'error' : 'success', report.diagnostics);
  }

  function setLegacyStatus(message: string, state: StatusState) {
    legacyStatus.textContent = message;
    legacyStatus.dataset.state = state;
  }

  function setEditorStatus(message: string, state: StatusState, validation?: EditorValidation) {
    editorStatus.textContent = message;
    editorStatus.dataset.state = state;

    if (!validation) {
      editorMessages.innerHTML = '';
      return;
    }

    const rows = [
      ...validation.errors.map((entry) => ({ kind: 'Error', entry })),
      ...validation.warnings.map((entry) => ({ kind: 'Warning', entry }))
    ];

    editorMessages.innerHTML = rows
      .map((row) => `<li><strong>${escapeHtml(row.kind)}:</strong> ${escapeHtml(row.entry)}</li>`)
      .join('');
  }

  function setCreatorStatus(message: string, state: StatusState, validation?: CreatorValidation) {
    creatorStatusMessage = message;
    creatorStatusState = state;

    if (!validation) {
      creatorMessageRows = [message];
      return;
    }

    creatorMessageRows = [
      ...validation.errors.map((entry) => `Error: ${entry}`),
      ...validation.warnings.map((entry) => `Warning: ${entry}`)
    ];

    if (creatorMessageRows.length === 0) {
      creatorMessageRows = [message];
    }
  }

  function setArchiveStatus(message: string, state: StatusState, diagnostics: LegacyDiagnostic[] = []) {
    archiveStatusMessage = message;
    archiveStatusState = state;
    archiveMessageRows =
      diagnostics.length > 0
        ? diagnostics.map((entry) => `${entry.severity.toUpperCase()}: ${entry.message}`)
        : [message];
  }

  function pushAppMessage(message: string) {
    appMessages = [...appMessages, message].slice(-4);
  }

  function renderMessages(baseMessages: string[]) {
    const externalMessages = appMessages.filter((message) => !baseMessages.includes(message));
    const messagesToShow = [...baseMessages, ...externalMessages].filter(
      (message) => message.length > 0
    );

    messages.innerHTML = messagesToShow
      .map((message) => `<li>${escapeHtml(message)}</li>`)
      .join('');
  }

  modePlayButton.addEventListener('click', () => {
    setMode('play');
  });
  modeEditorButton.addEventListener('click', () => {
    setMode('editor');
  });
  modeCreatorButton.addEventListener('click', () => {
    setMode('creator');
  });
  modeArchiveButton.addEventListener('click', () => {
    setMode('archive');
  });
  soundToggle.addEventListener('click', () => {
    toggleAudioPreference();
  });
  motionToggle.addEventListener('click', () => {
    toggleMotionPreference();
  });
  playKindSelect.addEventListener('change', () => {
    renderApp();
  });
  startButton.addEventListener('click', () => {
    startRun();
  });
  saveButton.addEventListener('click', () => {
    saveCurrentGame();
  });
  resumeButton.addEventListener('click', () => {
    loadCurrentGame(loadPlaySession());
  });
  commandGrid.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest('button[data-command]') : null;

    if (!(target instanceof HTMLButtonElement) || !target.dataset.command) {
      return;
    }

    performCommand(target.dataset.command as CommandId);
  });
  spellButtons.addEventListener('click', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLButtonElement) || !target.dataset.spellSlot) {
      return;
    }

    castSpellFromChooser(Number(target.dataset.spellSlot) as SpellSlot);
  });
  outcomeStartButton.addEventListener('click', () => {
    startRun();
  });
  outcomeContinueButton.addEventListener('click', () => {
    continueAdventure();
  });
  outcomeExportHeroButton.addEventListener('click', () => {
    exportHeroPayload();
  });
  outcomeExportLevelButton.addEventListener('click', () => {
    exportLevelPayload();
  });
  importHeroButton.addEventListener('click', () => {
    importHeroPayload();
  });
  importLevelButton.addEventListener('click', () => {
    importLevelPayload();
  });
  exportHeroButton.addEventListener('click', () => {
    exportHeroPayload();
  });
  exportLevelButton.addEventListener('click', () => {
    exportLevelPayload();
  });
  clearLegacyButton.addEventListener('click', () => {
    clearLegacyPayloads();
  });
  editorToolPalette.addEventListener('click', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLButtonElement) || !target.dataset.tool) {
      return;
    }

    setSelectedTool(target.dataset.tool as EditorTool);
  });
  editorNewButton.addEventListener('click', () => {
    resetEditorDraft();
  });
  editorEditSelectedButton.addEventListener('click', () => {
    editSelectedLevel();
  });
  editorValidateButton.addEventListener('click', () => {
    validateEditor();
  });
  editorPlayButton.addEventListener('click', () => {
    playAuthoredLevel();
  });
  editorExportJsonButton.addEventListener('click', () => {
    exportEditorJson();
  });
  editorExportLegacyButton.addEventListener('click', () => {
    exportEditorLegacy();
  });
  editorClearOutputButton.addEventListener('click', () => {
    clearEditorOutput();
  });
  creatorRollButton.addEventListener('click', () => {
    rollCreatorHero();
  });
  creatorNameInput.addEventListener('input', () => {
    creatorDraft = {
      ...creatorDraft,
      name: creatorNameInput.value
    };
  });
  creatorBargainOffer.addEventListener('input', () => {
    creatorDraft = {
      ...creatorDraft,
      bargainOffer: Number(creatorBargainOffer.value)
    };
  });
  creatorStats.addEventListener('click', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLButtonElement) || !target.dataset.stat || !target.dataset.delta) {
      return;
    }

    adjustCreator(target.dataset.stat as CreatorStatKey, Number(target.dataset.delta));
  });
  creatorStorePages.addEventListener('click', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLButtonElement) || !target.dataset.storePage) {
      return;
    }

    setCreatorStorePage(target.dataset.storePage as CreatorStorePage);
  });
  creatorStoreItems.addEventListener('click', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLButtonElement) || !target.dataset.slot || !target.dataset.purchaseMode) {
      return;
    }

    purchaseCreatorItem(Number(target.dataset.slot), target.dataset.purchaseMode as CreatorPurchaseMode);
  });
  creatorValidateButton.addEventListener('click', () => {
    validateCreator();
  });
  creatorPlayButton.addEventListener('click', () => {
    playCreatedHero();
  });
  creatorExportJsonButton.addEventListener('click', () => {
    exportCreatorJson();
  });
  creatorExportLegacyButton.addEventListener('click', () => {
    exportCreatorLegacy();
  });
  creatorClearOutputButton.addEventListener('click', () => {
    clearCreatorOutput();
  });
  archiveLoadExampleButton.addEventListener('click', () => {
    loadArchiveExample();
  });
  archiveInspectHeroButton.addEventListener('click', () => {
    inspectArchiveHero();
  });
  archiveInspectLevelButton.addEventListener('click', () => {
    inspectArchiveLevel();
  });
  archiveRoundTripHeroButton.addEventListener('click', () => {
    roundTripArchiveHero();
  });
  archiveRoundTripLevelButton.addEventListener('click', () => {
    roundTripArchiveLevel();
  });
  archiveInspectSnapshotButton.addEventListener('click', () => {
    inspectArchiveSnapshotPair();
  });
  archiveConvertSnapshotButton.addEventListener('click', () => {
    convertArchiveSnapshotPair();
  });
  archiveClearButton.addEventListener('click', () => {
    clearArchive();
  });

  let editorPointerDown = false;

  editorCanvas.addEventListener('pointerdown', (event) => {
    editorPointerDown = true;
    editorCanvas.setPointerCapture(event.pointerId);
    paintEditorFromEvent(event);
  });
  editorCanvas.addEventListener('pointermove', (event) => {
    if (!editorPointerDown) {
      return;
    }

    paintEditorFromEvent(event);
  });
  editorCanvas.addEventListener('pointerup', (event) => {
    editorPointerDown = false;
    editorCanvas.releasePointerCapture(event.pointerId);
  });
  editorCanvas.addEventListener('pointercancel', () => {
    editorPointerDown = false;
  });

  window.addEventListener('resize', () => {
    renderer.resize();
    editorRenderer.resize();
    renderApp();
  });

  window.addEventListener('keydown', (event) => {
    if (isFormEditingTarget(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 's') {
      performCommand('save');
      event.preventDefault();
      return;
    }

    if (key === 'c') {
      performCommand('conjure');
      event.preventDefault();
      return;
    }

    const mappedAction = mapKeyToAction(key);

    if (!mappedAction) {
      return;
    }

    event.preventDefault();
    performAction(mappedAction);
  });

  window.render_game_to_text = () =>
    renderGameToText(
      mode,
      playSession?.kind ?? selectedPlayKind(),
      lastSnapshot,
      lastAdventureSnapshot,
      lastPresentation,
      sensoryPreferences,
      lastEffectKind,
      currentEffectElapsedMs()
    );
  window.advanceTime = (ms = 0) => {
    uiClockMs += Math.max(0, ms);
    renderApp();
  };

  setEditorStatus('Paint a level, then validate or launch it.', 'idle', validateEditorDraft(editorDraft));
  renderApp();
}

function ensureOption(select: HTMLSelectElement, value: string, label: string) {
  const option = Array.from(select.options).find((entry) => entry.value === value);

  if (option) {
    option.text = label;
    return;
  }

  select.add(new Option(label, value));
}

function removeOption(select: HTMLSelectElement, value: string) {
  const option = Array.from(select.options).find((entry) => entry.value === value);

  option?.remove();
}

function mapKeyToAction(key: string): Action | null {
  switch (key) {
    case 'b':
      return { type: 'turnLeft' };
    case 'n':
      return { type: 'turnRight' };
    case 'm':
      return { type: 'moveForward' };
    case 'a':
      return { type: 'attack' };
    case 'g':
      return { type: 'get' };
    case 'p':
      return { type: 'useRestorative' };
    case 'r':
      return { type: 'reveal' };
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
      return { type: 'castSpell', slot: Number(key) as 1 | 2 | 3 | 4 | 5 | 6 };
    case '.':
      return { type: 'wait' };
    default:
      return null;
  }
}

function effectKindFromResult(action: Action, result: StepResult, runStatus: RunStatus): VisualEffectKind {
  if (runStatus === 'won') {
    return 'win';
  }

  if (runStatus === 'escaped') {
    return 'escape';
  }

  if (runStatus === 'dead') {
    return 'dead';
  }

  if (result.sounds.includes('trap')) {
    return 'trap';
  }

  if (result.sounds.includes('monster-hit')) {
    return 'damage';
  }

  if (result.sounds.includes('pickup')) {
    return 'pickup';
  }

  if (result.sounds.includes('spell') || action.type === 'castSpell') {
    return 'spell';
  }

  if (result.sounds.includes('bump')) {
    return 'bump';
  }

  return 'idle';
}

function isSpellButtonAvailable(hero: HeroState, slot: SpellSlot): boolean {
  const hasSource = slot <= 3 ? (hero.inventorySlots[17] ?? 0) > 0 : (hero.inventorySlots[18] ?? 0) > 0;

  return hasSource && hero.spellCharges[slot] > 0 && hero.stats.aura > 0;
}

function renderGameToText(
  mode: AppMode,
  sessionKind: PlayKind,
  snapshot: Snapshot | null,
  adventure: AdventureSnapshot | null,
  presentation: RunPresentation,
  sensoryPreferences: SensoryPreferences,
  visualEffect: VisualEffectKind,
  visualEffectElapsedMs: number
): string {
  return JSON.stringify({
    mode,
    sessionKind,
    runStatus: snapshot?.runStatus ?? 'not-started',
    adventure: adventure
      ? {
          id: adventure.definitionId,
          title: adventure.title,
          status: adventure.status,
          stage: adventure.stageIndex + 1,
          stageCount: adventure.stageCount,
          stageTitle: adventure.stageTitle,
          cumulativeTurns: adventure.cumulativeTurns
        }
      : null,
    hero: snapshot
      ? {
          name: snapshot.hero.name,
          position: snapshot.hero.position,
          facing: snapshot.hero.facing,
          strength: Math.floor(snapshot.hero.stats.strength),
          vitality: Math.floor(snapshot.hero.stats.vitality),
          aura: Math.floor(snapshot.hero.stats.aura),
          experience: Math.floor(snapshot.hero.stats.experience),
          exitExperienceTarget: snapshot.exitExperienceTarget,
          light: snapshot.hero.lightUses,
          salves: snapshot.hero.inventorySlots[23] ?? 0,
          potions: snapshot.hero.inventorySlots[24] ?? 0
        }
      : null,
    activeMonster: snapshot?.activeMonster
      ? {
          id: snapshot.activeMonster.id,
          position: snapshot.activeMonster.position,
          hp: Math.ceil(snapshot.activeMonster.hp)
        }
      : null,
    latestMessage: presentation.latestMessage,
    enabledCommands: presentation.commandStates
      .filter((command) => command.enabled)
      .map((command) => command.id),
    sensory: {
      audioEnabled: sensoryPreferences.audioEnabled,
      motionEnabled: sensoryPreferences.motionEnabled
    },
    visualEffect: {
      kind: visualEffect,
      elapsedMs: visualEffectElapsedMs,
      intensity: effectIntensity(visualEffect, visualEffectElapsedMs, sensoryPreferences.motionEnabled)
    },
    coordinateSystem: '0-based grid, origin top-left, x right, y down'
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Operation failed.';
}

function isFormEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
}
