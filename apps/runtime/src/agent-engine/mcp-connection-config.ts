import type { AgentRuntimeMcpConnectionCreate } from '@tavern/api';
import * as z from 'zod';
import type { McpConnectionRow, StoredMcpSecret } from './mcp-connection-store.ts';

export const builtInMcpConnections = [
    {
        auth: 'oauth',
        id: 'google-calendar',
        name: 'Google Calendar',
        preset: 'google-calendar',
        url: 'https://calendarmcp.googleapis.com/mcp/v1',
    },
    {
        auth: 'oauth',
        id: 'merchbase',
        name: 'MerchBase',
        preset: 'merchbase',
        url: 'https://app.merchbase.co/mcp',
    },
] as const;

const builtInByPreset = new Map(
    builtInMcpConnections.map((connection) => [connection.preset, connection])
);

export function getBuiltInMcpConnection(
    preset: McpConnectionRow['preset'] extends infer Preset ? Exclude<Preset, null> : never
) {
    return builtInByPreset.get(preset);
}

export function isSeededBuiltIn(id: string) {
    return builtInMcpConnections.some((connection) => connection.id === id);
}

export function seededIdentityChanged(
    existing: McpConnectionRow,
    canonical: (typeof builtInMcpConnections)[number]
) {
    return (
        existing.preset !== canonical.preset ||
        existing.transport !== 'http' ||
        existing.auth !== canonical.auth ||
        existing.url !== canonical.url ||
        existing.command !== null ||
        existing.args_json !== '[]' ||
        existing.header_names_json !== '[]'
    );
}

export function configuredMcpSecret(input: AgentRuntimeMcpConnectionCreate): StoredMcpSecret {
    return {
        approvedAuthorizationServerOrigins: [],
        ...(input.oauthClientId
            ? {
                  configuredClientInformation: {
                      client_id: input.oauthClientId,
                      ...(input.oauthClientSecret === undefined
                          ? {}
                          : { client_secret: input.oauthClientSecret }),
                  },
              }
            : {}),
        env: input.env ?? {},
        headers: input.headers ?? {},
        oauthScopes: input.oauthScopes ?? [],
    };
}

export function sameMcpSecretConfiguration(left: StoredMcpSecret, right: StoredMcpSecret) {
    return (
        stableJson(left.env) === stableJson(right.env) &&
        stableJson(left.headers) === stableJson(right.headers) &&
        stableJson(left.configuredClientInformation) ===
            stableJson(right.configuredClientInformation) &&
        stringArraysEqual(left.oauthScopes, right.oauthScopes)
    );
}

export function slugifyMcpConnectionName(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, '')
        .slice(0, 64);
}

export function parseMcpStringArray(value: string): string[] {
    const parsed: unknown = JSON.parse(value);
    return z.array(z.string()).parse(parsed);
}

export function stringArraysEqual(left: string[], right: string[]) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function stableJson(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return JSON.stringify(value);
    }
    return JSON.stringify(
        Object.fromEntries(
            Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
                left.localeCompare(right)
            )
        )
    );
}
