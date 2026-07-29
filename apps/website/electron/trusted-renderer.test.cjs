'use strict';

const { describe, expect, test } = require('bun:test');
const { assertTrustedRenderer, isTrustedRendererUrl } = require('./trusted-renderer.cjs');

describe('trusted desktop renderer', () => {
    test('accepts only the configured App origin', () => {
        expect(isTrustedRendererUrl('https://grotto.sh/s/dev/activity', 'https://grotto.sh')).toBe(
            true
        );
        expect(isTrustedRendererUrl('https://evil.example', 'https://grotto.sh')).toBe(false);
        expect(isTrustedRendererUrl('file:///tmp/index.html', 'https://grotto.sh')).toBe(false);
    });

    test('rejects IPC from an untrusted frame', () => {
        expect(() =>
            assertTrustedRenderer(
                { senderFrame: { url: 'https://evil.example' } },
                'https://grotto.sh'
            )
        ).toThrow('Untrusted page');
    });
});
