/** The headers a public origin can be read from, HTTP request or WebSocket alike. */
export interface OriginHeaders {
    headers?: Record<string, string | string[] | undefined>;
    /** Fastify's resolved connection scheme; absent on a raw socket upgrade. */
    protocol?: string;
}

/**
 * The public address an outside system POSTs to. The Server has no configured
 * public origin, so every reader derives one with {@link publicOrigin} from the
 * request the caller actually made.
 */
export function triggerUrl(origin: string, triggerId: string): string {
    return new URL(`/api/triggers/${triggerId}`, origin).toString();
}

/** The ready-to-paste probe handed to whoever asked for the trigger. */
export function triggerCurlCommand(url: string, secret: string): string {
    return `curl -X POST ${url} -H "Authorization: Bearer ${secret}" -H "Content-Type: application/json" -d '{"hello":"world"}'`;
}

/**
 * The origin the caller reached, from whatever carries this request. tRPC hands
 * its context the same Fastify request the Agent routes read, so operator
 * responses name the same address the Agent's `url` does.
 */
export function publicOrigin(carrier: OriginHeaders): string {
    const headers = carrier.headers;
    const host = firstHeader(headers?.['x-forwarded-host']) ?? firstHeader(headers?.host);
    const protocol = firstHeader(headers?.['x-forwarded-proto']) ?? carrier.protocol ?? 'http';
    return `${protocol.split(',')[0].trim()}://${(host ?? '127.0.0.1').split(',')[0].trim()}`;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
    const header = Array.isArray(value) ? value[0] : value;
    return typeof header === 'string' && header.length > 0 ? header : undefined;
}
