import path from 'node:path';

import { isSemver } from './release-utils.mjs';

export function assertIOSReleaseDecision(decision, version, buildNumber) {
    const ios = decision?.surfaces?.ios;
    if (ios?.action !== 'publish') {
        throw new Error('release surface decision does not publish iOS');
    }
    if (ios.version !== version) {
        throw new Error(`declared iOS version ${ios.version} does not match ${version}`);
    }
    if (ios.buildNumber !== buildNumber) {
        throw new Error(
            `declared iOS build ${ios.buildNumber} does not match build ${buildNumber}`
        );
    }
}

export function parseIOSReleaseArgs(argv) {
    if (argv.includes('--help') || argv.includes('-h')) {
        return { help: true };
    }

    const positional = argv.filter((value, index) => {
        const previous = argv[index - 1];
        return !value.startsWith('-') && previous !== '--build-number';
    });
    const version = positional[0];
    const buildNumber = readBuildNumber(argv);

    if (!isSemver(version)) {
        throw new Error('iOS release version must be SemVer');
    }
    if (!buildNumber) {
        throw new Error('--build-number must be a positive integer');
    }

    return {
        buildNumber,
        dryRun: argv.includes('--dry-run'),
        help: false,
        version,
    };
}

export function appStoreConnectAuthenticationArgs(environment = process.env) {
    const keyPath = environment.APPLE_API_KEY_PATH;
    const keyId = environment.APPLE_API_KEY_ID;
    const issuerId = environment.APPLE_API_ISSUER;
    const configured = [keyPath, keyId, issuerId].filter(Boolean).length;

    if (configured === 0) {
        return [];
    }
    if (configured !== 3) {
        throw new Error(
            'APPLE_API_KEY_PATH, APPLE_API_KEY_ID, and APPLE_API_ISSUER must be set together'
        );
    }

    return [
        '-authenticationKeyPath',
        path.resolve(keyPath),
        '-authenticationKeyID',
        keyId,
        '-authenticationKeyIssuerID',
        issuerId,
    ];
}

export function appStoreConnectExportOptions(teamId) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>destination</key>
    <string>upload</string>
    <key>manageAppVersionAndBuildNumber</key>
    <false/>
    <key>method</key>
    <string>app-store-connect</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>teamID</key>
    <string>${teamId}</string>
</dict>
</plist>
`;
}

function readBuildNumber(argv) {
    const index = argv.indexOf('--build-number');
    const raw = index === -1 ? null : argv[index + 1];
    if (!(raw && /^\d+$/u.test(raw))) {
        return null;
    }

    const value = Number.parseInt(raw, 10);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
}
