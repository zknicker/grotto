import type { Page } from '@playwright/test';
import { expect, test } from '../support/test.ts';

// The lifecycle controls (specs/sessions.md): Restart resumes the current
// session; Session reset and Full reset rotate it. This proves the controls are
// present and correctly communicate what full reset destroys vs preserves;
// deterministic preserved/destroyed behavior is covered by the Runtime
// process/session tests.

test('agent profile exposes restart, session reset, and full reset controls', async ({ page }) => {
    await openPrimaryAgentProfile(page);

    // Restart is a non-destructive header action beside Stop.
    const restart = page.getByRole('button', { name: 'Restart' });
    await expect(restart).toBeVisible();

    // Session controls live in the profile's Session section.
    await expect(page.getByRole('button', { name: 'Start fresh session' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Full reset' })).toBeVisible();
});

test('restart resumes the current session without an error', async ({ page }) => {
    await openPrimaryAgentProfile(page);

    const restart = page.getByRole('button', { name: 'Restart' });
    await restart.click();

    // Non-destructive: the action settles and the control stays usable.
    await expect(restart).toBeEnabled();
    await expect(page.getByText('Grotto Runtime is not connected.')).toHaveCount(0);
});

test('full reset dialog states what is destroyed and what is kept', async ({ page }) => {
    await openPrimaryAgentProfile(page);

    await page.getByRole('button', { name: 'Full reset' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('MEMORY.md');
    await expect(dialog).toContainText(/kept/iu);
    // Cancel: the seeded agent's workspace must survive the e2e run.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
});

async function openPrimaryAgentProfile(page: Page) {
    const agentId = await readPrimaryAgentId();
    if (!agentId) {
        throw new Error('No seeded agent available.');
    }
    await page.goto(`/members/agents/${agentId}`);
    await expect(page.getByRole('tab', { name: 'Profile' })).toBeVisible();
}

async function readPrimaryAgentId() {
    const runtimeUrl = process.env.TAVERN_RUNTIME_URL ?? 'http://127.0.0.1:18790';
    const response = await fetch(`${runtimeUrl}/agents`, {
        headers: {
            authorization: `Bearer ${process.env.TAVERN_RUNTIME_TOKEN ?? 'e2e-runtime-token'}`,
        },
    });
    if (!response.ok) {
        throw new Error(`Agents request failed with ${response.status}.`);
    }
    const body = (await response.json()) as { agents: Array<{ id: string }> };
    return body.agents[0]?.id ?? null;
}
