import {
  ADJUSTABLE_CREATOR_STAT_KEYS,
  CREATOR_STORE_PAGES,
  adjustCreatorStat,
  attemptCreatorPurchase,
  createDefaultCreatorDraft,
  heroFromCreatorDraft,
  itemsForCreatorPage,
  validateCreatorDraft
} from '../creator/model';
import type {
  CreatorDraft,
  CreatorPurchaseMode,
  CreatorStatKey,
  CreatorStorePage,
  CreatorValidation
} from '../creator/model';
import {
  CLASS_LABELS,
  SPELL_NAMES,
  deriveClassId
} from '../engine/catalog';
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
import { Game, createGameInit, resetHeroRuntime } from '../engine/game';
import type {
  Action,
  HeroState,
  LevelDefinition,
  RunStatus,
  SerializedRun,
  Snapshot,
  SpellSlot,
  StepResult
} from '../engine/types';
import { formatHeroString, formatLevelString, parseHeroString, parseLevelString } from '../persist/legacy';
import { formatHeroDocument } from '../persist/heroDocument';
import { formatLevelDocument } from '../persist/levelDocument';
import { loadRun, saveRun } from '../persist/save';
import { AudioEngine } from './audio';
import { EditorRenderer } from './editorRenderer';
import { DungeonRenderer } from './renderer';
import { createRunPresentation } from './runPresentation';
import type { CommandId, RunPresentation } from './runPresentation';
import { loadSensoryPreferences, saveSensoryPreferences } from './sensoryPreferences';
import type { SensoryPreferences } from './sensoryPreferences';
import { effectIntensity } from './visualEffects';
import type { VisualEffectKind } from './visualCatalog';

const IMPORTED_HERO_VALUE = '__imported_legacy_hero__';
const CREATED_HERO_VALUE = '__created_creator_hero__';
const IMPORTED_LEVEL_VALUE = '__imported_legacy_level__';
const AUTHORED_LEVEL_VALUE = '__authored_editor_level__';

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

