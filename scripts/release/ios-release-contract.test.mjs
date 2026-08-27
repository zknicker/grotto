import { expect, test } from 'bun:test';

import {
    appStoreConnectAuthenticationArgs,
    appStoreConnectExportOptions,
    assertIOSReleaseTarget,
    parseIOSReleaseArgs,
} from './ios-release-contract.mjs';

test('parses an iOS version and monotonically increasing build number', () => {
    expect(parseIOSReleaseArgs(['1.0.0', '--build-number', '7', '--dry-run'])).toEqual({
        buildNumber: 7,
        dryRun: true,
        help: false,
        version: '1.0.0',
    });
    expect(() => parseIOSReleaseArgs(['1.0', '--build-number', '7'])).toThrow(
        'version must be SemVer'
    );
    expect(() => parseIOSReleaseArgs(['1.0.0', '--build-number', '0'])).toThrow('positive integer');
});

test('preserves the coordinated version and build during App Store export', () => {
    const options = appStoreConnectExportOptions('TEAM123');
    expect(options).toContain('<key>manageAppVersionAndBuildNumber</key>\n    <false/>');
    expect(options).toContain('<key>teamID</key>\n    <string>TEAM123</string>');
});

test('requires the exact declared iOS release', () => {
    const release = {
        targets: {
            server: null,
            app: null,
            ios: { buildNumber: 7, version: '1.0.0' },
            computer: null,
        },
    };
    expect(() => assertIOSReleaseTarget(release, '1.0.0', 7)).not.toThrow();
    expect(() => assertIOSReleaseTarget(release, '1.0.1', 7)).toThrow('does not match 1.0.1');
});

test('uses App Store Connect authentication only as a complete set', () => {
    expect(appStoreConnectAuthenticationArgs({})).toEqual([]);
    expect(() => appStoreConnectAuthenticationArgs({ APPLE_API_KEY_ID: 'KEY' })).toThrow(
        'must be set together'
    );
    expect(
        appStoreConnectAuthenticationArgs({
            APPLE_API_ISSUER: 'issuer',
            APPLE_API_KEY_ID: 'KEY',
            APPLE_API_KEY_PATH: '/tmp/AuthKey.p8',
        })
    ).toEqual([
        '-authenticationKeyPath',
        '/tmp/AuthKey.p8',
        '-authenticationKeyID',
        'KEY',
        '-authenticationKeyIssuerID',
        'issuer',
    ]);
});
