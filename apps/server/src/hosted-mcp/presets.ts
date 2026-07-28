import type { HostedMcpConnection, HostedMcpPresetAccountCreate } from '@tavern/api';
import type { GrottoDatabase } from '../postgres/connection.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import type { HostedMcpRuntime } from './runtime.ts';
import { createHostedMcpConnection } from './service.ts';

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

export async function createHostedMcpPresetAccount(
    db: GrottoDatabase,
    runtime: HostedMcpRuntime,
    member: GrottoUser | null,
    input: HostedMcpPresetAccountCreate
): Promise<HostedMcpConnection> {
    const preset = presets[input.preset];
    return await createHostedMcpConnection(
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
