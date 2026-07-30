export type HostedMcpUpstreamCode = 'MCP_AUTH_REQUIRED' | 'MCP_TIMEOUT' | 'MCP_UNAVAILABLE';

export class HostedMcpDeniedError extends Error {
    readonly code = 'MCP_DENIED';
}

export class HostedMcpUpstreamError extends Error {
    constructor(
        readonly code: HostedMcpUpstreamCode,
        message: string,
        options?: ErrorOptions
    ) {
        super(message, options);
        this.name = 'HostedMcpUpstreamError';
    }
}

export function classifyHostedMcpUpstreamError(
    cause: unknown,
    operation: 'discovery' | 'invocation'
): HostedMcpUpstreamError {
    if (cause instanceof HostedMcpUpstreamError) {
        return cause;
    }
    const status = readNumericProperty(cause, 'statusCode') ?? readNumericProperty(cause, 'status');
    if (status === 401 || status === 403) {
        return new HostedMcpUpstreamError(
            'MCP_AUTH_REQUIRED',
            'Reconnect this MCP connection before using it.',
            { cause }
        );
    }
    if (isTimeout(cause)) {
        return new HostedMcpUpstreamError('MCP_TIMEOUT', `The MCP ${operation} timed out.`, {
            cause,
        });
    }
    return new HostedMcpUpstreamError('MCP_UNAVAILABLE', `The MCP ${operation} is unavailable.`, {
        cause,
    });
}

export async function withHostedMcpTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
    label: 'discovery' | 'invocation'
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            reject(new HostedMcpUpstreamError('MCP_TIMEOUT', `The MCP ${label} timed out.`));
        }, timeoutMs);
    });
    try {
        return await Promise.race([operation, timeout]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}

function isTimeout(cause: unknown): boolean {
    if (!(cause instanceof Error)) {
        return false;
    }
    const code = readStringProperty(cause, 'code');
    return (
        cause.name === 'AbortError' ||
        code === 'ETIMEDOUT' ||
        code === 'UND_ERR_CONNECT_TIMEOUT' ||
        /\b(?:abort|timed?\s*out|timeout)\b/iu.test(cause.message)
    );
}

function readNumericProperty(value: unknown, key: string): number | undefined {
    if (typeof value !== 'object' || value === null || !(key in value)) {
        return undefined;
    }
    const property = Reflect.get(value, key);
    return typeof property === 'number' ? property : undefined;
}

function readStringProperty(value: unknown, key: string): string | undefined {
    if (typeof value !== 'object' || value === null || !(key in value)) {
        return undefined;
    }
    const property = Reflect.get(value, key);
    return typeof property === 'string' ? property : undefined;
}
