import { readClerkSessionFixture, signInAsClerkHuman } from '../support/clerk-session.ts';
import {
    assertOpaqueId,
    completeHostedOnboarding,
    createHostedClient,
    runHostedPsql,
} from '../support/hosted-server.ts';
import { expect, test } from '../support/test.ts';

const slug = 'settings-hq';

test.beforeAll(async () => {
    const { databaseUrl, token } = readClerkSessionFixture();
    const owner = createHostedClient(token);
    await owner.server.create.mutate({ displayName: 'Settings HQ', slug });
    const server = await owner.server.bySlug.query({ slug });
    completeHostedOnboarding(databaseUrl, server.id);
    const ownerUserId = runHostedPsql(
        databaseUrl,
        "select id from users where clerk_user_id = 'user_e2e_human'"
    );
    assertOpaqueId(ownerUserId);
    const inventory = JSON.stringify({
        importableSkills: [
            {
                description: 'Durable browser coverage for a reported Computer skill.',
                id: 'hsk_e2e_durable',
                name: 'durable-testing',
                source: 'E2E fixture',
            },
        ],
        name: 'Settings Computer',
        runtimes: [
            {
                id: 'codex',
                label: 'Codex',
                models: [
                    { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
                    { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
                ],
            },
        ],
    });
    runHostedPsql(
        databaseUrl,
        `insert into computers (
           id, server_id, attached_by_user_id, credential_hash, reported_inventory, health
         ) values (
           'cmp_e2esettings00000', '${server.id}', '${ownerUserId}', '${'e'.repeat(64)}',
           '${inventory}'::jsonb, 'healthy'
         )`
    );
});

test('reports current Computer models and skills in Server Settings', async ({ page }) => {
    await signInAsClerkHuman(page);
    await page.goto(`/s/${slug}/settings/models`);

    await expect(page.getByRole('heading', { level: 1, name: 'Models' })).toBeVisible();
    await expect(page.getByText('Codex', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('GPT-5.6 Terra', { exact: true })).toBeVisible();
    await expect(page.getByText('gpt-5.6-terra', { exact: true })).toBeVisible();

    await page.goto(`/s/${slug}/settings/skills`);
    await expect(page.getByRole('heading', { exact: true, name: 'Skills' })).toBeVisible();
    await expect(page.getByText('Browse Skills', { exact: true })).toBeVisible();
    await expect(page.getByRole('treeitem', { name: 'durable-testing' })).toBeVisible();
    await expect(page.getByText('E2E fixture', { exact: true })).toBeVisible();
});

test('creates and deletes a custom Server MCP connection', async ({ page }) => {
    const name = 'durable-smoke-mcp';
    await signInAsClerkHuman(page);
    await page.goto(`/s/${slug}/settings/connections`);

    await page.getByRole('button', { name: 'Add MCP Server' }).click();
    const drawer = page.getByRole('dialog', { name: 'Add MCP Server' });
    await drawer.getByLabel('Name').fill(name);
    await drawer.getByLabel('URL').fill('https://example.com/mcp');
    await drawer.getByLabel('Authentication').click();
    await page.getByRole('option', { name: 'OAuth' }).click();
    await drawer.getByRole('button', { name: 'Add Connection' }).click();

    const row = page.getByRole('button', { name: new RegExp(name, 'u') });
    await expect(row).toBeVisible();
    await row.click();
    const detail = page.getByRole('dialog', { name });
    await detail.getByRole('button', { name: `${name} actions` }).click();
    await page.getByRole('menuitem', { name: 'Delete Connection' }).click();
    const confirmation = page.getByRole('alertdialog', { name: `Delete ${name}?` });
    await expect(confirmation).toContainText('No Agents currently use this connection.');
    await confirmation.getByRole('button', { name: 'Delete' }).click();
    await expect(row).toHaveCount(0);
});
