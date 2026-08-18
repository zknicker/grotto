function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function readNestedNumber(
    source: Record<string, unknown> | null,
    path: readonly string[]
): number | null {
    let current: unknown = source;

    for (const key of path) {
        current = asRecord(current)?.[key];
    }

    return typeof current === 'number' ? current : null;
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

function getHttpStatus(error: unknown) {
    const record = asRecord(error);

    return (
        readNestedNumber(record, ['data', 'httpStatus']) ??
        readNestedNumber(record, ['shape', 'data', 'httpStatus']) ??
        readNestedNumber(record, ['meta', 'responseJSON', '0', 'error', 'json', 'status']) ??
        null
    );
}

function getTrpcCode(error: unknown) {
    const record = asRecord(error);

    return (
        readNestedString(record, ['data', 'code']) ??
        readNestedString(record, ['shape', 'data', 'code']) ??
        null
    );
}

function isRouteNotFound(error: unknown) {
    const record = asRecord(error);
    const message =
        readNestedString(record, ['message']) ??
        readNestedString(record, ['shape', 'message']) ??
        '';

    return message.includes('Route') && message.includes('not found');
}

export function shouldRetryQuery(failureCount: number, error: unknown) {
    if (failureCount >= 3) {
        return false;
    }

    const httpStatus = getHttpStatus(error);

    if (httpStatus !== null && httpStatus >= 400 && httpStatus < 500) {
        return false;
    }

    const trpcCode = getTrpcCode(error);

    if (
        trpcCode &&
        [
            'BAD_REQUEST',
            'FORBIDDEN',
            'METHOD_NOT_SUPPORTED',
            'NOT_FOUND',
            'PARSE_ERROR',
            'PRECONDITION_FAILED',
            'UNAUTHORIZED',
        ].includes(trpcCode)
    ) {
        return false;
    }

    if (isRouteNotFound(error)) {
        return false;
    }

    return true;
}
