const { test, expect } = require('@playwright/test');
async function focusSearch(page) {
  const nav = page.locator('#nav');
  if (await page.locator('#nav-toggle').isVisible() && !(await nav.evaluate(n => n.classList.contains('open')))) {
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
  }
  const input = page.getByRole('searchbox', { name: 'Search by topic, name, parsha, or year', exact: true });
  await input.focus();
  await expect(nav).toHaveClass(/search-expanded/);
  return input;
}
test('sidebar expands on focus, styles results, opens sheet, and retains query', async ({ page }, testInfo) => {
  await page.goto('/');
  const query = await focusSearch(page);
  await query.fill('Noach');
  const result = page.locator('.search-result').first();
  await expect(result).toBeVisible();
  await expect(result.locator('mark').first()).toContainText(/noach/i);
  await expect(page.locator('#nav-tree')).toBeHidden();
  expect(await result.evaluate(n => getComputedStyle(n).borderRadius)).toBe('12px');
  const width = await page.locator('#nav').evaluate(n => n.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(280);
  await page.screenshot({ path: testInfo.outputPath('sidebar-search.png') });
  const link = result.locator('a');
  const destination = await link.getAttribute('href');
  await link.click();
  await expect(page.locator('#nav')).not.toHaveClass(/search-expanded/);
  expect(new URL(page.url()).pathname).toBe(destination);
  await focusSearch(page);
  await expect(query).toHaveValue('Noach');
  await expect(result).toBeVisible();
  await query.fill('zzzznonexistentzzzz');
  await expect(page.locator('.search-status')).toContainText('No sheets found');
  await page.getByRole('button', { name: 'Close search' }).click();
  await expect(page.locator('#nav-tree')).toBeVisible();
  await expect(page.locator('.search-body')).toBeHidden();
});
test('search retries a failed index request', async ({ page }) => {
  await page.route('**/search-index.json', route => route.fulfill({ status: 503, body: '' }));
  await page.goto('/');
  const query = await focusSearch(page);
  await query.fill('Noach');
  await expect(page.getByRole('button', { name: 'Retry search' })).toBeVisible();
  await page.unroute('**/search-index.json');
  await page.getByRole('button', { name: 'Retry search' }).click();
  await expect(page.locator('.search-result').first()).toBeVisible();
});
test('finds passages inside Word documents and ignores Hebrew vowel marks', async ({ page }) => {
  await page.goto('/');
  const input = await focusSearch(page);
  await input.fill('intimating');
  await expect(page.locator('.search-excerpt mark').first()).toHaveText(/intimating/i);
  await expect(page.locator('.search-excerpt').first()).toContainText('Rashi');
  await input.fill('תולדותיהם');
  await expect(page.locator('.search-excerpt mark').first()).toBeVisible();
  await expect(page.locator('.search-excerpt').first()).toContainText('תּוֹלְדוֹתֵיהֶם');
});
test('Done and outside clicks restore navigation without losing the search', async ({ page }) => {
  await page.goto('/');
  const query = await focusSearch(page);
  await query.fill('Pesach');
  await expect(page.locator('.search-result').first()).toBeVisible();
  await page.getByRole('button', { name: 'Close search' }).click();
  await expect(page.locator('#nav')).not.toHaveClass(/search-expanded/);
  await query.focus();
  await expect(page.locator('.search-result').first()).toBeVisible();
  await page.locator('.top-header h1').click();
  await expect(page.locator('#nav')).not.toHaveClass(/search-expanded/);
});
