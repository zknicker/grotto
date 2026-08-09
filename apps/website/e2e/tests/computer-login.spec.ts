import { signInAsClerkHuman } from '../support/clerk-session.ts';
import { expect, test } from '../support/test.ts';

interface DeviceGrant {
    deviceCode: string;
    userCode: string;
    verificationUrl: string;
}

test('Clerk-backed Computer login preserves its code and finishes after approval', async ({
    page,
}) => {
    await signInAsClerkHuman(page);
    const serverOrigin = `http://127.0.0.1:${process.env.GROTTO_SERVER_PORT}`;
    const started = await beginLogin(serverOrigin);

    await page.goto(started.verificationUrl);
    await expect(page.getByRole('heading', { name: 'Approve Grotto Computer?' })).toBeVisible();
    await expect(page.getByLabel('Computer login code')).toHaveValue(started.userCode);
    await expect(page.getByText('Active account: your current Clerk account')).toBeVisible();

    await page.getByRole('button', { name: 'Approve Grotto Computer' }).click();
    await expect(
        page.getByRole('heading', { name: 'Signed in — finishing the connection' })
    ).toBeVisible();

    const exchanged = await fetch(new URL('/computer/login/poll', serverOrigin), {
        body: JSON.stringify({ deviceCode: started.deviceCode }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    expect(exchanged.status).toBe(200);
    await expect(page.getByRole('heading', { name: 'Grotto Computer signed in' })).toBeVisible();
});

async function beginLogin(origin: string): Promise<DeviceGrant> {
    const response = await fetch(new URL('/computer/login', origin), {
        body: JSON.stringify({ origin }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    expect(response.status).toBe(200);
    return (await response.json()) as DeviceGrant;
}
