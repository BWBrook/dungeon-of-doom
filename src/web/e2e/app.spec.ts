import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { clericStarter, createLegacyFriendlyLevelFixture } from '../src/engine/fixtures';
import { tileKindToLegacyCode } from '../src/engine/catalog';
import type { BaseTileKind, LevelCell, LevelDefinition } from '../src/engine/types';
import {
  formatHeroString,
  formatLevelString,
  parseHeroString,
  parseLevelString
} from '../src/persist/legacy';

async function resetPage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function openEditor(page: Page) {
  await page.getByRole('button', { name: 'Editor' }).click();
  await expect(page.locator('[data-role="editor-mode"]')).toBeVisible();
}

async function openCreator(page: Page) {
  await page.getByRole('button', { name: 'Creator' }).click();
  await expect(page.locator('[data-role="creator-mode"]')).toBeVisible();
}

async function openArchive(page: Page) {
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(page.locator('[data-role="archive-mode"]')).toBeVisible();
}

async function chooseEditorTool(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
}

async function clickEditorCell(page: Page, x: number, y: number) {
  const canvas = page.locator('[data-role="editor-canvas"]');
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error('Editor canvas is not visible.');
  }

  await canvas.click({
    position: {
      x: ((x + 0.5) / 15) * box.width,
      y: ((y + 0.5) / 15) * box.height
    }
  });
}

function createCell(kind: BaseTileKind): LevelCell {
  return {
    kind,
    legacyCode: tileKindToLegacyCode(kind)
  };
}

function createExitGateLevel(): LevelDefinition {
  const cells = Array.from({ length: 225 }, () => createCell('floor'));

  cells[7 + 7 * 15] = createCell('entrance');
  cells[7 + 6 * 15] = createCell('exit');

  return {
    id: 8,
    width: 15,
    height: 15,
    cells,
    startPosition: { x: 7, y: 7 },
    authoredEntrancePosition: { x: 7, y: 7 },
    monsterSpawns: []
  };
}

async function clickCommand(page: Page, commandId: string) {
  await page.locator(`[data-command="${commandId}"]`).click();
}

test('runs the core browser checkpoint loop and resumes a saved run', async ({ page }) => {
  await resetPage(page);

  await page.locator('[data-role="hero-select"]').selectOption('cleric_starter');
  await page.locator('[data-role="level-select"]').selectOption('mixed_demo_level');
  await page.getByRole('button', { name: 'Start Run' }).click();

  await expect(page.getByRole('heading', { name: 'Dungeon of Doom' })).toBeVisible();
  await page.keyboard.press('G');
  await page.keyboard.press('R');
  await page.keyboard.press('A');
  await page.keyboard.press('1');
  await page.keyboard.press('M');
  await page.keyboard.press('S');

  await expect(page.getByRole('button', { name: 'Resume Saved' })).toBeEnabled();
  await page.getByRole('button', { name: 'Resume Saved' }).click();
  await expect(page.locator('.messages li').first()).toBeVisible();
  await expect(page.locator('.hud-row').filter({ hasText: 'RUN' }).locator('dd')).toContainText(
    'PLAYING'
  );
});

