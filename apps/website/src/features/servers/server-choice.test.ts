import { describe, expect, test } from 'bun:test';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import {
    lastServerSlugStorageKey,
    parseInvitationToken,
    readLastServerSlug,
    rememberLastServerSlug,
    resolveEntryServer,
} from './server-choice.ts';

const servers = [
    { displayName: 'Arcade', id: 'server-1', role: 'owner', slug: 'arcade' },
    { displayName: 'Studio', id: 'server-2', role: 'member', slug: 'studio' },
] satisfies ServerSummary[];

describe('Server entry choice', () => {
    test('uses the last joined Server and falls back to the first joined Server', () => {
        expect(resolveEntryServer(servers, 'studio')?.slug).toBe('studio');
        expect(resolveEntryServer(servers, 'departed')?.slug).toBe('arcade');
        expect(resolveEntryServer([], 'studio')).toBeNull();
    });

    test('persists only the current Server slug', () => {
        const values = new Map<string, string>();
        const storage = {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
        };

        rememberLastServerSlug('studio', storage);

        expect(values.get(lastServerSlugStorageKey)).toBe('studio');
        expect(readLastServerSlug(storage)).toBe('studio');
    });
});

describe('invitation entry', () => {
    test('accepts a token, invitation path, or invitation URL', () => {
        expect(parseInvitationToken('secret')).toBe('secret');
        expect(parseInvitationToken('/invite/path-token')).toBe('path-token');
        expect(parseInvitationToken('https://grotto.test/invite/url-token')).toBe('url-token');
        expect(parseInvitationToken('  ')).toBeNull();
    });
});
