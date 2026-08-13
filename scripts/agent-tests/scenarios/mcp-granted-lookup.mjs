// A Server-owned MCP connection granted to one Agent is really used: the private
// record only exists behind the controlled MCP, so the exact title and owner in
// the reply can only come from a real tool call, and the call log proves it.

import { startControlledMcp } from '../controlled-mcp.mjs';
import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'An Agent granted a Server-owned MCP connection looks the requested record up exactly once through that connection and reports its exact private title and owner.',
    name: 'mcp-granted-lookup',
    async run({ agents, expect, kit, log, settleTurn }) {
        const [worker] = agents;
        expect(worker.dmChatId, 'worker Owner DM').toBeTruthy();

        const mcp = await startControlledMcp();
        let connectionId = null;
        try {
            log('adding the ledger connection');
            const connection = await kit.trpc('mcp.add', {
                auth: 'none',
                headers: {},
                name: `Audit Ledger ${kit.stamp}`,
                oauthScopes: [],
                serverId: kit.serverId,
                url: mcp.url,
            });
            connectionId = connection.id;
            expect(connection.tools, 'ledger tools').toContain('lookup_audit_record');

            await kit.trpc('mcp.setGrant', {
                agentId: worker.id,
                connectionId,
                enabled: true,
                serverId: kit.serverId,
            });
            const granted = await kit.trpc('mcp.list', { serverId: kit.serverId });
            const ledger = granted.find((entry) => entry.id === connectionId);
            const grantedAgentIds = (ledger?.grants ?? []).map((grant) => grant.agentId);
            expect(grantedAgentIds, 'ledger grants').toContain(worker.id);

            const record = {
                key: `BLUE-${kit.stamp}`,
                owner: `Owner-${kit.stamp}`,
                title: `Bluebird ${kit.stamp}`,
            };
            mcp.define(record.key, record);

            log('asking for the record');
            const head = await kit.readHead(worker.dmChatId);
            await kit.harness.send(
                worker.dmChatId,
                `Use the assigned Audit Ledger MCP to look up record ${record.key}. Reply with its exact title and owner. Do not guess.`
            );

            const turn = await settleTurn(worker.id);
            expect(turn.status, 'turn status').toBe('completed');
            expect(turn.failureKind ?? 'none', 'turn failure kind').toBe('none');
            expect(turn.outputProduced, 'turn produced durable output').toBe(true);

            log('checking gates');
            const replies = await agentReplies(kit, worker.id, worker.dmChatId, head);
            expect(replies, 'the private record title in the reply').toContain(record.title);
            expect(replies, 'the private record owner in the reply').toContain(record.owner);
            expect(
                mcp.calls.filter((call) => call.key === record.key),
                'controlled MCP lookups for the record key'
            ).toHaveLength(1);
        } finally {
            if (connectionId) {
                await kit
                    .trpc('mcp.delete', { connectionId, serverId: kit.serverId })
                    .catch(() => undefined);
            }
            await mcp.close();
        }
    },
});

/** Agent replies in the Owner DM, including any Thread the Agent opened there. */
async function agentReplies(kit, agentId, chatId, sinceSequence) {
    const page = await kit.trpc('chat.messages', { chatId, limit: 100, serverId: kit.serverId });
    const collected = kit.authoredBy(page.messages, agentId, sinceSequence);
    for (const thread of page.threads ?? []) {
        const messages = await kit.readMessages(thread.threadChatId);
        collected.push(...kit.authoredBy(messages, agentId));
    }
    return collected;
}
