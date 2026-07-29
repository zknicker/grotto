export type RuntimeFailureKind =
    | 'authentication'
    | 'configuration'
    | 'input'
    | 'rate-limit'
    | 'timeout'
    | 'transport'
    | 'unknown';

export function classifyRuntimeFailure(error: unknown): RuntimeFailureKind {
    const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    const normalized = message.toLowerCase();
    if (
        /not logged in|sign.?in required|unauthorized|authentication|invalid api key|oauth|\\b401\\b/u.test(
            normalized
        )
    ) {
        return 'authentication';
    }
    if (
        /unknown model|model .*(not found|unsupported|invalid)|unsupported model|invalid model/u.test(
            normalized
        )
    ) {
        return 'configuration';
    }
    if (
        /context window|too many tokens|input .*too large|payload too large|\\b413\\b/u.test(
            normalized
        )
    ) {
        return 'input';
    }
    if (/rate.?limit|too many requests|quota|\\b429\\b/u.test(normalized)) {
        return 'rate-limit';
    }
    if (/timed out|timeout/u.test(normalized)) {
        return 'timeout';
    }
    if (
        /econn|websocket|connection (closed|failed|refused|reset)|network|fetch failed/u.test(
            normalized
        )
    ) {
        return 'transport';
    }
    return 'unknown';
}

export function isRetryableRuntimeFailure(kind: RuntimeFailureKind): boolean {
    return !['authentication', 'configuration', 'input'].includes(kind);
}
