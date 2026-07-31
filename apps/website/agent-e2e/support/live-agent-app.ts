import type { Page } from '@playwright/test';
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
        .locator('button')
        .filter({ hasText: new RegExp(`^${escapeRegExp(sidebarLabel)}\\d*$`, 'u') })
        .click();
    await expect(page).toHaveURL(new RegExp(`/s/${serverSlug}/chats/${chatId}`, 'u'));
    await expect(singleComposer(page)).toBeVisible();
}

export async function sendFromComposer(page: Page, content: string) {
    const composer = singleComposer(page);
    await composer.fill(content);

    await send(page);
    await expect(page.getByText(content, { exact: true })).toBeVisible();
}

export async function sendTaskFromComposer(page: Page, content: string) {
    const composer = singleComposer(page);
    await composer.fill(content);
    await page.getByRole('checkbox', { name: 'As Task' }).check();
    await send(page);
    await expect(page.getByText(content, { exact: true })).toBeVisible();
}

export async function expectVisibleReply(page: Page, content: string) {
    await expect(page.getByText(content, { exact: true })).toBeVisible({
        timeout: 240_000,
    });
}

function singleComposer(page: Page) {
    return page.getByRole('textbox', { name: /^Message /u });
}

async function send(page: Page) {
    const button = page.getByRole('button', { name: 'Send', exact: true });
    await expect(button).toHaveCount(1);
    await button.click();
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
