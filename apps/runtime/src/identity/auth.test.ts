import type { RuntimeUser } from '@tavern/api';
import { describe, expect, it } from 'vitest';
import { isRouteAllowedForAuth, type RuntimeRequestAuth } from './auth.ts';

const user: RuntimeUser = {
    avatarUrl: null,
    clerkUserId: 'user_test',
    createdAt: '2026-07-18T12:00:00.000Z',
    email: null,
    id: 'usr_test',
    name: null,
    updatedAt: '2026-07-18T12:00:00.000Z',
};

describe('runtime route auth policy', () => {
    it.each([
        { kind: 'runtime-token' } as const,
        { kind: 'user', role: 'owner', user } as const,
    ])('allows owner auth to use every route', (auth) => {
        expect(isRouteAllowedForAuth(auth, '/mcp/connections/example', 'DELETE')).toBe(true);
        expect(isRouteAllowedForAuth(auth, '/model-access', 'POST')).toBe(true);
    });

    it('limits verified non-members to introspection and invite redemption', () => {
        const auth: RuntimeRequestAuth = { kind: 'user', role: null, user };

        expect(isRouteAllowedForAuth(auth, '/identity/me', 'GET')).toBe(true);
        expect(isRouteAllowedForAuth(auth, '/identity/invites/redeem', 'POST')).toBe(true);
        expect(isRouteAllowedForAuth(auth, '/api/chats', 'GET')).toBe(false);
    });

    it.each([
        ['/api/chats', 'GET'],
        ['/api/chats/cht_1/messages', 'POST'],
        ['/identity/me', 'GET'],
        ['/identity/members', 'GET'],
        ['/capabilities', 'GET'],
        ['/capabilities/identity', 'GET'],
        ['/events', 'GET'],
        ['/api/events/ws', 'GET'],
        ['/health', 'GET'],
        ['/agents', 'GET'],
        ['/agents/agt_1', 'GET'],
        ['/models', 'GET'],
        ['/models/default', 'GET'],
        ['/mac-apps', 'GET'],
    ])('allows member access to %s %s', (pathname, method) => {
        const auth: RuntimeRequestAuth = { kind: 'user', role: 'member', user };
        expect(isRouteAllowedForAuth(auth, pathname, method)).toBe(true);
    });

    it.each([
        ['/model-access', 'GET'],
        ['/model-access/api-key', 'POST'],
        ['/agent-env', 'GET'],
        ['/mcp/connections', 'GET'],
        ['/mcp/connections/example', 'POST'],
        ['/update/status', 'GET'],
        ['/memory/settings', 'GET'],
        ['/timezone/settings', 'GET'],
    ])('denies member access to %s regardless of method', (pathname, method) => {
        const auth: RuntimeRequestAuth = { kind: 'user', role: 'member', user };
        expect(isRouteAllowedForAuth(auth, pathname, method)).toBe(false);
        expect(isRouteAllowedForAuth(auth, pathname, 'DELETE')).toBe(false);
    });

    it('denies member mutations outside the app API', () => {
        const auth: RuntimeRequestAuth = { kind: 'user', role: 'member', user };

        expect(isRouteAllowedForAuth(auth, '/agents/agt_1', 'PATCH')).toBe(false);
        expect(isRouteAllowedForAuth(auth, '/identity/members', 'DELETE')).toBe(false);
        expect(isRouteAllowedForAuth(auth, '/jobs', 'GET')).toBe(false);
    });
});