test('uses the polished command surface and reports playable text state', async ({ page }) => {
  await resetPage(page);

  await page.locator('[data-role="hero-select"]').selectOption('warrior_starter');
  await page.locator('[data-role="level-select"]').selectOption('mixed_demo_level');
  await page.getByRole('button', { name: 'Start Run' }).click();

  await expect(page.locator('[data-role="run-headline"]')).toContainText('Rogan');
  await clickCommand(page, 'get');
  await expect(page.locator('[data-role="latest-event"]')).toContainText(
    'THOU FINDEST RESTORATIVES'
  );

  await clickCommand(page, 'reveal');
  await expect(page.locator('[data-command="attack"]')).toBeEnabled();
  await clickCommand(page, 'attack');
  await clickCommand(page, 'turnRight');
  await clickCommand(page, 'turnLeft');
  await clickCommand(page, 'wait');
  await clickCommand(page, 'restore');
  await clickCommand(page, 'save');
  await expect(page.locator('[data-role="save-status"]')).toContainText('Saved turn');

  const textState = await page.evaluate(() => window.render_game_to_text?.() ?? '');
  const parsed = JSON.parse(textState) as {
    mode: string;
    runStatus: string;
    hero: { position: { x: number; y: number }; facing: string };
    enabledCommands: string[];
    latestMessage: string;
    sensory: { audioEnabled: boolean; motionEnabled: boolean };
    visualEffect: { kind: string; elapsedMs: number; intensity: number };
  };

  expect(parsed.mode).toBe('play');
  expect(parsed.runStatus).toBe('playing');
  expect(parsed.hero.position).toEqual({ x: 7, y: 7 });
  expect(parsed.hero.facing).toBe('N');
  expect(parsed.enabledCommands).toContain('save');
  expect(parsed.latestMessage.length).toBeGreaterThan(0);
  expect(parsed.sensory.audioEnabled).toBe(true);
  expect(parsed.visualEffect.kind).toBe('save');

  await page.getByRole('button', { name: 'Resume Saved' }).click();
  await expect(page.locator('[data-role="save-status"]')).toContainText('Resumed saved turn');
});

test('persists sensory toggles and reports them for browser playtests', async ({ page }) => {
  await resetPage(page);

  const initial = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')) as {
    sensory: { audioEnabled: boolean; motionEnabled: boolean };
  };

  await page.locator('[data-role="sound-toggle"]').click();
  await page.locator('[data-role="motion-toggle"]').click();

  const toggled = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? '{}')) as {
    sensory: { audioEnabled: boolean; motionEnabled: boolean };
  };

  expect(toggled.sensory.audioEnabled).toBe(!initial.sensory.audioEnabled);
  expect(toggled.sensory.motionEnabled).toBe(!initial.sensory.motionEnabled);

  await page.reload();

  const afterReload = JSON.parse(
    await page.evaluate(() => window.render_game_to_text?.() ?? '{}')
  ) as {
    sensory: { audioEnabled: boolean; motionEnabled: boolean };
  };

  expect(afterReload.sensory).toEqual(toggled.sensory);
  await expect(page.locator('[data-role="sound-toggle"]')).toHaveAttribute(
    'aria-pressed',
    String(toggled.sensory.audioEnabled)
  );
  await expect(page.locator('[data-role="motion-toggle"]')).toHaveAttribute(
    'aria-pressed',
    String(toggled.sensory.motionEnabled)
  );
});

test('imports legacy hero and level payloads, starts a run, and exports them again', async ({
  page
}) => {
  await resetPage(page);

  const heroPayload = formatHeroString(clericStarter);
  const levelPayload = formatLevelString(createLegacyFriendlyLevelFixture());

  await page.locator('[data-role="hero-payload"]').fill(heroPayload);
  await page.getByRole('button', { name: 'Import Hero' }).click();
  await expect(page.locator('[data-role="hero-select"]')).toHaveValue('__imported_legacy_hero__');
  await expect(page.locator('[data-role="legacy-status"]')).toContainText('Imported hero');

  await page.locator('[data-role="level-payload"]').fill(levelPayload);
  await page.getByRole('button', { name: 'Import Level' }).click();
  await expect(page.locator('[data-role="level-select"]')).toHaveValue('__imported_legacy_level__');
  await expect(page.locator('[data-role="legacy-status"]')).toContainText('Imported level');

  await page.getByRole('button', { name: 'Start Run' }).click();
  await expect(page.locator('.hud-row').filter({ hasText: 'AUR' }).locator('dd')).toContainText(
    '4'
  );

  await page.getByRole('button', { name: 'Export Hero' }).click();
  const exportedHero = await page.locator('[data-role="hero-payload"]').inputValue();

  expect(parseHeroString(exportedHero).displayLabel).toBe(clericStarter.displayLabel);

  await page.getByRole('button', { name: 'Export Level' }).click();
  const exportedLevel = await page.locator('[data-role="level-payload"]').inputValue();

  expect(parseLevelString(exportedLevel).startPosition).toEqual({ x: 0, y: 0 });
});

