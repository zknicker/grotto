import { getDesktopBridge, isElectronDesktopApp } from './desktop-bridge.ts';

/**
 * The hosted Server admits only a client that declares the exact
 * `appProtocolVersion`. When it does not, every hosted procedure and each
 * subscription start fails closed with this one tRPC code before any product
 * data is served. It is Grotto App's single typed "update required" signal.
 */
const updateRequiredTrpcCode = 'PRECONDITION_FAILED';

/** How Grotto App resolves an update-required signal for the current shell. */
export type UpdateRequiredMode = 'desktop-update' | 'reload';

/**
 * A hosted browser or current thin desktop shell reloads to fetch the current
 * Grotto App. Older releases still carrying a bundled renderer must install an
 * App update instead.
 */
export function updateRequiredMode(): UpdateRequiredMode {
    return isElectronDesktopApp() && !getDesktopBridge()?.loadsApp ? 'desktop-update' : 'reload';
}

/** True when a tRPC error is the hosted Server's protocol-mismatch rejection. */
export function isUpdateRequiredError(error: unknown): boolean {
    return readTrpcCode(error) === updateRequiredTrpcCode;
}

function readTrpcCode(error: unknown): string | null {
    const record = asRecord(error);

    return (
        readNestedString(record, ['data', 'code']) ??
        readNestedString(record, ['shape', 'data', 'code']) ??
        null
    );
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function readNestedString(
    source: Record<string, unknown> | null,
    path: readonly string[]
): string | null {
    let current: unknown = source;

    for (const key of path) {
        current = asRecord(current)?.[key];
    }

    return typeof current === 'string' ? current : null;
}
