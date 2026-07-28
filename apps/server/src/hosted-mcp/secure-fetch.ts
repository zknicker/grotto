export const secureMcpFetch = (async (
    input: Parameters<typeof globalThis.fetch>[0],
    init?: Parameters<typeof globalThis.fetch>[1]
) => {
    const value = input instanceof Request ? input.url : input.toString();
    assertSecureOrLoopbackUrl(value, 'MCP and OAuth request');
    return await globalThis.fetch(input, init);
}) as typeof globalThis.fetch;

export function assertSecureOrLoopbackUrl(value: string, label: string) {
    const url = new URL(value);
    const loopback = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== 'https:' && !loopback)) {
        throw new Error(`${label} must use HTTPS or loopback HTTP without user information.`);
    }
}
