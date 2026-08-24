import type { McpConnection, McpPresetAccountCreate } from '@grotto/api';
import type { GrottoDatabase } from '../postgres/connection.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import type { McpRuntime } from './runtime.ts';
import { createMcpConnection } from './service.ts';

const presets = {
    'google-calendar': {
        name: 'Google Calendar',
        url: 'https://calendarmcp.googleapis.com/mcp/v1',
    },
    merchbase: {
        name: 'MerchBase',
        url: 'https://app.merchbase.co/mcp',
    },
} as const;

export async function createMcpPresetAccount(
    db: GrottoDatabase,
    runtime: McpRuntime,
    member: GrottoUser | null,
    input: McpPresetAccountCreate
): Promise<McpConnection> {
    const preset = presets[input.preset];
    return await createMcpConnection(
        db,
        runtime,
        member,
        {
            auth: 'oauth',
            headers: {},
            name: input.name || preset.name,
            oauthScopes: [],
            serverId: input.serverId,
            url: preset.url,
        },
        input.preset
    );
}
