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
import type { Action, HeroState, LevelDefinition, SerializedRun } from '../engine/types';
import { formatHeroString, formatLevelString, parseHeroString, parseLevelString } from '../persist/legacy';
import { formatHeroDocument } from '../persist/heroDocument';
import { formatLevelDocument } from '../persist/levelDocument';
import { loadRun, saveRun } from '../persist/save';
import { AudioEngine } from './audio';
import { EditorRenderer } from './editorRenderer';
import { DungeonRenderer } from './renderer';

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

export function mountApp(root: HTMLDivElement) {
  root.innerHTML = `
    <main class="shell">
      <section class="hero-copy">
        <p class="eyebrow">Browser rebuild checkpoint</p>
        <h1>Dungeon of Doom</h1>
        <p class="lede">
          A deterministic first slice: pure engine underneath, symbolic retro shell on top.
        </p>
      </section>
      <nav class="mode-switch" aria-label="Application mode">
        <button data-role="mode-play-button" type="button">Play</button>
        <button data-role="mode-editor-button" type="button">Editor</button>
        <button data-role="mode-creator-button" type="button">Creator</button>
      </nav>
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
            <section class="panel">
              <h2>Status</h2>
              <dl class="hud" data-role="hud"></dl>
            </section>
            <section class="panel">
              <h2>Controls</h2>
              <p>B turn left, N turn right, M move, A attack, G get, P restore, R reveal, 1-6 cast, . wait, S save.</p>
            </section>
            <section class="panel">
              <h2>Messages</h2>
              <ol class="messages" data-role="messages" aria-live="polite"></ol>
            </section>
          </aside>
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
  const hud = requireElement(root, '[data-role="hud"]', HTMLDListElement);
  const messages = requireElement(root, '[data-role="messages"]', HTMLOListElement);
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

  heroSelect.value = HERO_OPTIONS[0].value;
  levelSelect.value = LEVEL_OPTIONS[0].value;

  const renderer = new DungeonRenderer(canvas);
  const editorRenderer = new EditorRenderer(editorCanvas);
  const audio = new AudioEngine();
  let mode: AppMode = 'play';
  let game: Game | null = null;
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

  function renderApp() {
    renderMode();
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
      hud.innerHTML = '<div class="empty-state">Choose a hero and level, then begin.</div>';
      renderMessages(['The dungeon awaits.']);
      const previewGame = buildNewGame();

      renderer.draw(previewGame.snapshot());
      saveButton.disabled = true;
      resumeButton.disabled = loadRun() === null;
      return;
    }

    const snapshot = game.snapshot();

    renderer.draw(snapshot);
    hud.innerHTML = `
      ${renderStat('STR', Math.floor(snapshot.hero.stats.strength))}
      ${renderStat('VIT', Math.floor(snapshot.hero.stats.vitality))}
      ${renderStat('AUR', Math.floor(snapshot.hero.stats.aura))}
      ${renderStat('EXP', Math.floor(snapshot.hero.stats.experience))}
      ${renderStat('FACE', snapshot.hero.facing)}
      ${renderStat('RUN', snapshot.runStatus.toUpperCase())}
      ${renderStat('LIGHT', snapshot.hero.lightUses)}
      ${renderStat('SPELL 1', snapshot.hero.spellCharges[1])}
      ${renderStat('SPELL 4', snapshot.hero.spellCharges[4])}
      ${renderStat('TREASURE', snapshot.hero.treasure)}
      ${renderStat('ACTIVE', snapshot.activeMonster ? `${snapshot.activeMonster.hp.toFixed(1)} HP` : 'NONE')}
      ${renderStat('SCORE', snapshot.score ?? '--')}
    `;
    renderMessages(snapshot.messages);
    saveButton.disabled = snapshot.runStatus !== 'playing';
    resumeButton.disabled = loadRun() === null;
  }

  function renderEditor() {
    editorRenderer.draw(editorDraft);

    for (const button of editorToolPalette.querySelectorAll<HTMLButtonElement>('button[data-tool]')) {
      button.setAttribute('aria-pressed', String(button.dataset.tool === editorDraft.selectedTool));
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
    renderApp();
  }

  function saveCurrentGame() {
    if (!game) {
      return;
    }

    const run = game.serializeRun();

    saveRun(run);
    audio.playAll(['save']);
    renderApp();
  }

  function loadCurrentGame(serialized: SerializedRun | null) {
    if (!serialized) {
      return;
    }

    game = Game.fromSerializedRun(serialized);
    renderApp();
  }

  function performAction(action: Action) {
    if (!game || mode !== 'play') {
      return;
    }

    const result = game.step(action);

    audio.playAll(result.sounds);
    renderApp();
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
  startButton.addEventListener('click', () => {
    startRun();
  });
  saveButton.addEventListener('click', () => {
    saveCurrentGame();
  });
  resumeButton.addEventListener('click', () => {
    loadCurrentGame(loadRun());
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
      saveCurrentGame();
      return;
    }

    const mappedAction = mapKeyToAction(key);

    if (!mappedAction) {
      return;
    }

    event.preventDefault();
    performAction(mappedAction);
  });

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
