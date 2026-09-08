import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'An explicit request for an unavailable MCP settles with a blocker reply and at most four tools, including cold-start recovery, without a local configuration search.',
    name: 'unavailable-mcp-response-efficiency',
    optIn: true,
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [worker] = agents;
        const dm = worker.dmChatId;
        expect(dm, 'worker Owner DM').toBeTruthy();
        const head = await kit.readHead(dm);
        await kit.harness.send(
            dm,
            `Use the ${marker('SHOP')} MCP to tell me today's sales. If that MCP is unavailable, reply with UNAVAILABLE.`
        );
        const turn = await settleTurn(worker.id);
        expect(turn.status, 'turn').toBe('completed');
        const replies = kit.authoredBy(await kit.readMessages(dm), worker.id, head);
        expect(replies, 'blocker reply').toHaveLength(1);
        expect(replies[0], 'unavailable marker').toContain('UNAVAILABLE');
        const result = await kit.trpc('agent.executionJournal', {
            agentId: worker.id,
            runId: turn.runId,
            serverId: kit.serverId,
        });
        expect(result.status, 'execution evidence').toBe('available');
        const { journal } = result;
        const reconnaissance = journal.tools.filter((tool) => {
            const command = tool.input?.command;
            return (
                typeof command === 'string' &&
                /\b(?:rg|grep|find|env|printenv)\b|config\.(?:toml|json|ya?ml)/u.test(command)
            );
        });
        expect(reconnaissance, 'no local capability reconnaissance').toHaveLength(0);
        log(
            `unavailable MCP: ${Date.parse(journal.endedAt) - Date.parse(journal.startedAt)}ms, ${journal.tools.length} tools`
        );
        expect(journal.tools.length <= 4, 'bounded capability discovery').toBe(true);
    },
});
