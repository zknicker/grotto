import { signInAsClerkHuman } from '../support/clerk-session.ts';
import { expect, test } from '../support/test.ts';

test('a Clerk-authenticated human creates a Server and lands in #all', async ({ page }) => {
    await signInAsClerkHuman(page);
    await page.goto('/s');

    await page.getByLabel('Name').fill('Grotto HQ');
    await page.getByLabel('Address').fill('grotto-hq');
    await page.getByRole('button', { name: 'Create Server' }).click();

    await expect(page).toHaveURL(/\/s\/grotto-hq$/u);
    await expect(page.getByRole('heading', { level: 1, name: 'Grotto HQ' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: '#all' })).toBeVisible();

    await page.goto('/s');
    await expect(page.getByRole('link', { name: /Grotto HQ/u })).toBeVisible();
});

test('a human without membership cannot open the Server', async ({ page }) => {
    await page.goto('/s/grotto-hq');

    await expect(page.getByText('Server unavailable')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: '#all' })).toHaveCount(0);
});
