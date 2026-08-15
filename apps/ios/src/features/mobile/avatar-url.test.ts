import { describe, expect, test } from 'bun:test';
import { resolveAvatarUrl } from './avatar-url.ts';

describe('resolveAvatarUrl', () => {
    const serverOrigin = 'https://grotto.sh';

    test('resolves a Server-relative avatar route for React Native', () => {
        expect(resolveAvatarUrl('/api/avatars/avt_1234567890abcdef', serverOrigin)).toBe(
            'https://grotto.sh/api/avatars/avt_1234567890abcdef'
        );
    });

    test('preserves absolute and inline avatar sources', () => {
        expect(resolveAvatarUrl('https://images.example/cove.png', serverOrigin)).toBe(
            'https://images.example/cove.png'
        );
        expect(resolveAvatarUrl('data:image/png;base64,abc', serverOrigin)).toBe(
            'data:image/png;base64,abc'
        );
        expect(resolveAvatarUrl(null, serverOrigin)).toBeNull();
    });
});
