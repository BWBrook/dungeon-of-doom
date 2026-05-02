import { heroFixtures, levelFixtures } from '../engine/fixtures';
import { Game, createGameInit, resetHeroRuntime } from '../engine/game';
import type { Action, HeroState, LevelDefinition, SerializedRun } from '../engine/types';
import { formatHeroString, formatLevelString, parseHeroString, parseLevelString } from '../persist/legacy';
import { loadRun, saveRun } from '../persist/save';
import { AudioEngine } from './audio';
import { DungeonRenderer } from './renderer';

const IMPORTED_HERO_VALUE = '__imported_legacy_hero__';
const IMPORTED_LEVEL_VALUE = '__imported_legacy_level__';

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
    </main>
  `;

  const heroSelect = root.querySelector<HTMLSelectElement>('[data-role="hero-select"]');
  const levelSelect = root.querySelector<HTMLSelectElement>('[data-role="level-select"]');
  const seedInput = root.querySelector<HTMLInputElement>('[data-role="seed-input"]');
  const startButton = root.querySelector<HTMLButtonElement>('[data-role="start-button"]');
  const saveButton = root.querySelector<HTMLButtonElement>('[data-role="save-button"]');
  const resumeButton = root.querySelector<HTMLButtonElement>('[data-role="resume-button"]');
  const canvas = root.querySelector<HTMLCanvasElement>('[data-role="canvas"]');
  const hud = root.querySelector<HTMLDListElement>('[data-role="hud"]');
  const messages = root.querySelector<HTMLOListElement>('[data-role="messages"]');
  const heroPayload = root.querySelector<HTMLTextAreaElement>('[data-role="hero-payload"]');
  const levelPayload = root.querySelector<HTMLTextAreaElement>('[data-role="level-payload"]');
  const legacyStatus = root.querySelector<HTMLParagraphElement>('[data-role="legacy-status"]');
  const importHeroButton = root.querySelector<HTMLButtonElement>('[data-role="import-hero-button"]');
  const importLevelButton = root.querySelector<HTMLButtonElement>('[data-role="import-level-button"]');
  const exportHeroButton = root.querySelector<HTMLButtonElement>('[data-role="export-hero-button"]');
  const exportLevelButton = root.querySelector<HTMLButtonElement>('[data-role="export-level-button"]');
  const clearLegacyButton = root.querySelector<HTMLButtonElement>('[data-role="clear-legacy-button"]');

  if (
    !heroSelect ||
    !levelSelect ||
    !seedInput ||
    !startButton ||
    !saveButton ||
    !resumeButton ||
    !canvas ||
    !hud ||
    !messages ||
    !heroPayload ||
    !levelPayload ||
    !legacyStatus ||
    !importHeroButton ||
    !importLevelButton ||
    !exportHeroButton ||
    !exportLevelButton ||
    !clearLegacyButton
  ) {
    throw new Error('App UI failed to initialize.');
  }

  const heroSelectEl = heroSelect;
  const levelSelectEl = levelSelect;
  const seedInputEl = seedInput;
  const startButtonEl = startButton;
  const saveButtonEl = saveButton;
  const resumeButtonEl = resumeButton;
  const hudEl = hud;
  const messagesEl = messages;
  const heroPayloadEl = heroPayload;
  const levelPayloadEl = levelPayload;
  const legacyStatusEl = legacyStatus;
  const importHeroButtonEl = importHeroButton;
  const importLevelButtonEl = importLevelButton;
  const exportHeroButtonEl = exportHeroButton;
  const exportLevelButtonEl = exportLevelButton;
  const clearLegacyButtonEl = clearLegacyButton;

  for (const option of HERO_OPTIONS) {
    heroSelectEl.add(new Option(option.label, option.value));
  }

  for (const option of LEVEL_OPTIONS) {
    levelSelectEl.add(new Option(option.label, option.value));
  }

  heroSelectEl.value = HERO_OPTIONS[0].value;
  levelSelectEl.value = LEVEL_OPTIONS[0].value;

  const renderer = new DungeonRenderer(canvas);
  const audio = new AudioEngine();
  let game: Game | null = null;
  let importedHero: HeroState | null = null;
  let importedLevel: LevelDefinition | null = null;
  let appMessages: string[] = [];

  function renderCurrentGame() {
    if (!game) {
      hudEl.innerHTML = '<div class="empty-state">Choose a hero and level, then begin.</div>';
      renderMessages(['The dungeon awaits.']);
      const previewGame = buildNewGame();
      renderer.draw(previewGame.snapshot());
      saveButtonEl.disabled = true;
      resumeButtonEl.disabled = loadRun() === null;
      return;
    }

    const snapshot = game.snapshot();

    renderer.draw(snapshot);
    hudEl.innerHTML = `
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
    saveButtonEl.disabled = snapshot.runStatus !== 'playing';
    resumeButtonEl.disabled = loadRun() === null;
  }

  function buildNewGame() {
    const heroFixture = resolveSelectedHero();
    const levelFixture = resolveSelectedLevel();
    const hero = resetHeroRuntime(heroFixture, levelFixture);
    const seed = Number(seedInputEl.value) || 1984;

    return new Game(createGameInit(hero, levelFixture, seed));
  }

  function resolveSelectedHero(): HeroState {
    if (heroSelectEl.value === IMPORTED_HERO_VALUE && importedHero) {
      return structuredClone(importedHero);
    }

    const hero = heroFixtures[heroSelectEl.value as keyof typeof heroFixtures];

    if (!hero) {
      throw new Error('Selected hero is not available.');
    }

    return structuredClone(hero);
  }

  function resolveSelectedLevel(): LevelDefinition {
    if (levelSelectEl.value === IMPORTED_LEVEL_VALUE && importedLevel) {
      return structuredClone(importedLevel);
    }

    const level = levelFixtures[levelSelectEl.value as keyof typeof levelFixtures];

    if (!level) {
      throw new Error('Selected level is not available.');
    }

    return structuredClone(level);
  }

  function importHeroPayload() {
    try {
      const hero = parseHeroString(heroPayloadEl.value);

      importedHero = hero;
      ensureOption(heroSelectEl, IMPORTED_HERO_VALUE, 'Imported Legacy Hero');
      heroSelectEl.value = IMPORTED_HERO_VALUE;
      setLegacyStatus(`Imported hero: ${hero.displayLabel}`, 'success');
      pushAppMessage('Imported legacy hero.');
      renderCurrentGame();
    } catch (error) {
      const message = getErrorMessage(error);

      setLegacyStatus(message, 'error');
      pushAppMessage(message);
      renderCurrentGame();
    }
  }

  function importLevelPayload() {
    try {
      const level = parseLevelString(levelPayloadEl.value);

      importedLevel = level;
      ensureOption(levelSelectEl, IMPORTED_LEVEL_VALUE, 'Imported Legacy Level');
      levelSelectEl.value = IMPORTED_LEVEL_VALUE;
      setLegacyStatus(`Imported level ${level.id}.`, 'success');
      pushAppMessage('Imported legacy level.');
      renderCurrentGame();
    } catch (error) {
      const message = getErrorMessage(error);

      setLegacyStatus(message, 'error');
      pushAppMessage(message);
      renderCurrentGame();
    }
  }

  function exportHeroPayload() {
    try {
      const hero = game ? game.serializeRun().hero : resolveSelectedHero();

      heroPayloadEl.value = formatHeroString(hero);
      setLegacyStatus(`Exported hero: ${hero.displayLabel}`, 'success');
      pushAppMessage('Exported legacy hero.');
      renderCurrentGame();
    } catch (error) {
      const message = getErrorMessage(error);

      setLegacyStatus(message, 'error');
      pushAppMessage(message);
      renderCurrentGame();
    }
  }

  function exportLevelPayload() {
    try {
      const level = game ? game.serializeRun().level : resolveSelectedLevel();

      levelPayloadEl.value = formatLevelString(level);
      setLegacyStatus(`Exported level ${level.id}.`, 'success');
      pushAppMessage('Exported legacy level.');
      renderCurrentGame();
    } catch (error) {
      const message = getErrorMessage(error);

      setLegacyStatus(message, 'error');
      pushAppMessage(message);
      renderCurrentGame();
    }
  }

  function clearLegacyPayloads() {
    importedHero = null;
    importedLevel = null;
    heroPayloadEl.value = '';
    levelPayloadEl.value = '';
    removeOption(heroSelectEl, IMPORTED_HERO_VALUE);
    removeOption(levelSelectEl, IMPORTED_LEVEL_VALUE);
    heroSelectEl.value = HERO_OPTIONS[0].value;
    levelSelectEl.value = LEVEL_OPTIONS[0].value;
    setLegacyStatus('Legacy imports cleared.', 'idle');
    pushAppMessage('Legacy imports cleared.');
    renderCurrentGame();
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

  function setLegacyStatus(message: string, state: 'idle' | 'success' | 'error') {
    legacyStatusEl.textContent = message;
    legacyStatusEl.dataset.state = state;
  }

  function pushAppMessage(message: string) {
    appMessages = [...appMessages, message].slice(-4);
  }

  function renderMessages(baseMessages: string[]) {
    const messagesToShow = [...baseMessages, ...appMessages].filter((message) => message.length > 0);

    messagesEl.innerHTML = messagesToShow
      .map((message) => `<li>${escapeHtml(message)}</li>`)
      .join('');
  }

  function saveCurrentGame() {
    if (!game) {
      return;
    }

    const run = game.serializeRun();

    saveRun(run);
    audio.playAll(['save']);
    renderCurrentGame();
  }

  function loadCurrentGame(serialized: SerializedRun | null) {
    if (!serialized) {
      return;
    }

    game = Game.fromSerializedRun(serialized);
    renderCurrentGame();
  }

  function performAction(action: Action) {
    if (!game) {
      return;
    }

    const result = game.step(action);

    audio.playAll(result.sounds);
    renderCurrentGame();
  }

  startButtonEl.addEventListener('click', () => {
    game = buildNewGame();
    renderCurrentGame();
  });
  saveButtonEl.addEventListener('click', () => {
    saveCurrentGame();
  });
  resumeButtonEl.addEventListener('click', () => {
    loadCurrentGame(loadRun());
  });
  importHeroButtonEl.addEventListener('click', () => {
    importHeroPayload();
  });
  importLevelButtonEl.addEventListener('click', () => {
    importLevelPayload();
  });
  exportHeroButtonEl.addEventListener('click', () => {
    exportHeroPayload();
  });
  exportLevelButtonEl.addEventListener('click', () => {
    exportLevelPayload();
  });
  clearLegacyButtonEl.addEventListener('click', () => {
    clearLegacyPayloads();
  });

  window.addEventListener('resize', () => {
    renderer.resize();
    renderCurrentGame();
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

  renderCurrentGame();
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
  return error instanceof Error ? error.message : 'Legacy interop failed.';
}

function isFormEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
}