test('opens conjure with C and casts from the spell chooser', async ({ page }) => {
  await resetPage(page);

  await page.locator('[data-role="hero-select"]').selectOption('cleric_starter');
  await page.locator('[data-role="level-select"]').selectOption('mixed_demo_level');
  await page.getByRole('button', { name: 'Start Run' }).click();
  await page.keyboard.press('C');

  await expect(page.locator('[data-role="spell-chooser"]')).toBeVisible();
  await page.locator('[data-spell-slot="4"]').click();
  await expect(page.locator('[data-role="latest-event"]')).toContainText(
    'POWER SURGES WITHIN THEE'
  );
});

test('shows legacy import errors without adding imported options', async ({ page }) => {
  await resetPage(page);

  await page.locator('[data-role="hero-payload"]').fill('bad');
  await page.getByRole('button', { name: 'Import Hero' }).click();

  await expect(page.locator('[data-role="legacy-status"]')).toContainText(
    'Legacy hero payload is too short.'
  );
  await expect(page.locator('.messages')).toContainText('Legacy hero payload is too short.');
  await expect(
    page.locator('[data-role="hero-select"] option', { hasText: 'Imported Legacy Hero' })
  ).toHaveCount(0);
});

test('inspects bundled archive HERO and LEVEL examples', async ({ page }) => {
  await resetPage(page);
  await openArchive(page);

  await page.locator('[data-role="archive-example-select"]').selectOption('starter-hero');
  await page.getByRole('button', { name: 'Load Example' }).click();
  await page.getByRole('button', { name: 'Inspect Hero' }).click();
  await expect(page.locator('[data-role="archive-status"]')).toContainText(
    'HERO inspection complete.'
  );
  await expect(page.locator('[data-role="archive-output"]')).toHaveValue(/Legacy HERO Report/);
  await expect(page.locator('[data-role="archive-output"]')).toHaveValue(/Display label:/);

  await page.locator('[data-role="archive-example-select"]').selectOption('authored-level');
  await page.getByRole('button', { name: 'Load Example' }).click();
  await page.getByRole('button', { name: 'Inspect Level' }).click();
  await expect(page.locator('[data-role="archive-output"]')).toHaveValue(/Legacy LEVEL Report/);
  await expect(page.locator('[data-role="archive-output"]')).toHaveValue(/Metadata coordinates:/);
});

test('round-trips archive examples into parseable raw payload output', async ({ page }) => {
  await resetPage(page);
  await openArchive(page);

  await page.locator('[data-role="archive-example-select"]').selectOption('starter-hero');
  await page.getByRole('button', { name: 'Load Example' }).click();
  await page.getByRole('button', { name: 'Round-Trip Hero' }).click();
  const heroOutput = await page.locator('[data-role="archive-output"]').inputValue();

  expect(parseHeroString(heroOutput).displayLabel).toContain('Rogan');

  await page.locator('[data-role="archive-example-select"]').selectOption('record-chunked-level');
  await page.getByRole('button', { name: 'Load Example' }).click();
  await page.getByRole('button', { name: 'Round-Trip Level' }).click();
  const levelOutput = await page.locator('[data-role="archive-output"]').inputValue();

  expect(parseLevelString(levelOutput).cells).toHaveLength(225);
});

