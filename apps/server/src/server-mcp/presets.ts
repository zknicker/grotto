import type { McpConnection, McpPresetAccountCreate } from '@haus/api';
import type { HausDatabase } from '../postgres/connection.ts';
import type { HausUser } from '../users/haus-user.ts';
import type { McpIconResolver } from './icons.ts';
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
    db: HausDatabase,
    runtime: McpRuntime,
    resolveIcon: McpIconResolver,
    member: HausUser | null,
    input: McpPresetAccountCreate
): Promise<McpConnection> {
    const preset = presets[input.preset];
    return await createMcpConnection(
        db,
        runtime,
        resolveIcon,
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
