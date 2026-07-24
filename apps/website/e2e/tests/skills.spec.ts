import { expect, test } from '../support/test.ts';

test('lists installed skills with available and sources management', async ({ page }) => {
    await page.goto('/settings/skills');

    await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();
    await expect(page.getByText('Browse skills')).toBeVisible();
    // Installed skills render as per-skill folders in the browse tree.
    await expect(page.getByRole('treeitem', { name: 'tavern-agent' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tools' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'MCP' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Manage skill sources' }).click();
    await expect(page.getByRole('heading', { name: 'Skill sources' })).toBeVisible();
    await expect(page.getByPlaceholder('owner/repo')).toBeVisible();
    await page.keyboard.press('Escape');

    // The available catalog lives in the add-from-library dialog.
    await page.getByRole('button', { name: 'Add from library' }).click();
    const libraryDialog = page.getByRole('dialog', { name: 'Add from library' });
    await expect(libraryDialog.getByText('Tavern Workflow', { exact: true })).toBeVisible();
    await expect(libraryDialog.getByText('Built-in', { exact: true }).first()).toBeVisible();
    await page.keyboard.press('Escape');
});

test('redirects the retired tools settings page to Connections', async ({ page }) => {
    await page.goto('/settings/tools');

    await expect(page).toHaveURL(/\/settings\/connections$/);
    await expect(page.getByRole('heading', { exact: true, name: 'Connections' })).toBeVisible();
});

test('splits channels and MCP connections into separate settings pages', async ({ page }) => {
    await page.goto('/settings/channels');

    await expect(page.getByRole('heading', { level: 1, name: 'Channels' })).toBeVisible();
    await expect(page.getByRole('main').getByText('Grotto', { exact: true }).first()).toBeVisible();

    await page.goto('/settings/connections');

    await expect(page.getByRole('heading', { level: 1, name: 'Connections' })).toBeVisible();
    await expect(page.getByText('MCP connections', { exact: true })).toBeVisible();
});

test('creates and deletes a custom MCP connection', async ({ page }) => {
    const name = 'codex-smoke-mcp';
    await page.goto('/settings/connections');

    await page.getByRole('button', { name: 'Add connection' }).click();
    const drawer = page.getByRole('dialog', { name: 'Add custom connection' });
    await drawer.getByLabel('Name').fill(name);
    await drawer.getByLabel('URL').fill('https://example.com/mcp');
    await drawer.getByRole('button', { name: 'Add connection' }).click();

    await page.getByRole('tab', { exact: true, name: 'Connected' }).click();
    const row = page.getByRole('button', { name: new RegExp(name, 'u') });
    await expect(row).toBeVisible();
    await row.click();
    const detail = page.getByRole('dialog', { name });
    await detail.getByRole('button', { name: `${name} actions` }).click();
    await page.getByRole('menuitem', { name: 'Delete connection' }).click();
    const confirmation = page.getByRole('alertdialog', { name: `Delete ${name}?` });
    await expect(confirmation.getByText('This connection has no agent tool grants.')).toBeVisible();
    await confirmation.getByRole('button', { name: 'Delete' }).click();
    await expect(row).toHaveCount(0);
});
