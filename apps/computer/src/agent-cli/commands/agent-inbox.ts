import { type AgentApiRequester, createAgentApiClient } from '../agent-api-client.ts';
import { agentInboxCheckResponseSchema } from '../agent-api-schemas.ts';
import type { SubCommand } from '../subcommand.ts';

interface InboxDeps {
    client: AgentApiRequester;
    write(text: string): void;
}

export const INBOX_SUBCOMMANDS: SubCommand[] = [
    {
        examples: ['grotto inbox check'],
        flags: [],
        name: 'check',
        positionals: [],
        run: () => runInboxCheck(defaultDeps()),
        summary: 'List pending targets without draining them',
        usage: 'grotto inbox check',
    },
];

export async function runInboxCheck(deps: InboxDeps): Promise<number> {
    const response = await deps.client.request('/api/agent/inbox', agentInboxCheckResponseSchema);
    if (response.rows.length === 0) {
        deps.write('No pending messages.\n');
        return 0;
    }
    const lines = response.rows.map((row) => {
        const tags = [
            ...(row.thread ? [' · thread'] : []),
            ...(row.dm ? [' · dm'] : []),
            ...(row.mentioned ? [' · you were mentioned'] : []),
        ].join('');
        return `${row.target}  pending: ${row.pendingCount} message(s) · first msg=${row.firstShortId} · latest sender @${row.latestSender} · latest msg=${row.latestShortId}${tags}`;
    });
    lines.push('Read pending bodies with grotto message check.');
    deps.write(`${lines.join('\n')}\n`);
    return 0;
}

function defaultDeps(): InboxDeps {
    return {
        client: createAgentApiClient(),
        write: (text) => process.stdout.write(text),
    };
}