test('converts an archive snapshot pair into a modern playable run', async ({ page }) => {
  await resetPage(page);
  await openArchive(page);

  await page.locator('[data-role="archive-example-select"]').selectOption('snapshot-pair');
  await page.getByRole('button', { name: 'Load Example' }).click();
  await page.getByRole('button', { name: 'Inspect Snapshot Pair' }).click();
  await expect(page.locator('[data-role="archive-output"]')).toHaveValue(/Legacy SNAPSHOT Report/);
  await expect(page.locator('[data-role="archive-output"]')).toHaveValue(/lossy/);

  await page.getByRole('button', { name: 'Convert Snapshot To Run' }).click();
  await expect(page.locator('[data-role="play-mode"]')).toBeVisible();
  await expect(page.locator('[data-role="level-select"]')).toHaveValue(
    '__converted_legacy_snapshot_level__'
  );
  await expect(page.locator('[data-role="save-status"]')).toContainText(
    'Converted legacy snapshot'
  );

  const textState = JSON.parse(
    await page.evaluate(() => window.render_game_to_text?.() ?? '{}')
  ) as {
    hero: { position: { x: number; y: number } };
    runStatus: string;
  };

  expect(textState.runStatus).toBe('playing');
  expect(textState.hero.position).toEqual({ x: 7, y: 6 });
});

test('archive errors do not mutate the active play run', async ({ page }) => {
  await resetPage(page);

  await page.getByRole('button', { name: 'Start Run' }).click();

  const before = await page.evaluate(() => window.render_game_to_text?.() ?? '');

  await openArchive(page);
  await page.locator('[data-role="archive-hero-payload"]').fill('bad');
  await page.getByRole('button', { name: 'Inspect Hero' }).click();
  await expect(page.locator('[data-role="archive-status"]')).toContainText(
    'Archive report contains errors.'
  );
  await expect(
    page.locator('[data-role="level-select"] option', { hasText: 'Converted Legacy Snapshot' })
  ).toHaveCount(0);

  await page.getByRole('button', { name: 'Play', exact: true }).click();

  const after = await page.evaluate(() => window.render_game_to_text?.() ?? '');

  expect(JSON.parse(after).hero.position).toEqual(JSON.parse(before).hero.position);
});

test('can win immediately on the idol fixture', async ({ page }) => {
  await resetPage(page);

  await page.locator('[data-role="level-select"]').selectOption('idol_finish_level');
  await page.getByRole('button', { name: 'Start Run' }).click();
  await page.keyboard.press('G');

  await expect(page.locator('.messages')).toContainText('THY QUEST IS OVER!');
  await expect(page.locator('.hud-row').filter({ hasText: 'RUN' }).locator('dd')).toContainText(
    'WON'
  );
  await expect(page.locator('[data-role="outcome-panel"]')).toBeVisible();
  await expect(page.locator('[data-role="outcome-title"]')).toContainText('Quest Complete');
  await expect(page.locator('[data-role="outcome-body"]')).toContainText('Score');
});

test('shows exit gating feedback in the polished play shell', async ({ page }) => {
  await resetPage(page);

  await page.locator('[data-role="level-payload"]').fill(formatLevelString(createExitGateLevel()));
  await page.getByRole('button', { name: 'Import Level' }).click();
  await page.getByRole('button', { name: 'Start Run' }).click();
  await clickCommand(page, 'moveForward');

  await expect(page.locator('[data-role="latest-event"]')).toContainText('YOU NEED EXPERIENCE');
  await expect(page.locator('[data-role="run-subline"]')).toContainText('exploring');
});

test('paints an editor level, validates it, and launches play from the authored level', async ({
  page
}) => {
  await resetPage(page);
  await openEditor(page);

  await chooseEditorTool(page, 'Wall');
  await clickEditorCell(page, 2, 2);
  await chooseEditorTool(page, 'Vase');
  await clickEditorCell(page, 4, 4);
  await chooseEditorTool(page, 'Monster I');
  await clickEditorCell(page, 5, 5);
  await chooseEditorTool(page, 'Idol');
  await clickEditorCell(page, 6, 6);
  await chooseEditorTool(page, 'Start');
  await clickEditorCell(page, 7, 7);

  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.locator('[data-role="editor-status"]')).toContainText(
    'Level validates for play.'
  );
  await expect(page.locator('[data-role="editor-messages"]')).not.toContainText('Error');

  await page.getByRole('button', { name: 'Play Authored Level' }).click();
  await expect(page.locator('[data-role="play-mode"]')).toBeVisible();
  await expect(page.locator('[data-role="level-select"]')).toHaveValue('__authored_editor_level__');
  await expect(page.locator('.hud-row').filter({ hasText: 'RUN' }).locator('dd')).toContainText(
    'PLAYING'
  );
});

