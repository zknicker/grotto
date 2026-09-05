import { Data } from 'effect';

export type McpUpstreamCode = 'MCP_AUTH_REQUIRED' | 'MCP_TIMEOUT' | 'MCP_UNAVAILABLE';

/** Foreign MCP client construction failed before a usable client existed. */
export class McpClientAcquireError extends Data.TaggedError('McpClientAcquireError')<{
    readonly cause: unknown;
}> {}

/** The cache retired an entry while an acquisition or operation was still in flight. */
export class McpClientRetiredError extends Data.TaggedError('McpClientRetiredError') {}

export type McpIconIoOperation =
    | 'mcp.icon.fetch'
    | 'mcp.icon.response.inspect'
    | 'mcp.icon.reader.acquire'
    | 'mcp.icon.reader.cancel'
    | 'mcp.icon.reader.read'
    | 'mcp.icon.reader.release';

/** Foreign icon fetch or stream IO failed; icon resolution can safely fall back. */
export class McpIconIoError extends Data.TaggedError('McpIconIoError')<{
    readonly cause: unknown;
    readonly operation: McpIconIoOperation;
}> {}

export class McpDeniedError extends Error {
    readonly code = 'MCP_DENIED';
}

export class McpUpstreamError extends Error {
    constructor(
        readonly code: McpUpstreamCode,
        message: string,
        options?: ErrorOptions
    ) {
        super(message, options);
        this.name = 'McpUpstreamError';
    }
}

export type McpFailureKind = 'error' | 'mcp-tagged' | 'null' | 'object' | 'primitive';

/** Safe diagnostic classification; never inspect or serialize foreign error text. */
export function mcpFailureKind(cause: unknown): McpFailureKind {
    if (cause === null) {
        return 'null';
    }
    if (typeof cause !== 'object' && typeof cause !== 'function') {
        return 'primitive';
    }
    try {
        if (
            cause instanceof McpClientAcquireError ||
            cause instanceof McpClientRetiredError ||
            cause instanceof McpIconIoError
        ) {
            return 'mcp-tagged';
        }
        return cause instanceof Error ? 'error' : 'object';
    } catch {
        return 'object';
    }
}

export function asMcpArguments(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    throw new McpDeniedError('MCP tool arguments must be an object.');
}

export function classifyMcpUpstreamError(
    cause: unknown,
    operation: 'discovery' | 'invocation'
): McpUpstreamError {
    if (cause instanceof McpUpstreamError) {
        return cause;
    }
    const status = readNumericProperty(cause, 'statusCode') ?? readNumericProperty(cause, 'status');
    if (status === 401 || status === 403) {
        return new McpUpstreamError(
            'MCP_AUTH_REQUIRED',
            'Reconnect this MCP connection before using it.',
            { cause }
        );
    }
    if (isTimeout(cause)) {
        return new McpUpstreamError('MCP_TIMEOUT', `The MCP ${operation} timed out.`, {
            cause,
        });
    }
    return new McpUpstreamError('MCP_UNAVAILABLE', `The MCP ${operation} is unavailable.`, {
        cause,
    });
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
