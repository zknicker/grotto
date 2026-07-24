import type { Page } from '@playwright/test';
import { tavernAgentDmRoute } from '../support/agent-dm.ts';
import { expect, test } from '../support/test.ts';

test.describe.configure({ timeout: 120_000 });

test('keeps channel messages human-only until an agent is addressed', async ({ page }) => {
    test.setTimeout(90_000);

    const humanOnlyMarker = `QA-HUMAN-ONLY-${Date.now()}`;

    await createChannel(page, `human-only-${Date.now()}`);
    await fillChatComposer(page, `Human only channel smoke ${humanOnlyMarker}`);
    await page.getByRole('textbox', { name: 'Chat message' }).press('Enter');

    await expect(userPromptParagraph(page, humanOnlyMarker)).toHaveCount(1, {
        timeout: 30_000,
    });
    await page.waitForTimeout(1500);
    await expect(page.getByLabel('Agent is thinking')).toHaveCount(0);
});

test('routes a channel mention to the Tavern agent', async ({ page }) => {
    test.setTimeout(120_000);

    const expectedReply = `QA-CHANNEL-MENTION-${Date.now()}`;

    await createChannel(page, `mention-route-${Date.now()}`);
    await mentionTavernAgent(page, `Reply exactly \`${expectedReply}\`.`);

    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel('Agent is thinking')).toHaveCount(0);
});

test('routes the Tavern agent DM through its current session', async ({ page }) => {
    test.setTimeout(120_000);

    const expectedReply = `QA-AGENT-DM-${Date.now()}`;

    await page.goto(tavernAgentDmRoute);
    await fillChatComposer(page, `DM smoke. Reply exactly \`${expectedReply}\`.`);
    await page.getByRole('textbox', { name: 'Chat message' }).press('Enter');

    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel('Agent is thinking')).toHaveCount(0);
});

async function waitForRealChatRoute(page: Page) {
    await page.waitForURL((url) => /^\/chats\/(?!new$)[^/]+$/.test(url.pathname), {
        timeout: 30_000,
    });

    const pathname = new URL(page.url()).pathname;
    const chatId = pathname.split('/chats/')[1] ?? null;

    if (!chatId || chatId === 'new') {
        throw new Error(`Expected a real chat route, received "${pathname}".`);
    }

    return decodeURIComponent(chatId);
}

async function createChannel(page: Page, name: string) {
    await page.goto('/overview');

    await page.getByText('Channels', { exact: true }).hover();
    await page.getByRole('button', { name: 'New channel' }).click();
    await page.getByLabel('Channel name').fill(name);
    await expect(page.getByRole('button', { name: 'Create' })).toBeEnabled({
        timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Create' }).click();

    return await waitForRealChatRoute(page);
}

async function fillChatComposer(page: Page, text: string) {
    const composer = page.getByRole('textbox', { name: 'Chat message' });

    await composer.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.insertText(text);
    await expect(composer).toContainText(text, { timeout: 5000 });
}

async function mentionTavernAgent(page: Page, text: string) {
    const composer = page.getByRole('textbox', { name: 'Chat message' });

    await composer.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
    await composer.pressSequentially('@Otto');
    await page
        .getByRole('listbox')
        .getByRole('option', { name: /Otto Agent in this chat/u })
        .click();
    await composer.pressSequentially(` ${text}`);
    await composer.press('Enter');
}

function transcriptParagraph(page: Page, text: string | RegExp) {
    return page.locator('p').filter({
        hasText: typeof text === 'string' ? exactTextRegex(text) : text,
    });
}

function userPromptParagraph(page: Page, marker: string) {
    return page.locator('p').filter({ hasText: marker });
}

function exactTextRegex(text: string) {
    return new RegExp(`^${escapeRegExp(text)}$`);
}

function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
