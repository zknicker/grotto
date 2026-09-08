import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'A simple same-session follow-up retains the prior question and answers without a startup memory read, using at most three tools including an optional memory update.',
    name: 'warm-dm-response-efficiency',
    optIn: true,
    async run({ agents, expect, kit, log, settleTurn }) {
        const [worker] = agents;
        const dm = worker.dmChatId;
        expect(dm, 'worker Owner DM').toBeTruthy();

        await kit.harness.send(dm, 'What is 7 multiplied by 6? Answer briefly.');
        const first = await settleTurn(worker.id);
        expect(first.status, 'first turn').toBe('completed');

        const head = await kit.readHead(dm);
        await kit.harness.send(dm, 'Now use 8 as the first number.');
        const turn = await settleTurn(worker.id);
        expect(turn.status, 'warm turn').toBe('completed');
        const replies = kit.authoredBy(await kit.readMessages(dm), worker.id, head);
        expect(replies, 'warm reply').toHaveLength(1);
        expect(replies[0], 'retained question').toContain('48');

        const result = await kit.trpc('agent.executionJournal', {
            agentId: worker.id,
            runId: turn.runId,
            serverId: kit.serverId,
        });
        expect(result.status, 'execution evidence').toBe('available');
        const { journal } = result;
        expect(
            journal.tools.filter(
                (tool) =>
                    tool.toolName !== 'fileChange' &&
                    JSON.stringify(tool.input ?? null).includes('MEMORY.md')
            ),
            'no repeated startup memory read'
        ).toHaveLength(0);
        log(
            `warm turn: ${Date.parse(journal.endedAt) - Date.parse(journal.startedAt)}ms, ${journal.tools.length} tools`
        );
        expect(journal.tools.length <= 3, 'inbox, answer, optional memory update').toBe(true);
    },
});
