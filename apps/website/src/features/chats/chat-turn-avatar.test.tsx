import { describe, expect, test } from 'bun:test';
import { getEntityInitials } from '../../components/ui/entity-avatar.tsx';
import { parseUserProfile } from '../../hooks/shell/use-user-profile-preference.ts';

describe('turn avatar initials', () => {
    test('agents and people share one initials rule', () => {
        expect(getEntityInitials('Scout')).toBe('SC');
        expect(getEntityInitials('Zach Knickerbocker')).toBe('ZK');
        expect(getEntityInitials('  ada  byron  lovelace ')).toBe('AL');
    });

    test('an unnamed actor still renders a mark', () => {
        expect(getEntityInitials('')).toBe('?');
        expect(getEntityInitials('   ')).toBe('?');
    });
});

describe('user profile preference parsing', () => {
    test('round-trips a stored profile', () => {
        const raw = JSON.stringify({
            avatarUrl: 'data:image/png;base64,AAAA',
            displayName: 'Zach',
        });

        expect(parseUserProfile(raw)).toEqual({
            avatarUrl: 'data:image/png;base64,AAAA',
            displayName: 'Zach',
        });
    });

    test('falls back to empty fields for missing, partial, or invalid data', () => {
        expect(parseUserProfile(null)).toEqual({ avatarUrl: null, displayName: null });
        expect(parseUserProfile('not json')).toEqual({ avatarUrl: null, displayName: null });
        expect(parseUserProfile(JSON.stringify({ displayName: 'Zach' }))).toEqual({
            avatarUrl: null,
            displayName: 'Zach',
        });
        expect(parseUserProfile(JSON.stringify({ avatarUrl: 42, displayName: null }))).toEqual({
            avatarUrl: null,
            displayName: null,
        });
    });
});