test('exports editor levels as modern JSON and legacy level payloads', async ({ page }) => {
  await resetPage(page);
  await openEditor(page);

  await chooseEditorTool(page, 'Monster I');
  await clickEditorCell(page, 5, 5);
  await chooseEditorTool(page, 'Idol');
  await clickEditorCell(page, 6, 6);

  await page.getByRole('button', { name: 'Export JSON' }).click();
  const jsonOutput = await page.locator('[data-role="editor-output"]').inputValue();

  const levelDocument = JSON.parse(jsonOutput) as {
    kind: string;
    version: number;
    level: LevelDefinition;
  };

  expect(levelDocument.kind).toBe('dungeon-of-doom.level');
  expect(levelDocument.version).toBe(1);
  expect(levelDocument.level.startPosition).toEqual({ x: 7, y: 7 });

  await page.getByRole('button', { name: 'Export Legacy Level' }).click();
  const legacyOutput = await page.locator('[data-role="editor-output"]').inputValue();

  expect(parseLevelString(legacyOutput).monsterSpawns[0]?.legacyTileCode).toBe(111);
});

test('blocks invalid editor play and export with visible errors', async ({ page }) => {
  await resetPage(page);
  await openEditor(page);

  await chooseEditorTool(page, 'Start');
  await clickEditorCell(page, 0, 0);
  await page.getByRole('button', { name: 'Play Authored Level' }).click();

  await expect(page.locator('[data-role="editor-status"]')).toContainText(
    'Cannot play this level yet.'
  );
  await expect(page.locator('[data-role="editor-messages"]')).toContainText(
    'Start must be on floor, entrance, or safe tile.'
  );
  await expect(
    page.locator('[data-role="level-select"] option', { hasText: 'Authored Editor Level' })
  ).toHaveCount(0);

  await page.getByRole('button', { name: 'Export JSON' }).click();
  await expect(page.locator('[data-role="editor-status"]')).toContainText(
    'Cannot export JSON until blocking errors are fixed.'
  );
});

test('loads an imported legacy level into the editor and exports it again', async ({ page }) => {
  await resetPage(page);

  const levelPayload = formatLevelString(createLegacyFriendlyLevelFixture());

  await page.locator('[data-role="level-payload"]').fill(levelPayload);
  await page.getByRole('button', { name: 'Import Level' }).click();
  await expect(page.locator('[data-role="level-select"]')).toHaveValue('__imported_legacy_level__');

  await openEditor(page);
  await page.getByRole('button', { name: 'Edit Selected Level' }).click();
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.locator('[data-role="editor-status"]')).toContainText(
    'Level validates for play.'
  );

  await page.getByRole('button', { name: 'Export Legacy Level' }).click();
  const exported = await page.locator('[data-role="editor-output"]').inputValue();

  expect(parseLevelString(exported).startPosition).toEqual({ x: 0, y: 0 });
});

