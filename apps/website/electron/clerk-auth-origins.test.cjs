'use strict';

const { describe, expect, test } = require('bun:test');
const builderConfig = require('../electron-builder.config.cjs');
const { resolveClerkAuthOrigins } = require('./clerk-auth-origins.cjs');

describe('resolveClerkAuthOrigins', () => {
    test('packages every desktop auth module', () => {
        expect(builderConfig.files).toContain('electron/clerk-auth-origins.cjs');
        expect(builderConfig.files).toContain('electron/clerk-loopback-callback.cjs');
    });

    test('uses the development App and Clerk origins for Electron development', () => {
        expect(
            resolveClerkAuthOrigins({
                appUrl: 'http://localhost:25248/s/dev/activity',
                clerkIssuerUrl: 'https://clerk.shared.lcl.dev/path',
                isPackaged: false,
            })
        ).toEqual({
            appOrigin: 'http://localhost:25248',
            clerkOrigin: 'https://clerk.shared.lcl.dev',
        });
    });

    test('locks packaged apps to the production origins', () => {
        expect(
            resolveClerkAuthOrigins({
                appUrl: 'http://localhost:25248',
                clerkIssuerUrl: 'https://example.com',
                isPackaged: true,
            })
        ).toEqual({
            appOrigin: 'https://grotto.sh',
            clerkOrigin: 'https://clerk.grotto.sh',
        });
    });
});
