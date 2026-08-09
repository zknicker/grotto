import { expect, test } from 'bun:test';
import { hashComputerSecret } from '../src/computers/service.ts';
import { createGrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

interface DeviceGrant {
    deviceCode: string;
    expiresAt: string;
    pollingIntervalMs: number;
    userCode: string;
    verificationUrl: string;
}

async function beginLogin(harness: GrottoServerHarness): Promise<DeviceGrant> {
    const response = await fetch(new URL('/computer/login', harness.url), {
        body: JSON.stringify({ origin: harness.url.origin }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    expect(response.status).toBe(200);
    return (await response.json()) as DeviceGrant;
}

async function pollLogin(harness: GrottoServerHarness, deviceCode: string) {
    return await fetch(new URL('/computer/login/poll', harness.url), {
        body: JSON.stringify({ deviceCode }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
}

async function completeLogin(harness: GrottoServerHarness, accessToken: string) {
    return await fetch(new URL('/computer/login/complete', harness.url), {
        body: JSON.stringify({ accessToken }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
}

test('Computer login grants approve without Server membership and exchange once', async () => {
    const harness = await startGrottoServerHarness();
    const client = createGrottoClient(
        harness,
        await harness.clerk.mintSessionToken('user_device_login')
    );

    try {
        const started = await beginLogin(harness);
        expect(started.userCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/u);
        expect(started.deviceCode).toHaveLength(43);
        expect(started.pollingIntervalMs).toBeGreaterThan(0);
        expect(new URL(started.verificationUrl)).toMatchObject({
            host: new URL(harness.appOrigin).host,
            pathname: '/computer/login',
        });

        const pending = await pollLogin(harness, started.deviceCode);
        expect(pending.status).toBe(200);
        expect(await pending.json()).toMatchObject({
            pollingIntervalMs: started.pollingIntervalMs,
            status: 'pending',
        });

        expect(
            await client.trpc.computer.login.status.query({ userCode: started.userCode })
        ).toEqual({ status: 'pending' });
        expect(
            await client.trpc.computer.login.approve.mutate({ userCode: started.userCode })
        ).toEqual({ status: 'approved' });
        expect(
            await client.trpc.computer.login.status.query({ userCode: started.userCode })
        ).toEqual({ status: 'approved' });

        const exchanged = await pollLogin(harness, started.deviceCode);
        expect(exchanged.status).toBe(200);
        const session = (await exchanged.json()) as Record<string, string>;
        expect(session).toMatchObject({
            origin: harness.url.origin,
            status: 'approved',
        });
        expect(session.accessToken).toMatch(/^gcl_at_/u);
        expect(session.refreshToken).toMatch(/^gcl_rt_/u);
        expect(session.sessionId).toMatch(/^cls_[A-Za-z0-9_-]{16}$/u);
        expect(session.accessTokenExpiresAt).toEqual(expect.any(String));
        expect(session.refreshTokenExpiresAt).toEqual(expect.any(String));

        expect(
            await client.trpc.computer.login.status.query({ userCode: started.userCode })
        ).toEqual({ status: 'approved' });

        const completed = await completeLogin(harness, session.accessToken);
        expect(completed.status).toBe(200);
        expect(await completed.json()).toEqual({ status: 'completed' });
        expect(
            await client.trpc.computer.login.status.query({ userCode: started.userCode })
        ).toEqual({ status: 'consumed' });

        const consumed = await pollLogin(harness, started.deviceCode);
        expect(consumed.status).toBe(409);
        expect(await consumed.json()).toMatchObject({ code: 'computer_login_consumed' });

        const rows = await harness.sql`
            SELECT origin, clerk_user_id, access_token_hash, refresh_token_hash, stored_at
            FROM computer_login_sessions
        `;
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            clerk_user_id: 'user_device_login',
            origin: harness.url.origin,
        });
        expect(rows[0].access_token_hash).not.toContain(session.accessToken);
        expect(rows[0].refresh_token_hash).not.toContain(session.refreshToken);
        expect(rows[0].stored_at).toBeInstanceOf(Date);
    } finally {
        client.close();
        await harness.close();
    }
}, 60_000);

test('Computer login exchange serializes concurrent polling to one session', async () => {
    const harness = await startGrottoServerHarness();
    const client = createGrottoClient(
        harness,
        await harness.clerk.mintSessionToken('user_concurrent_login')
    );

    try {
        const started = await beginLogin(harness);
        await client.trpc.computer.login.approve.mutate({ userCode: started.userCode });

        const responses = await Promise.all([
            pollLogin(harness, started.deviceCode),
            pollLogin(harness, started.deviceCode),
        ]);
        expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
        const terminal = responses.find((response) => response.status === 409);
        expect(terminal).toBeDefined();
        expect(await terminal?.json()).toMatchObject({ code: 'computer_login_consumed' });
        expect((await harness.sql`SELECT id FROM computer_login_sessions`).length).toBe(1);
    } finally {
        client.close();
        await harness.close();
    }
}, 60_000);

test('Computer login reports malformed, denied, and expired terminal states', async () => {
    const harness = await startGrottoServerHarness();
    const client = createGrottoClient(
        harness,
        await harness.clerk.mintSessionToken('user_denied_login')
    );
    const anonymous = createGrottoClient(harness);

    try {
        expect(await anonymous.trpc.computer.login.status.query({ userCode: 'bad' })).toEqual({
            status: 'malformed',
        });
        expect(await anonymous.trpc.computer.login.status.query({ userCode: 'ABCD-EFGH' })).toEqual(
            { status: 'not-found' }
        );

        const malformedPoll = await pollLogin(harness, 'bad');
        expect(malformedPoll.status).toBe(400);
        expect(await malformedPoll.json()).toMatchObject({ code: 'computer_login_malformed' });

        const denied = await beginLogin(harness);
        expect(await client.trpc.computer.login.deny.mutate({ userCode: denied.userCode })).toEqual(
            { status: 'denied' }
        );
        const deniedPoll = await pollLogin(harness, denied.deviceCode);
        expect(deniedPoll.status).toBe(403);
        expect(await deniedPoll.json()).toMatchObject({ code: 'computer_login_denied' });

        const expired = await beginLogin(harness);
        await harness.sql`
            UPDATE computer_login_grants
            SET expires_at = now() - interval '1 second'
            WHERE user_code_hash = ${hashComputerSecret(expired.userCode.replace('-', ''))}
        `;
        expect(
            await anonymous.trpc.computer.login.status.query({ userCode: expired.userCode })
        ).toEqual({ status: 'expired' });
        const expiredPoll = await pollLogin(harness, expired.deviceCode);
        expect(expiredPoll.status).toBe(410);
        expect(await expiredPoll.json()).toMatchObject({ code: 'computer_login_expired' });
    } finally {
        anonymous.close();
        client.close();
        await harness.close();
    }
}, 60_000);