test('creates a hero, exports modern and legacy payloads, and launches play', async ({ page }) => {
  await resetPage(page);
  await openCreator(page);

  await page.getByLabel('Hero Name').fill('Mira');
  await page.getByRole('button', { name: 'Raise STR' }).click();
  await page.getByRole('button', { name: 'Emporium' }).click();

  const salve = page.locator('.store-item', { hasText: 'healing salve' });

  await salve.getByRole('button', { name: 'Buy' }).click();
  await expect(page.locator('[data-role="creator-status"]')).toContainText('Tis yours.');
  await expect(salve).toContainText('Owned 1');

  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.locator('[data-role="creator-status"]')).toContainText(
    'Hero validates for play.'
  );

  await page.getByRole('button', { name: 'Export JSON' }).click();
  const jsonOutput = await page.locator('[data-role="creator-output"]').inputValue();

  const heroDocument = JSON.parse(jsonOutput) as {
    kind: string;
    version: number;
    hero: { name: string };
  };

  expect(heroDocument.kind).toBe('dungeon-of-doom.hero');
  expect(heroDocument.version).toBe(1);
  expect(heroDocument.hero.name).toBe('Mira');

  await page.getByRole('button', { name: 'Export Legacy Hero' }).click();
  const legacyOutput = await page.locator('[data-role="creator-output"]').inputValue();

  expect(parseHeroString(legacyOutput).name).toBe('Mira');

  await page.getByRole('button', { name: 'Play Created Hero' }).click();
  await expect(page.locator('[data-role="play-mode"]')).toBeVisible();
  await expect(page.locator('[data-role="hero-select"]')).toHaveValue('__created_creator_hero__');
  await expect(page.locator('.hud-row').filter({ hasText: 'RUN' }).locator('dd')).toContainText(
    'PLAYING'
  );
});

test('blocks invalid created heroes and visible forbidden purchases', async ({ page }) => {
  await resetPage(page);
  await openCreator(page);

  await page.getByRole('button', { name: 'Buy' }).first().click();
  await expect(page.locator('[data-role="creator-status"]')).toContainText('Not for wanderer.');

  const firstItem = page.locator('.store-item').first();

  await expect(firstItem).toContainText('Owned 0');

  await page.getByLabel('Hero Name').fill('');
  await page.getByRole('button', { name: 'Play Created Hero' }).click();
  await expect(page.locator('[data-role="creator-status"]')).toContainText(
    'Cannot play this hero yet.'
  );
  await expect(page.locator('[data-role="creator-messages"]')).toContainText(
    'Hero name is required.'
  );

  await page.getByRole('button', { name: 'Export Legacy Hero' }).click();
  await expect(page.locator('[data-role="creator-status"]')).toContainText(
    'Cannot export legacy hero until blocking errors are fixed.'
  );
});

test('stacks creator restoratives and preserves mode switching', async ({ page }) => {
  await resetPage(page);
  await openCreator(page);

  await page.getByRole('button', { name: 'Emporium' }).click();

  const salve = page.locator('.store-item', { hasText: 'healing salve' });

  await salve.getByRole('button', { name: 'Buy' }).click();
  await salve.getByRole('button', { name: 'Buy' }).click();
  await expect(salve).toContainText('Owned 2');

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('[data-role="play-mode"]')).toBeVisible();
  await page.getByRole('button', { name: 'Editor' }).click();
  await expect(page.locator('[data-role="editor-mode"]')).toBeVisible();
  await page.getByRole('button', { name: 'Creator' }).click();
  await expect(page.locator('[data-role="creator-mode"]')).toBeVisible();
  await expect(salve).toContainText('Owned 2');
});

test('keeps the upgraded shell usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await resetPage(page);

  await page.getByRole('button', { name: 'Start Run' }).click();
  await expect(page.locator('[data-role="canvas"]')).toBeVisible();
  await expect(page.locator('[data-command="moveForward"]')).toBeVisible();
  await expect(page.locator('[data-role="sound-toggle"]')).toBeVisible();
  await expect(page.locator('[data-role="motion-toggle"]')).toBeVisible();

  await page.getByRole('button', { name: 'Editor' }).click();
  await expect(page.locator('[data-role="editor-canvas"]')).toBeVisible();
  await page.getByRole('button', { name: 'Creator' }).click();
  await expect(page.getByRole('button', { name: 'Roll Hero' })).toBeVisible();
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByRole('button', { name: 'Inspect Hero' })).toBeVisible();
});
