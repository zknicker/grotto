import { describe, expect, test } from 'bun:test';
import {
    readClerkSessionTokenState,
    resolveClerkSessionToken,
    subscribeToClerkSessionTokenState,
} from '../../lib/clerk.tsx';
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

test('a refresh failure after readiness publishes recoverable auth state', async () => {
    await resolveClerkSessionToken(async () => null);
    const states: string[] = [];
    const unsubscribe = subscribeToClerkSessionTokenState(() => {
        states.push(readClerkSessionTokenState());
    });

    try {
        expect(await resolveClerkSessionToken(async () => 'session-token')).toBe('session-token');
        expect(
            await resolveClerkSessionToken(async () => {
                throw new Error('refresh failed');
            })
        ).toBeNull();
        expect(states.slice(-2)).toEqual(['ready', 'missing']);
        expect(readClerkSessionTokenState()).toBe('missing');
    } finally {
        unsubscribe();
    }
});
