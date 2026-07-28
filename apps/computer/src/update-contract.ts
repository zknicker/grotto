export const computerBootstrapProtocolVersion = 1;
export const computerProtocolVersion = 2;

export type ComputerUpdatePhase =
    | 'available'
    | 'checking'
    | 'complete'
    | 'failed'
    | 'idle'
    | 'installing'
    | 'restarting'
    | 'waiting-for-agents';

export interface ComputerUpdateProgress {
    detail: string | null;
    phase: ComputerUpdatePhase;
    targetVersion: string | null;
    updatedAt: string;
}

export interface SignedComputerRelease {
    release: {
        sha256: string;
        tarballUrl: string;
        version: string;
    };
    signature: string;
}

export function parseSignedComputerRelease(value: unknown): SignedComputerRelease {
    if (!(isRecord(value) && hasOnlyKeys(value, ['release', 'signature']))) {
        throw new Error('Production release manifest is invalid.');
    }
    const { release, signature } = value;
    if (
        !(
            isRecord(release) &&
            hasOnlyKeys(release, ['sha256', 'tarballUrl', 'version']) &&
            typeof release.sha256 === 'string' &&
            /^[a-f0-9]{64}$/u.test(release.sha256) &&
            typeof release.tarballUrl === 'string' &&
            isUrl(release.tarballUrl) &&
            typeof release.version === 'string' &&
            release.version.length > 0 &&
            release.version.length <= 64 &&
            typeof signature === 'string' &&
            signature.length >= 32 &&
            signature.length <= 1024
        )
    ) {
        throw new Error('Production release manifest is invalid.');
    }
    return {
        release: {
            sha256: release.sha256,
            tarballUrl: release.tarballUrl,
            version: release.version,
        },
        signature,
    };
}

export function parseBootstrapAccepted(value: unknown) {
    if (
        !(
            isRecord(value) &&
            hasOnlyKeys(value, ['mode', 'type']) &&
            value.type === 'bootstrap-accepted' &&
            (value.mode === 'ordinary' || value.mode === 'update-required')
        )
    ) {
        return null;
    }
    return { mode: value.mode, type: value.type };
}

export function parseComputerUpdateCommand(value: unknown) {
    if (!(isRecord(value) && hasOnlyKeys(value, ['release', 'type']) && value.type === 'update')) {
        return null;
    }
    try {
        return { release: parseSignedComputerRelease(value.release), type: value.type };
    } catch {
        return null;
    }
}

export function computerReleaseSigningPayload(release: SignedComputerRelease['release']): string {
    return JSON.stringify({
        sha256: release.sha256,
        tarballUrl: release.tarballUrl,
        version: release.version,
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, expected: string[]) {
    const keys = Object.keys(value);
    return keys.length === expected.length && expected.every((key) => keys.includes(key));
}

function isUrl(value: string) {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}
