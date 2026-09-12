'use strict';

const { describe, expect, test } = require('bun:test');
const { assertTrustedRenderer, isTrustedRendererUrl } = require('./trusted-renderer.cjs');

describe('trusted desktop renderer', () => {
    test('accepts only the configured Haus App origin', () => {
        expect(isTrustedRendererUrl('https://haus.chat/s/dev/activity', 'https://haus.chat')).toBe(
            true
        );
        expect(isTrustedRendererUrl('https://evil.example', 'https://haus.chat')).toBe(false);
        expect(isTrustedRendererUrl('file:///tmp/index.html', 'https://haus.chat')).toBe(false);
    });

    test('rejects IPC from an untrusted frame', () => {
        expect(() =>
            assertTrustedRenderer(
                { senderFrame: { url: 'https://evil.example' } },
                'https://haus.chat'
            )
        ).toThrow('Untrusted page');
    });
});
