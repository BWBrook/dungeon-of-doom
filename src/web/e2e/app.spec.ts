import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { clericStarter, createLegacyFriendlyLevelFixture } from '../src/engine/fixtures';
import {
  formatHeroString,
  formatLevelString,
  parseHeroString,
  parseLevelString
} from '../src/persist/legacy';
import { parseLevelDocument } from '../src/persist/levelDocument';

async function resetPage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function openEditor(page: Page) {
  await page.getByRole('button', { name: 'Editor' }).click();
  await expect(page.locator('[data-role="editor-mode"]')).toBeVisible();
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

test('imports legacy hero and level payloads, starts a run, and exports them again', async ({
  page
}) => {
  await resetPage(page);

  const heroPayload = formatHeroString(clericStarter);
  const levelPayload = formatLevelString(createLegacyFriendlyLevelFixture());

  await page.getByLabel('Hero Payload').fill(heroPayload);
  await page.getByRole('button', { name: 'Import Hero' }).click();
  await expect(page.locator('[data-role="hero-select"]')).toHaveValue(
    '__imported_legacy_hero__'
  );
  await expect(page.locator('[data-role="legacy-status"]')).toContainText('Imported hero');

  await page.getByLabel('Level Payload').fill(levelPayload);
  await page.getByRole('button', { name: 'Import Level' }).click();
  await expect(page.locator('[data-role="level-select"]')).toHaveValue(
    '__imported_legacy_level__'
  );
  await expect(page.locator('[data-role="legacy-status"]')).toContainText('Imported level');

  await page.getByRole('button', { name: 'Start Run' }).click();
  await expect(page.locator('.hud-row').filter({ hasText: 'AUR' }).locator('dd')).toContainText(
    '4'
  );

  await page.getByRole('button', { name: 'Export Hero' }).click();
  const exportedHero = await page.getByLabel('Hero Payload').inputValue();

  expect(parseHeroString(exportedHero).displayLabel).toBe(clericStarter.displayLabel);

  await page.getByRole('button', { name: 'Export Level' }).click();
  const exportedLevel = await page.getByLabel('Level Payload').inputValue();

  expect(parseLevelString(exportedLevel).startPosition).toEqual({ x: 0, y: 0 });
});

test('shows legacy import errors without adding imported options', async ({ page }) => {
  await resetPage(page);

  await page.getByLabel('Hero Payload').fill('bad');
  await page.getByRole('button', { name: 'Import Hero' }).click();

  await expect(page.locator('[data-role="legacy-status"]')).toContainText(
    'Legacy hero payload is too short.'
  );
  await expect(page.locator('.messages')).toContainText('Legacy hero payload is too short.');
  await expect(
    page.locator('[data-role="hero-select"] option', { hasText: 'Imported Legacy Hero' })
  ).toHaveCount(0);
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
  await expect(page.locator('[data-role="level-select"]')).toHaveValue(
    '__authored_editor_level__'
  );
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

  expect(parseLevelDocument(jsonOutput).level.startPosition).toEqual({ x: 7, y: 7 });

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

  await page.getByLabel('Level Payload').fill(levelPayload);
  await page.getByRole('button', { name: 'Import Level' }).click();
  await expect(page.locator('[data-role="level-select"]')).toHaveValue(
    '__imported_legacy_level__'
  );

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