type AppMode = 'play' | 'editor' | 'creator';
type StatusState = 'idle' | 'success' | 'error';

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
  root.innerHTML = `
    <main class="shell">
      <section class="hero-copy">
        <p class="eyebrow">Lamp-lit terminal edition</p>
        <h1>Dungeon of Doom</h1>
        <p class="lede">
          Beneath ruined Crekkan, the engine keeps the rules and the terminal keeps the torch.
        </p>
      </section>
      <section class="top-chrome">
        <nav class="mode-switch" aria-label="Application mode">
          <button data-role="mode-play-button" type="button">Play</button>
          <button data-role="mode-editor-button" type="button">Editor</button>
          <button data-role="mode-creator-button" type="button">Creator</button>
        </nav>
        <div class="sensory-controls" aria-label="Sensory controls">
          <button data-role="sound-toggle" type="button" aria-pressed="true">Sound On</button>
          <button data-role="motion-toggle" type="button" aria-pressed="true">Motion On</button>
        </div>
      </section>
      <section data-role="play-mode">
        <section class="toolbar">
          <label>
            Hero
            <select data-role="hero-select"></select>
          </label>
          <label>
            Level
            <select data-role="level-select"></select>
          </label>
          <label>
            Seed
            <input data-role="seed-input" type="number" min="1" step="1" value="1984" />
          </label>
          <button data-role="start-button" type="button">Start Run</button>
          <button data-role="save-button" type="button">Save Run</button>
          <button data-role="resume-button" type="button">Resume Saved</button>
        </section>
        <section class="playframe">
          <div class="canvas-frame">
            <canvas data-role="canvas" aria-label="Dungeon grid"></canvas>
          </div>
          <aside class="sidebar">
            <section class="panel run-brief">
              <p class="run-kicker" data-role="run-subline">Select a hero and level.</p>
              <h2 data-role="run-headline">Choose thy quest</h2>
              <p class="latest-event" data-role="latest-event" aria-live="polite">The dungeon awaits.</p>
            </section>
            <section class="panel">
              <h2>Status</h2>
              <dl class="hud" data-role="hud"></dl>
            </section>
            <section class="panel command-panel">
              <h2>Commands</h2>
              <div class="command-grid" data-role="command-grid"></div>
              <div class="spell-chooser" data-role="spell-chooser" hidden>
                <p>Choose a spell from thy lore.</p>
                <div data-role="spell-buttons"></div>
              </div>
              <p class="save-status" data-role="save-status" aria-live="polite">No run saved this session.</p>
            </section>
            <section class="panel">
              <h2>Controls</h2>
              <p>B/N turn, M move, A attack, G get, P restore, R reveal, C conjure, 1-6 quick-cast, . wait, S save.</p>
            </section>
            <section class="panel">
              <h2>Messages</h2>
              <ol class="messages" data-role="messages" aria-live="polite"></ol>
            </section>
          </aside>
        </section>
        <section class="panel outcome-panel" data-role="outcome-panel" hidden>
          <div>
            <p class="run-kicker" data-role="outcome-subline">Run complete</p>
            <h2 data-role="outcome-title">Outcome</h2>
            <p data-role="outcome-body"></p>
          </div>
          <div class="outcome-actions">
            <button data-role="outcome-start-button" type="button">Start Run</button>
            <button data-role="outcome-export-hero-button" type="button">Export Hero</button>
            <button data-role="outcome-export-level-button" type="button">Export Level</button>
          </div>
        </section>
        <section class="panel legacy-panel" aria-labelledby="legacy-heading">
          <div class="legacy-header">
            <h2 id="legacy-heading">Legacy Interop</h2>
            <p class="legacy-status" data-role="legacy-status" data-state="idle" aria-live="polite">
              Paste packed HERO or LEVEL text to import archival data.
            </p>
          </div>
          <div class="legacy-grid">
            <label class="payload-field">
              Hero Payload
              <textarea data-role="hero-payload" spellcheck="false" rows="5"></textarea>
            </label>
            <label class="payload-field">
              Level Payload
              <textarea data-role="level-payload" spellcheck="false" rows="5"></textarea>
            </label>
          </div>
          <div class="legacy-actions">
            <button data-role="import-hero-button" type="button">Import Hero</button>
            <button data-role="import-level-button" type="button">Import Level</button>
            <button data-role="export-hero-button" type="button">Export Hero</button>
            <button data-role="export-level-button" type="button">Export Level</button>
            <button data-role="clear-legacy-button" type="button">Clear Legacy</button>
          </div>
        </section>
      </section>
      <section data-role="editor-mode" hidden>
        <section class="editor-workbench">
          <div class="canvas-frame editor-canvas-frame">
            <canvas data-role="editor-canvas" aria-label="Dungeon editor grid"></canvas>
          </div>
          <aside class="sidebar editor-sidebar">
            <section class="panel">
              <h2>Editor Tools</h2>
              <div class="tool-palette" data-role="editor-tool-palette"></div>
            </section>
            <section class="panel">
              <h2>Editor Controls</h2>
              <div class="editor-actions">
                <button data-role="editor-new-button" type="button">New Level</button>
                <button data-role="editor-edit-selected-button" type="button">Edit Selected Level</button>
                <button data-role="editor-validate-button" type="button">Validate</button>
                <button data-role="editor-play-button" type="button">Play Authored Level</button>
                <button data-role="editor-export-json-button" type="button">Export JSON</button>
                <button data-role="editor-export-legacy-button" type="button">Export Legacy Level</button>
                <button data-role="editor-clear-output-button" type="button">Clear Editor Output</button>
              </div>
            </section>
            <section class="panel">
              <h2>Editor Status</h2>
              <p class="editor-status" data-role="editor-status" data-state="idle" aria-live="polite">
                Paint a level, then validate or launch it.
              </p>
              <ul class="editor-messages" data-role="editor-messages"></ul>
            </section>
          </aside>
        </section>
        <section class="panel editor-output-panel" aria-labelledby="editor-output-heading">
          <h2 id="editor-output-heading">Editor Output</h2>
          <textarea data-role="editor-output" spellcheck="false" rows="7"></textarea>
        </section>
      </section>
      <section data-role="creator-mode" hidden>
        <section class="creator-workbench">
          <section class="panel creator-panel">
            <h2>Roll Hero</h2>
            <div class="creator-form">
              <label>
                Creator Seed
                <input data-role="creator-seed-input" type="number" min="1" step="1" value="1984" />
              </label>
              <label>
                Hero Name
                <input data-role="creator-name-input" maxlength="10" value="Hero" />
              </label>
              <button data-role="creator-roll-button" type="button">Roll Hero</button>
            </div>
            <dl class="creator-summary" data-role="creator-summary"></dl>
            <div class="stat-editor" data-role="creator-stats"></div>
          </section>
          <section class="panel creator-shop-panel">
            <h2>Shop</h2>
            <div class="store-pages" data-role="creator-store-pages"></div>
            <label class="creator-offer">
              Bargain Offer
              <input data-role="creator-bargain-offer" type="number" min="0" step="1" value="0" />
            </label>
            <div class="store-items" data-role="creator-store-items"></div>
          </section>
          <aside class="sidebar creator-sidebar">
            <section class="panel">
              <h2>Creator Controls</h2>
              <div class="creator-actions">
                <button data-role="creator-validate-button" type="button">Validate</button>
                <button data-role="creator-play-button" type="button">Play Created Hero</button>
                <button data-role="creator-export-json-button" type="button">Export JSON</button>
                <button data-role="creator-export-legacy-button" type="button">Export Legacy Hero</button>
                <button data-role="creator-clear-output-button" type="button">Clear Creator Output</button>
              </div>
            </section>
            <section class="panel">
              <h2>Creator Status</h2>
              <p class="creator-status" data-role="creator-status" data-state="idle" aria-live="polite">
                Roll a hero, spend points, buy gear, then launch.
              </p>
              <ul class="creator-messages" data-role="creator-messages"></ul>
            </section>
          </aside>
        </section>
        <section class="panel creator-output-panel" aria-labelledby="creator-output-heading">
          <h2 id="creator-output-heading">Creator Output</h2>
          <textarea data-role="creator-output" spellcheck="false" rows="7"></textarea>
        </section>
      </section>
    </main>
  `;

  const modePlayButton = requireElement(root, '[data-role="mode-play-button"]', HTMLButtonElement);
  const modeEditorButton = requireElement(root, '[data-role="mode-editor-button"]', HTMLButtonElement);
  const modeCreatorButton = requireElement(root, '[data-role="mode-creator-button"]', HTMLButtonElement);
  const soundToggle = requireElement(root, '[data-role="sound-toggle"]', HTMLButtonElement);
  const motionToggle = requireElement(root, '[data-role="motion-toggle"]', HTMLButtonElement);
  const playModePanel = requireElement(root, '[data-role="play-mode"]', HTMLElement);
  const editorModePanel = requireElement(root, '[data-role="editor-mode"]', HTMLElement);
  const creatorModePanel = requireElement(root, '[data-role="creator-mode"]', HTMLElement);
  const heroSelect = requireElement(root, '[data-role="hero-select"]', HTMLSelectElement);
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
  const outcomePanel = requireElement(root, '[data-role="outcome-panel"]', HTMLElement);
  const outcomeSubline = requireElement(root, '[data-role="outcome-subline"]', HTMLParagraphElement);
  const outcomeTitle = requireElement(root, '[data-role="outcome-title"]', HTMLHeadingElement);
  const outcomeBody = requireElement(root, '[data-role="outcome-body"]', HTMLParagraphElement);
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

  for (const option of HERO_OPTIONS) {
    heroSelect.add(new Option(option.label, option.value));
  }

  for (const option of LEVEL_OPTIONS) {
    levelSelect.add(new Option(option.label, option.value));
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
  levelSelect.value = LEVEL_OPTIONS[0].value;

  const renderer = new DungeonRenderer(canvas);
  const editorRenderer = new EditorRenderer(editorCanvas);
  const audio = new AudioEngine();
  let sensoryPreferences: SensoryPreferences = loadSensoryPreferences();
  let mode: AppMode = 'play';
  let game: Game | null = null;
  let lastSnapshot: Snapshot | null = null;
  let lastPresentation: RunPresentation = createRunPresentation(null, null);
  let lastChangedCells: Array<{ x: number; y: number }> = [];
  let lastEffectKind: VisualEffectKind = 'idle';
  let lastEffectStartedAtMs = 0;
  let uiClockMs = 0;
  let saveStatusMessage = 'No run saved this session.';
  let importedHero: HeroState | null = null;
  let createdHero: HeroState | null = null;
  let importedLevel: LevelDefinition | null = null;
  let authoredLevel: LevelDefinition | null = null;
  let editorDraft: EditorDraft = createDefaultEditorDraft();
  let creatorDraft: CreatorDraft = createDefaultCreatorDraft(Number(creatorSeedInput.value) || 1984);
  let creatorStatusMessage = 'Roll a hero, spend points, buy gear, then launch.';
  let creatorStatusState: StatusState = 'idle';
  let creatorMessageRows: string[] = [];
  let appMessages: string[] = [];

  audio.setEnabled(sensoryPreferences.audioEnabled);

  function renderApp() {
    renderMode();
    renderSensoryControls();
    renderCurrentGame();
    renderEditor();
    renderCreator();
  }

  function renderMode() {
    playModePanel.hidden = mode !== 'play';
    editorModePanel.hidden = mode !== 'editor';
    creatorModePanel.hidden = mode !== 'creator';
    modePlayButton.setAttribute('aria-pressed', String(mode === 'play'));
    modeEditorButton.setAttribute('aria-pressed', String(mode === 'editor'));
    modeCreatorButton.setAttribute('aria-pressed', String(mode === 'creator'));

    if (mode === 'editor') {
      editorRenderer.resize();
    } else if (mode === 'play') {
      renderer.resize();
    }
  }

  function renderCurrentGame() {
    if (!game) {
      lastSnapshot = null;
      lastPresentation = createRunPresentation(null, null, ['The dungeon awaits.', ...appMessages]);
      renderRunPresentation(lastPresentation);
      const previewGame = buildNewGame();

      renderer.draw(previewGame.snapshot(), {
        changedCells: [],
        effect: 'idle',
        elapsedMs: 0,
        motionEnabled: sensoryPreferences.motionEnabled
      });
      saveButton.disabled = true;
      resumeButton.disabled = loadRun() === null;
      outcomePanel.hidden = true;
      return;
    }

    const snapshot = game.snapshot();
    const level = game.serializeRun().level;
    const presentation = createRunPresentation(snapshot, level, appMessages);

    lastSnapshot = snapshot;
    lastPresentation = presentation;
    renderer.draw(snapshot, {
      changedCells: lastChangedCells,
      effect: lastEffectKind,
      elapsedMs: currentEffectElapsedMs(),
      motionEnabled: sensoryPreferences.motionEnabled
    });
    renderRunPresentation(presentation);
    saveButton.disabled = snapshot.runStatus !== 'playing';
    resumeButton.disabled = loadRun() === null;
    renderOutcome(presentation, snapshot);
  }

  function renderEditor() {
    editorRenderer.draw(editorDraft);

    for (const button of editorToolPalette.querySelectorAll<HTMLButtonElement>('button[data-tool]')) {
      button.setAttribute('aria-pressed', String(button.dataset.tool === editorDraft.selectedTool));
    }
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

  function renderOutcome(presentation: RunPresentation, snapshot: NonNullable<typeof lastSnapshot>) {
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

  function renderCreator() {
    const classId = deriveClassId(creatorDraft.stats);

    creatorSeedInput.value = String(creatorDraft.seed);
    creatorNameInput.value = creatorDraft.name;
    creatorBargainOffer.value = String(creatorDraft.bargainOffer);
    creatorSummary.innerHTML = `
      ${renderStat('CLASS', CLASS_LABELS[classId].toUpperCase())}
      ${renderStat('GOLD', creatorDraft.gold)}
      ${renderStat('POINTS', creatorDraft.modificationPoints)}
      ${renderStat('SEED', creatorDraft.seed)}
    `;
    creatorStats.innerHTML = `
      ${ADJUSTABLE_CREATOR_STAT_KEYS.map(
        (stat) => `
          <div class="stat-control">
            <span>${escapeHtml(formatStatLabel(stat))}</span>
            <button data-stat="${stat}" data-delta="-1" type="button" aria-label="Lower ${escapeHtml(formatStatLabel(stat))}">-</button>
            <strong>${creatorDraft.stats[stat]}</strong>
            <button data-stat="${stat}" data-delta="1" type="button" aria-label="Raise ${escapeHtml(formatStatLabel(stat))}">+</button>
          </div>
        `
      ).join('')}
      <div class="stat-control stat-control-locked">
        <span>EXP</span>
        <em>fixed</em>
        <strong>${creatorDraft.stats.experience}</strong>
      </div>
    `;

    for (const button of creatorStorePages.querySelectorAll<HTMLButtonElement>('button[data-store-page]')) {
      button.setAttribute('aria-pressed', String(button.dataset.storePage === creatorDraft.selectedStorePage));
    }

    creatorStoreItems.innerHTML = itemsForCreatorPage(creatorDraft.selectedStorePage)
      .map((item) => {
        const owned = creatorDraft.inventorySlots[item.slot] ?? 0;
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
    creatorStatus.textContent = creatorStatusMessage;
    creatorStatus.dataset.state = creatorStatusState;
    creatorMessages.innerHTML = creatorMessageRows
      .map((message) => `<li>${escapeHtml(message)}</li>`)
      .join('');
  }

  function buildNewGame() {
    const heroFixture = resolveSelectedHero();
    const levelFixture = resolveSelectedLevel();
    const hero = resetHeroRuntime(heroFixture, levelFixture);
    const seed = Number(seedInput.value) || 1984;

    return new Game(createGameInit(hero, levelFixture, seed));
  }

  function resolveSelectedHero(): HeroState {
    if (heroSelect.value === IMPORTED_HERO_VALUE && importedHero) {
      return structuredClone(importedHero);
    }

    if (heroSelect.value === CREATED_HERO_VALUE && createdHero) {
      return structuredClone(createdHero);
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
      const hero = game ? game.serializeRun().hero : resolveSelectedHero();

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
      const level = game ? game.serializeRun().level : resolveSelectedLevel();

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
    game = buildNewGame();
    lastChangedCells = [];
    lastEffectKind = 'idle';
    lastEffectStartedAtMs = uiClockMs;
    saveStatusMessage = 'Run started. No save yet.';
    spellChooser.hidden = true;
    renderApp();
  }

  function saveCurrentGame() {
    if (!game) {
      return;
    }

    const run = game.serializeRun();

    saveRun(run);
    audio.playAll(['save']);
    saveStatusMessage = `Saved turn ${run.turnCount}.`;
    lastEffectKind = 'save';
    lastEffectStartedAtMs = uiClockMs;
    renderApp();
  }

  function loadCurrentGame(serialized: SerializedRun | null) {
    if (!serialized) {
      return;
    }

    game = Game.fromSerializedRun(serialized);
    lastChangedCells = [];
    lastEffectKind = 'idle';
    lastEffectStartedAtMs = uiClockMs;
    saveStatusMessage = `Resumed saved turn ${serialized.turnCount}.`;
    spellChooser.hidden = true;
    renderApp();
  }

  function performAction(action: Action) {
    if (!game || mode !== 'play') {
      return;
    }

    const result = game.step(action);

    lastChangedCells = result.cellsChanged;
    lastEffectKind = effectKindFromResult(action, result, game.snapshot().runStatus);
    lastEffectStartedAtMs = uiClockMs;
    spellChooser.hidden = true;
    audio.playAll(result.sounds);
    renderApp();
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
    mode = 'play';
    game = buildNewGame();
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
    mode = 'play';
    game = buildNewGame();
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

  function pushAppMessage(message: string) {
    appMessages = [...appMessages, message].slice(-4);
  }

  function renderMessages(baseMessages: string[]) {
    const messagesToShow = [...baseMessages, ...appMessages].filter((message) => message.length > 0);

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
  soundToggle.addEventListener('click', () => {
    toggleAudioPreference();
  });
  motionToggle.addEventListener('click', () => {
    toggleMotionPreference();
  });
  startButton.addEventListener('click', () => {
    startRun();
  });
  saveButton.addEventListener('click', () => {
    saveCurrentGame();
  });
  resumeButton.addEventListener('click', () => {
    loadCurrentGame(loadRun());
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
      lastSnapshot,
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
  snapshot: Snapshot | null,
  presentation: RunPresentation,
  sensoryPreferences: SensoryPreferences,
  visualEffect: VisualEffectKind,
  visualEffectElapsedMs: number
): string {
  return JSON.stringify({
    mode,
    runStatus: snapshot?.runStatus ?? 'not-started',
    hero: snapshot
      ? {
          name: snapshot.hero.name,
          position: snapshot.hero.position,
          facing: snapshot.hero.facing,
          strength: Math.floor(snapshot.hero.stats.strength),
          vitality: Math.floor(snapshot.hero.stats.vitality),
          aura: Math.floor(snapshot.hero.stats.aura),
          experience: Math.floor(snapshot.hero.stats.experience),
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

function formatStatLabel(stat: CreatorStatKey) {
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

function renderStat(label: string, value: string | number) {
  return `<div class="hud-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

function requireElement<T extends HTMLElement>(
  root: ParentNode,
  selector: string,
  constructor: new (...args: never[]) => T
): T {
  const element = root.querySelector(selector);

  if (!(element instanceof constructor)) {
    throw new Error(`App UI failed to initialize: ${selector}`);
  }

  return element;
}
