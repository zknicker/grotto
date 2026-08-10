import appPackageJson from '../../../website/package.json';

type VersionStatus = 'compatible' | 'matched' | 'mismatched' | 'unknown';

interface VersionParts {
    major: number;
    minor: number;
    patch: number;
}

interface WebsitePackageJson {
    tavern?: {
        runtime?: {
            minimumVersion?: string;
        };
    };
    version: string;
}

const appPackage = appPackageJson as WebsitePackageJson;

export function getRequiredRuntimeVersion(appVersion = appPackage.version) {
    return appPackage.tavern?.runtime?.minimumVersion ?? appVersion;
}

export function getRuntimeVersionStatus(input: {
    appVersion: string;
    requiredRuntimeVersion?: string;
    runtimeVersion: null | string;
}): VersionStatus {
    if (!input.runtimeVersion) {
        return 'unknown';
    }

    const requiredRuntimeVersion =
        input.requiredRuntimeVersion ?? getRequiredRuntimeVersion(input.appVersion);

    if (input.runtimeVersion === input.appVersion) {
        return 'matched';
    }

    return isRuntimeVersionAcceptedByApp({
        appVersion: input.appVersion,
        requiredRuntimeVersion,
        runtimeVersion: input.runtimeVersion,
    })
        ? 'compatible'
        : 'mismatched';
}

export function isRuntimeVersionAcceptedByApp(input: {
    appVersion: string;
    requiredRuntimeVersion: string;
    runtimeVersion: string;
}) {
    const app = parseVersion(input.appVersion);
    const required = parseVersion(input.requiredRuntimeVersion);
    const runtime = parseVersion(input.runtimeVersion);
    if (!(app && required && runtime)) {
        return false;
    }

    const appSharesRequiredEpoch = app.major === required.major && app.minor === required.minor;
    const inAppEpoch =
        runtime.major === app.major &&
        runtime.minor === app.minor &&
        compareVersionParts(runtime, app) <= 0 &&
        (!appSharesRequiredEpoch || compareVersionParts(runtime, required) >= 0);

    return inAppEpoch || isCompatibleRuntimeVersion(input);
}

export function isCompatibleRuntimeVersion(input: {
    requiredRuntimeVersion: string;
    runtimeVersion: string;
}) {
    const runtime = parseVersion(input.runtimeVersion);
    const required = parseVersion(input.requiredRuntimeVersion);

    if (!(runtime && required)) {
        return false;
    }

    return (
        runtime.major === required.major &&
        runtime.minor === required.minor &&
        compareVersionParts(runtime, required) >= 0
    );
}

function parseVersion(version: string): VersionParts | null {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    if (!match) {
        return null;
    }

    return {
        major: Number.parseInt(match[1], 10),
        minor: Number.parseInt(match[2], 10),
        patch: Number.parseInt(match[3], 10),
    };
}

function compareVersionParts(left: VersionParts, right: VersionParts) {
    if (left.major !== right.major) {
        return left.major > right.major ? 1 : -1;
    }

    if (left.minor !== right.minor) {
        return left.minor > right.minor ? 1 : -1;
    }

    if (left.patch !== right.patch) {
        return left.patch > right.patch ? 1 : -1;
    }

    return 0;
}
