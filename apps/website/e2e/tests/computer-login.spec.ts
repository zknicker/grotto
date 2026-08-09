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

    const tamperedVerificationUrl = new URL(started.verificationUrl);
    tamperedVerificationUrl.searchParams.set('flow', 'setup');
    await page.goto(tamperedVerificationUrl.toString());
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
    const session = (await exchanged.json()) as { accessToken: string };
    await expect(
        page.getByRole('heading', { name: 'Signed in — finishing the connection' })
    ).toBeVisible();

    const completed = await fetch(new URL('/computer/login/complete', serverOrigin), {
        body: JSON.stringify({ accessToken: session.accessToken }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    expect(completed.status).toBe(200);
    await expect(page.getByRole('heading', { name: 'Grotto Computer signed in' })).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Computer connected — you can close this page' })
    ).toHaveCount(0);
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
