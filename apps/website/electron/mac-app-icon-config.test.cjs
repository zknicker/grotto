'use strict';

const { describe, expect, test } = require('bun:test');
const { macAppIconConfiguration } = require('./mac-app-icon-config.cjs');

describe('macOS app icon packaging', () => {
    test('names the asset-catalog icon when the catalog is packaged', () => {
        const configuration = macAppIconConfiguration(true);

        expect(configuration.extendInfo.CFBundleIconName).toBe('AppIcon');
        expect(configuration.extraResources).toEqual([
            {
                from: 'electron/generated-icons/Assets.car',
                to: 'Assets.car',
            },
        ]);
    });

    test('lets macOS use the packaged ICNS when no asset catalog exists', () => {
        const configuration = macAppIconConfiguration(false);

        expect(configuration.extendInfo.CFBundleIconName).toBeUndefined();
        expect(configuration.extraResources).toEqual([]);
    });
});
