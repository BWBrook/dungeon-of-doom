import { heroFixtures, levelFixtures } from '../engine/fixtures';
import { Game, createGameInit, resetHeroRuntime } from '../engine/game';
import type { Action, SerializedRun } from '../engine/types';
import { loadRun, saveRun } from '../persist/save';
import { AudioEngine } from './audio';
import { DungeonRenderer } from './renderer';

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

  if (!heroSelect || !levelSelect || !seedInput || !startButton || !saveButton || !resumeButton || !canvas || !hud || !messages) {
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

  function renderCurrentGame() {
    if (!game) {
      hudEl.innerHTML = '<div class="empty-state">Choose a hero and level, then begin.</div>';
      messagesEl.innerHTML = '<li>The dungeon awaits.</li>';
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
    messagesEl.innerHTML = snapshot.messages.map((message) => `<li>${message}</li>`).join('');
    saveButtonEl.disabled = snapshot.runStatus !== 'playing';
    resumeButtonEl.disabled = loadRun() === null;
  }

  function buildNewGame() {
    const heroFixture = structuredClone(heroFixtures[heroSelectEl.value as keyof typeof heroFixtures]);
    const levelFixture = structuredClone(levelFixtures[levelSelectEl.value as keyof typeof levelFixtures]);
    const hero = resetHeroRuntime(heroFixture, levelFixture);
    const seed = Number(seedInputEl.value) || 1984;

    return new Game(createGameInit(hero, levelFixture, seed));
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

  window.addEventListener('resize', () => {
    renderer.resize();
    renderCurrentGame();
  });

  window.addEventListener('keydown', (event) => {
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
  return `<div class="hud-row"><dt>${label}</dt><dd>${value}</dd></div>`;
}
