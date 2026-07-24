import type { McpConnectionListOutput, McpConnectionSaveInput } from '../../../lib/trpc.tsx';

export type McpConnection = McpConnectionListOutput['connections'][number];
export type McpConnectionFilter = 'all' | 'connected' | 'not-connected';
export type McpConnectionTransport = 'http' | 'stdio';

export interface SecretDraftEntry {
    key: string;
    name: string;
    value: string;
}

export interface McpConnectionDraft {
    args: string;
    auth: 'headers' | 'none' | 'oauth';
    command: string;
    env: SecretDraftEntry[];
    headers: SecretDraftEntry[];
    name: string;
    oauthClientId: string;
    oauthClientSecret: string;
    oauthScopes: string;
    transport: McpConnectionTransport;
    url: string;
}

export function connectionSummary(connection: McpConnection): string {
    if (connection.transport === 'stdio') {
        return [connection.command, ...connection.args].filter(Boolean).join(' ');
    }
    return connection.url ?? '';
}

export function visibleConnections(
    connections: McpConnection[],
    filter: McpConnectionFilter
): McpConnection[] {
    if (filter === 'all') {
        return connections;
    }
    return connections.filter((connection) =>
        filter === 'connected' ? connection.connected : !connection.connected
    );
}

export function createConnectionDraft(): McpConnectionDraft {
    return {
        args: '',
        auth: 'none',
        command: '',
        env: [],
        headers: [],
        name: '',
        oauthClientId: '',
        oauthClientSecret: '',
        oauthScopes: '',
        transport: 'http',
        url: '',
    };
}

export function buildSaveInput(draft: McpConnectionDraft): McpConnectionSaveInput {
    const env = toSecretRecord(draft.env);
    const headers = toSecretRecord(draft.headers);
    return {
        args: draft.transport === 'stdio' ? splitArgs(draft.args) : undefined,
        auth: draft.transport === 'stdio' ? 'none' : draft.auth,
        command: draft.transport === 'stdio' ? draft.command.trim() : undefined,
        env: Object.keys(env).length > 0 ? env : undefined,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        name: draft.name.trim(),
        oauthClientId:
            draft.transport === 'http' && draft.auth === 'oauth'
                ? draft.oauthClientId.trim() || undefined
                : undefined,
        oauthClientSecret:
            draft.transport === 'http' && draft.auth === 'oauth'
                ? draft.oauthClientSecret || undefined
                : undefined,
        oauthScopes:
            draft.transport === 'http' && draft.auth === 'oauth'
                ? splitArgs(draft.oauthScopes)
                : undefined,
        url: draft.transport === 'http' ? draft.url.trim() : undefined,
    };
}

export function createSecretDraftEntry(): SecretDraftEntry {
    return { key: crypto.randomUUID(), name: '', value: '' };
}

export function splitArgs(value: string) {
    return value.split(/\s+/u).filter(Boolean);
}

export function toSecretRecord(entries: SecretDraftEntry[]) {
    return Object.fromEntries(
        entries
            .map((entry) => [entry.name.trim(), entry.value] as const)
            .filter(([name]) => name.length > 0)
    );
}

export function joinArgs(args: string[]) {
    return args.join(' ');
}

export function toEnvRecord(entries: Array<{ name: string; value: string }>) {
    return Object.fromEntries(
        entries
            .map((entry) => [entry.name.trim(), entry.value] as const)
            .filter(([name]) => name.length > 0)
    );
}
