import { describe, expect, test } from 'bun:test';
import { readClerkSessionToken } from './sign-in-gate.tsx';

describe('readClerkSessionToken', () => {
    test('settles token failures into the recoverable missing state', async () => {
        const state = await readClerkSessionToken(async () => {
            throw new Error('Clerk token refresh failed');
        });

        expect(state).toBe('missing');
    });

    test('distinguishes a usable signed-in token', async () => {
        expect(await readClerkSessionToken(async () => 'session-token')).toBe('ready');
        expect(await readClerkSessionToken(async () => null)).toBe('missing');
    });
});
