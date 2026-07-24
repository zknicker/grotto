import type { Page } from '@playwright/test';
import { expect } from './test.ts';

/**
 * Chats are persistent DMs and channels — there is no start-chat flow. The
 * seeded Tavern agent DM is the canonical surface for driving agent turns;
 * tests share it (workers: 1) and assert on per-test unique markers.
 */
// Matches the fixture agent created in start-tavern-runtime.ts.
export const tavernAgentDmChatId = 'cht_agt_otto_e2e_dm';
export const tavernAgentDmRoute = `/chats/${tavernAgentDmChatId}`;

export function chatComposer(page: Page) {
    return page.getByRole('textbox', { name: 'Chat message' });
}

export async function openAgentDm(page: Page) {
    await page.goto(tavernAgentDmRoute);
    const composer = chatComposer(page);
    await expect(composer).toBeEnabled({ timeout: 30_000 });

    return composer;
}

export async function fillChatComposer(page: Page, text: string) {
    const composer = chatComposer(page);

    await composer.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.insertText(text);
    await expect(composer).toContainText(text, { timeout: 5000 });
}

/** Sends a marker prompt in the agent DM and waits for the exact reply. */
export async function sendAgentDmTurn(
    page: Page,
    { expectedReply, prompt }: { expectedReply: string | RegExp; prompt: string }
) {
    await openAgentDm(page);
    await fillChatComposer(page, prompt);
    await chatComposer(page).press('Enter');

    await expect(
        page.locator('p').filter({
            hasText:
                typeof expectedReply === 'string' ? exactTextRegex(expectedReply) : expectedReply,
        })
    ).toBeVisible({ timeout: 45_000 });

    return tavernAgentDmChatId;
}

export function exactTextRegex(text: string) {
    return new RegExp(`^${escapeRegExp(text)}$`);
}

export function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
