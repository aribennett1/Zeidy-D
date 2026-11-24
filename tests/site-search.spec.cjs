const { test, expect } = require('@playwright/test');

test('search shows highlighted context, opens sheet, and retains query', async ({ page }) => {
  await page.goto('/');
  const overlaps = await page.evaluate(() => {
    const title = document.querySelector('.top-header h1').getBoundingClientRect();
    const button = document.getElementById('site-search-open').getBoundingClientRect();
    return title.left < button.right && title.right > button.left && title.top < button.bottom && title.bottom > button.top;
  });
  expect(overlaps).toBe(false);
  await page.getByRole('button', { name: 'Search sheets', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const query = page.getByRole('searchbox', { name: 'Search by topic, name, parsha, or year' });
  await query.fill('Noach');
  await expect(dialog.locator('.search-result').first()).toBeVisible();
  await expect(dialog.locator('mark').first()).toContainText(/noach/i);
  const first = dialog.locator('.search-result a').first();
  const destination = await first.getAttribute('href');
  await first.click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(new RegExp(destination.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
  await page.getByRole('button', { name: 'Search sheets', exact: true }).click();
  await expect(query).toHaveValue('Noach');
  await expect(dialog.locator('.search-result').first()).toBeVisible();
  await query.fill('zzzznonexistentzzzz');
  await expect(dialog.getByRole('status')).toContainText('No sheets found');
  await page.getByRole('button', { name: 'Close search' }).click();
  await expect(dialog).not.toBeVisible();
});

test('search retries a failed index request', async ({ page }) => {
  await page.route('**/search-index.json', route => route.fulfill({ status: 503, body: '' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Search sheets', exact: true }).click();
  const query = page.getByRole('searchbox');
  await query.fill('Noach');
  await expect(page.getByRole('button', { name: 'Retry search' })).toBeVisible();
  await page.unroute('**/search-index.json');
  await page.getByRole('button', { name: 'Retry search' }).click();
  await expect(page.locator('.search-result').first()).toBeVisible();
});

test('finds passages inside Word documents and ignores Hebrew vowel marks', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search sheets', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const input = page.getByRole('searchbox');
  await input.fill('intimating');
  await expect(dialog.locator('.search-excerpt mark').first()).toHaveText(/intimating/i);
  await expect(dialog.locator('.search-excerpt').first()).toContainText('Rashi');
  await input.fill('תולדותיהם');
  await expect(dialog.locator('.search-excerpt mark').first()).toBeVisible();
  await expect(dialog.locator('.search-excerpt').first()).toContainText('תּוֹלְדוֹתֵיהֶם');
});
