import { createHash } from 'node:crypto';
import { createTRPCClient, httpLink } from '@trpc/client';
import type { GrottoRouter } from '../../../server/src/grotto-api/router.ts';
import { readClerkSessionFixture, signInAsClerkHuman } from '../support/clerk-session.ts';
import { expect, test } from '../support/test.ts';

test('an Owner approves one Computer and sees its authenticated attachment record', async ({ page }) => {
    await signInAsClerkHuman(page);
    await page.goto('/s');
    await page.getByLabel('Name').fill('Computer HQ');
    await page.getByLabel('Address').fill('computer-hq');
    await page.getByRole('button', { name: 'Create Server' }).click();

    const session = readClerkSessionFixture();
    const owner = hostedClient(session.token);
    const setup = await owner.computer.begin.mutate({
        credentialHash: createHash('sha256').update('computer-test-credential').digest('hex'),
        slug: 'computer-hq',
    });
    await page.goto(setup.approvalUrl);
    await page.getByRole('button', { name: 'Approve Computer' }).click();
    await expect(page.getByText('Approved. Return to Grotto Computer.')).toBeVisible();

    await page.goto('/s/computer-hq/computers');
    await expect(page.getByRole('heading', { name: 'Computers' })).toBeVisible();
    await expect(page.getByText('Awaiting connection · —')).toBeVisible();
    await expect(page.getByText('offline')).toBeVisible();

    await expect(owner.computer.approve.mutate({
        approvalId: new URL(setup.approvalUrl).searchParams.get('approval') ?? '',
        secret: new URL(setup.approvalUrl).searchParams.get('secret') ?? '',
    })).rejects.toThrow(/already used/iu);
});

function hostedClient(token: string) {
    return createTRPCClient<GrottoRouter>({
        links: [
            httpLink({
                headers: { authorization: `Bearer ${token}` },
                url: `http://127.0.0.1:${process.env.GROTTO_SERVER_PORT}/trpc`,
            }),
        ],
    });
}
