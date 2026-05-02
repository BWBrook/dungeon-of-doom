import { expect, test } from '@playwright/test';

import { clericStarter, createLegacyFriendlyLevelFixture } from '../src/engine/fixtures';
import {
  formatHeroString,
  formatLevelString,
  parseHeroString,
  parseLevelString
} from '../src/persist/legacy';

test('runs the core browser checkpoint loop and resumes a saved run', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

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
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

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
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

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
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.locator('[data-role="level-select"]').selectOption('idol_finish_level');
  await page.getByRole('button', { name: 'Start Run' }).click();
  await page.keyboard.press('G');

  await expect(page.locator('.messages')).toContainText('THY QUEST IS OVER!');
  await expect(page.locator('.hud-row').filter({ hasText: 'RUN' }).locator('dd')).toContainText(
    'WON'
  );
});
