// Agent workspace files are durable Computer state, not session memory. A file
// written in one session must still be readable by the same Agent after its
// session is reset, and the Server must be able to read the exact bytes.

import { sleep } from '../../eval-harness.mjs';
import { isReady } from '../pool.mjs';
import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'A file an Agent writes to its workspace is readable through agent.workspaceFile and is still recoverable by that Agent after a session reset.',
    name: 'workspace-survives-fresh-session',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [worker] = agents;
        const token = marker('WORKSPACE');
        const workspacePath = `eval-notes/${kit.stamp}.md`;
        const markerLine = `Workspace marker: ${token}`;

        // The Owner DM is standing collaboration: never tracked, so cleanup can
        // never delete it. Sequence gates replace deletion here.
        const dm = worker.dmChatId;
        if (!dm) {
            throw new Error(`@${worker.handle} has no standing Owner DM to work in.`);
        }
        const writeHead = await kit.readHead(dm);

        log('asking for the workspace file');
        await kit.harness.send(
            dm,
            `Create ${workspacePath} in your workspace containing exactly the line "${markerLine}". Reply only SAVED once the file is durable.`
        );

        const writeTurn = await settleTurn(worker.id);
        expect(writeTurn.status, 'write turn status').toBe('completed');
        expect(writeTurn.failureKind ?? 'none', 'write turn failure kind').toBe('none');
        expect(writeTurn.outputProduced, 'write turn produced durable output').toBe(true);

        const writeReplies = kit.authoredBy(await kit.readMessages(dm), worker.id, writeHead);
        expect(writeReplies.length, 'DM replies to the write request').toBeGreaterThan(0);
        expect(writeReplies.at(-1).trim(), 'write acknowledgement').toBe('SAVED');

        const file = await kit.trpc('agent.workspaceFile', {
            agentId: worker.id,
            path: workspacePath,
            serverId: kit.serverId,
        });
        expect(file.path, 'workspace file path').toBe(workspacePath);
        expect(file.content, 'workspace file content').toContain(markerLine);

        log('resetting the session');
        await kit.trpc('agent.reset', {
            agentId: worker.id,
            kind: 'session',
            serverId: kit.serverId,
        });
        await waitForAgentReady(kit, worker.id);

        const recallHead = await kit.readHead(dm);
        await kit.harness.send(
            dm,
            `Read ${workspacePath} from your workspace and reply with the complete "Workspace marker:" line.`
        );

        const recallTurn = await settleTurn(worker.id);
        expect(recallTurn.status, 'recall turn status').toBe('completed');
        expect(recallTurn.failureKind ?? 'none', 'recall turn failure kind').toBe('none');
        expect(recallTurn.outputProduced, 'recall turn produced durable output').toBe(true);

        log('checking gates');
        const recallReplies = kit.authoredBy(await kit.readMessages(dm), worker.id, recallHead);
        expect(recallReplies.length, 'DM replies after the session reset').toBeGreaterThan(0);
        expect(recallReplies, 'recovered workspace marker').toContain(token);
    },
});

/** A reset Agent is only usable again once the Server reports it ready. */
async function waitForAgentReady(kit, agentId, timeoutMs = 120_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const agents = await kit.trpc('agent.list', { serverId: kit.serverId });
        const agent = agents.find((candidate) => candidate.id === agentId);
        if (isReady(agent)) {
            return agent;
        }
        await sleep(1000);
    }
    throw new Error(
        `Agent ${agentId} never became ready again within ${Math.round(timeoutMs / 1000)}s after its session reset.`
    );
}
