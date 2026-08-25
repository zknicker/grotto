import { expect, test } from 'bun:test';
import { createClerkUsers } from '../src/identity/clerk-users.ts';

/**
 * The only Grotto surface that reads a human's email. Clerk is the sole source,
 * the lookup is keyed by the verified session subject, and an address counts
 * only when Clerk itself reports it verified.
 */
const secretKey = 'sk_test_grotto';

function respondWith(body: unknown, status = 200) {
    const calls: { init: RequestInit; url: string }[] = [];
    const fetchImpl = (url: string, init: RequestInit) => {
        calls.push({ init, url });
        return Promise.resolve(
            new Response(JSON.stringify(body), {
                headers: { 'content-type': 'application/json' },
                status,
            })
        );
    };

    return { calls, fetchImpl };
}

test('only Clerk-verified addresses are returned, normalized', async () => {
    const { calls, fetchImpl } = respondWith({
        email_addresses: [
            { email_address: 'Verified@Grotto.TEST', verification: { status: 'verified' } },
            { email_address: 'unverified@grotto.test', verification: { status: 'unverified' } },
            { email_address: 'no-verification@grotto.test', verification: null },
            { email_address: '  spaced@grotto.test  ', verification: { status: 'verified' } },
        ],
        id: 'user_clerk_1',
    });
    const clerkUsers = createClerkUsers({ fetch: fetchImpl, secretKey });

    await expect(clerkUsers.readVerifiedEmails('user_clerk_1')).resolves.toEqual([
        'verified@grotto.test',
        'spaced@grotto.test',
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.clerk.com/v1/users/user_clerk_1');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(
        `Bearer ${secretKey}`
    );
});

test('a human with no verified address resolves to none', async () => {
    const { fetchImpl } = respondWith({
        email_addresses: [
            { email_address: 'pending@grotto.test', verification: { status: 'unverified' } },
        ],
        id: 'user_clerk_2',
    });
    const clerkUsers = createClerkUsers({ fetch: fetchImpl, secretKey });

    await expect(clerkUsers.readVerifiedEmails('user_clerk_2')).resolves.toEqual([]);
});

test('a failed Clerk lookup fails closed rather than returning no addresses', async () => {
    const { fetchImpl } = respondWith({ errors: [] }, 502);
    const clerkUsers = createClerkUsers({ fetch: fetchImpl, secretKey });

    await expect(clerkUsers.readVerifiedEmails('user_clerk_3')).rejects.toThrow(/502/u);
});

test('an unconfigured Clerk secret refuses the lookup instead of guessing', async () => {
    const { calls, fetchImpl } = respondWith({ email_addresses: [], id: 'user_clerk_4' });
    const clerkUsers = createClerkUsers({ fetch: fetchImpl, secretKey: undefined });

    await expect(clerkUsers.readVerifiedEmails('user_clerk_4')).rejects.toThrow(
        /GROTTO_CLERK_SECRET_KEY/u
    );
    expect(calls).toHaveLength(0);
});
