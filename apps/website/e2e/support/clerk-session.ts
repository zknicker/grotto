import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

export const e2eClerkUserId = 'user_e2e_human';
export const e2ePeerClerkUserId = 'user_e2e_peer';

export function clerkSessionFile(runId = process.env.TAVERN_E2E_RUN_ID ?? 'default') {
    return fileURLToPath(
        new URL(`../../../../.context/e2e/clerk-session-${runId}.json`, import.meta.url)
    );
}

interface ClerkSessionFixture {
    peerEmail: string;
    peerToken: string;
    token: string;
}

export function readClerkSessionFixture(): ClerkSessionFixture {
    return JSON.parse(readFileSync(clerkSessionFile(), 'utf8')) as ClerkSessionFixture;
}

/**
 * Signs the browser in as an e2e human. clerk-js never loads in e2e, so the
 * page carries the session token the local Clerk issuer minted for the Server
 * exactly where the App reads it. `peer` is a second real Clerk identity with
 * its own verified address, which membership flows need.
 */
export async function signInAsClerkHuman(page: Page, who: 'human' | 'peer' = 'human') {
    const fixture = readClerkSessionFixture();
    const sessionToken = who === 'peer' ? fixture.peerToken : fixture.token;

    await page.addInitScript((value: string) => {
        Object.defineProperty(window, 'Clerk', {
            configurable: true,
            value: { session: { getToken: () => Promise.resolve(value) } },
        });
    }, sessionToken);
}
