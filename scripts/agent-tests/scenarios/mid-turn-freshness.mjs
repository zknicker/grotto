// A message that lands while an Agent is already working must reach that Agent's
// running turn. The Agent is put to work for long enough to receive one, and the
// answer must carry the release color it could only have read mid-turn.

import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'An Agent working a long turn incorporates a Channel message that arrives mid-turn, and its settled reply — in the Channel or in the task Thread it promoted — carries that message marker.',
    name: 'mid-turn-freshness',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [worker] = agents;
        const color = marker('COLOR');

        const channel = await kit.createChannel({ agentIds: [worker.id] });
        const channelHead = await kit.readHead(channel.id);
        const prompt = `@${worker.handle} run the shell command "sleep 12". Then reply only with the release color from any message that arrived while you were working, or NO-COLOR if none arrived.`;

        log('sending the long-running prompt');
        await kit.harness.send(channel.id, prompt);

        // settleTurn reports 'turn active' the moment the Server sees the turn
        // running, which is exactly the window the follow-up has to land in.
        let midTurnSend = null;
        let midTurnError = null;
        const turn = await settleTurn(worker.id, {
            onPhase: (phase) => {
                log(phase);
                midTurnSend ??= kit.harness
                    .send(channel.id, `The release color for this exercise is ${color}.`)
                    .catch((error) => {
                        midTurnError = error;
                    });
            },
            startWithin: 60_000,
        });
        await midTurnSend;
        if (midTurnError) {
            throw midTurnError;
        }
        expect(midTurnSend, 'mid-turn message was sent while the turn was active').toBeTruthy();

        expect(turn.status, 'turn status').toBe('completed');
        expect(turn.failureKind ?? 'none', 'turn failure kind').toBe('none');
        expect(turn.outputProduced, 'turn produced durable output').toBe(true);

        log('checking gates');
        const channelReplies = kit.authoredBy(
            await kit.readMessages(channel.id),
            worker.id,
            channelHead
        );

        // The Agent may answer inline or promote the prompt to a task Thread;
        // both are valid containers for this contract.
        const tasks = await kit.trpc('task.list', { serverId: kit.serverId });
        const promoted = tasks.find(
            (entry) => entry.task.chatId === channel.id && entry.message.content === prompt
        );
        let threadReplies = [];
        if (promoted) {
            await kit.trackChat(promoted.task.threadChatId);
            threadReplies = kit.authoredBy(
                await kit.readMessages(promoted.task.threadChatId),
                worker.id,
                0
            );
        }

        const replies = [...channelReplies, ...threadReplies];
        expect(
            replies.length,
            'replies in the channel or the promoted task Thread'
        ).toBeGreaterThan(0);
        expect(replies, 'reply carrying the mid-turn release color').toContain(color);
    },
});
