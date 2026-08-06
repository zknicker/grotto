import { signInAsClerkHuman } from '../support/clerk-session.ts';
import { expect, test } from '../support/test.ts';

test('a Clerk-authenticated human creates and reopens a Server', async ({ page }) => {
    await signInAsClerkHuman(page);
    await page.goto('/s');

    const nameField = page.getByLabel('Name');
    const serverSwitcher = page.getByRole('button', { name: /^Switch Server \(current:/u });
    await expect(nameField.or(serverSwitcher)).toBeVisible();
    if (await serverSwitcher.isVisible()) {
        await serverSwitcher.click();
        await page.getByRole('menuitem', { name: 'Switch or create Server…' }).click();
    }

    await nameField.fill('Grotto HQ');
    await page.getByLabel('Address').fill('grotto-hq');
    await page.getByRole('button', { name: 'Create Server' }).click();

    await expect(page).toHaveURL(/\/s\/grotto-hq\/chats\/[^/]+$/u);
    await expect(page.getByRole('textbox', { name: 'Message all' })).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Switch Server (current: grotto-hq)' })
    ).toBeVisible();

    await page.goto('/s');
    await expect(page).toHaveURL(/\/s\/grotto-hq\/chats\/[^/]+$/u);
    await expect(page.getByRole('textbox', { name: 'Message all' })).toBeVisible();
});

test('a human without membership cannot open the Server', async ({ page }) => {
    await page.goto('/s/grotto-hq');

    await expect(page.getByText('Server unavailable')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Message all' })).toHaveCount(0);
});
