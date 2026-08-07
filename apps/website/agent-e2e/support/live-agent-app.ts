import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function openChat(
    page: Page,
    serverSlug: string,
    chatId: string,
    sidebarLabel: string
) {
    await page.goto('/');
    await expect(page).toHaveURL(new RegExp(`/s/${serverSlug}/`, 'u'));
    await page
        .getByRole('row', {
            name: new RegExp(`^${escapeRegExp(sidebarLabel)}(?:\\s+\\d+)?$`, 'u'),
        })
        .click();
    await expect(page).toHaveURL(new RegExp(`/s/${serverSlug}/chats/${chatId}`, 'u'));
    await expect(singleComposer(page)).toBeVisible();
}

export async function sendFromComposer(page: Page, content: string) {
    const composer = singleComposer(page);
    await composer.fill(content);

    await send(page);
    await expect(messageByContent(messageTimeline(page), content, 'user')).toBeVisible();
}

export async function sendTaskFromComposer(page: Page, content: string) {
    const composer = singleComposer(page);
    await composer.fill(content);
    await setTaskMode(page, true);
    await send(page);
    await expect(messageByContent(messageTimeline(page), content, 'user')).toBeVisible();
}

export async function setTaskMode(page: Page, enabled: boolean) {
    const taskMode = page.getByRole('switch', { name: /^Send as task/u });
    await expect(taskMode).toBeVisible();

    if ((await taskMode.isChecked()) !== enabled) {
        await taskMode.press('Space');
    }
    await expect(taskMode).toBeChecked({ checked: enabled });
}

export async function expectVisibleReply(page: Page, content: string) {
    await expect(messageByContent(messageTimeline(page), content, 'assistant')).toBeVisible({
        timeout: 240_000,
    });
}

export function messageByContent(
    root: Locator | Page,
    content: string,
    sender: 'assistant' | 'user' = 'user'
) {
    return root
        .locator(`[data-from="${sender}"] [data-slot="chat-message-content"]`)
        .filter({ hasText: messageAnchor(content) })
        .last();
}

export function messageSurface(message: Locator) {
    return message.locator('xpath=ancestor::*[@data-slot="chat-message-assistant"][1]');
}

export async function openMessageThread(message: Locator) {
    const surface = messageSurface(message);
    await surface.hover();
    await surface.locator('button[aria-label="Reply in thread"]').click();
}

function singleComposer(page: Page) {
    return page.getByRole('textbox', { name: /^Message /u });
}

export function messageTimeline(page: Page) {
    return page.getByRole('region', { name: 'Messages', exact: true });
}

async function send(page: Page) {
    const button = page.getByRole('button', { name: 'Send', exact: true });
    await expect(button).toHaveCount(1);
    await button.click();
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function messageAnchor(content: string) {
    const firstLine = content
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .find(Boolean);

    if (!firstLine) {
        throw new Error('A message locator needs non-empty content.');
    }

    return firstLine.replace(/^(?:#{1,6}|[-*+]|>)\s+/u, '');
}
