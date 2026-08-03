export type ClerkTransport = 'browser' | 'native';

export function resolveClerkTransport({
    electron,
}: {
    development: boolean;
    electron: boolean;
}): ClerkTransport {
    return electron ? 'native' : 'browser';
}
