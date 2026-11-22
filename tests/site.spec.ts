import { expect, test } from '@playwright/test';

test('user finds canonical models by an external ID and filters their actual specifications @site', async ({
  page,
}) => {
  // Given the actual SSG catalogue with canonical rows and explicit external IDs.
  await page.goto('/');
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  const initial = await table.locator('tbody tr:visible').count();
  expect(initial).toBeGreaterThan(900);
  // When a user searches an upstream identity and then switches to image generation.
  await page
    .getByRole('searchbox', { name: 'Search models' })
    .fill('openai/gpt-5');
  await expect(
    table.getByRole('link', { name: 'GPT-5', exact: true }),
  ).toBeVisible();
  expect(await table.locator('tbody tr:visible').count()).toBeLessThan(initial);
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await page
    .getByRole('combobox', { name: 'Task', exact: true })
    .selectOption('image-generation');
  // Then only matching canonical models remain, without prices or provider columns.
  const rows = table.locator('tbody tr:visible');
  expect(await rows.count()).toBeGreaterThan(0);
  const displayed = await rows.allInnerTexts();
  expect(
    displayed.filter((text) => !text.includes('Image generation')),
  ).toEqual([]);
  const headers = table.locator('thead');
  await expect(
    headers.getByRole('columnheader', { name: 'Price', exact: true }),
  ).toHaveCount(0);
  await expect(
    headers.getByRole('columnheader', { name: 'Providers', exact: true }),
  ).toHaveCount(0);
});
test('user sorts token limits and sees a useful empty state @site', async ({
  page,
}) => {
  // Given the static model table and unknown values among its records.
  await page.goto('/');
  // When the user sorts by context size and searches for a missing identity.
  await page.getByRole('button', { name: 'Context', exact: false }).click();
  const column = page.getByRole('columnheader', {
    name: 'Context',
    exact: false,
  });
  await expect(column).toHaveAttribute('aria-sort', 'descending');
  const first = page.locator('tbody tr:visible').first();
  const value = await first.locator('td').nth(4).textContent();
  expect(Number(value?.replaceAll(',', ''))).toBeGreaterThan(100000);
  await page.getByRole('searchbox').fill('no-such-model-exact-fixture');
  // Then the user sees zero results rather than a fabricated matching model.
  await expect(
    page.getByRole('heading', { name: 'No models match your filters.' }),
  ).toBeVisible();
  await expect(page.locator('#result-count')).toHaveText('0');
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.locator('tbody tr:visible').first()).toBeVisible();
});
test('user changes language while preserving filters and the page anchor on a narrow screen @site', async ({
  page,
}) => {
  // Given a Chinese route with an explicit filter, query and anchor.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/zh/?task=image-generation#models');
  await expect(
    page.getByRole('heading', { name: '开放模型数据库', exact: true }),
  ).toBeVisible();
  // When the user chooses English from the language control.
  await page
    .getByRole('combobox', { name: '语言', exact: true })
    .selectOption('/');
  await page.waitForURL(
    (url) =>
      url.pathname === '/' &&
      url.searchParams.get('task') === 'image-generation' &&
      url.hash === '#models',
  );
  // Then URL language, active filters, the visible table and AI discovery remain consistent.
  await expect(
    page.getByRole('combobox', { name: 'Task', exact: true }),
  ).toHaveValue('image-generation');
  await expect(
    page.getByRole('link', { name: 'For AI / llms.txt' }),
  ).toHaveAttribute('href', '/llms.txt');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: '.cache/site/mobile.png', fullPage: true });
});
