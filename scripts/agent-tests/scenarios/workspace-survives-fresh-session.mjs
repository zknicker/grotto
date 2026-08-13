// Agent workspace files are durable Computer state, not session memory. A file
// written in one session must still be readable by the same Agent after its
// session is reset, and the Server must be able to read the exact bytes.

import { sleep } from '../../eval-harness.mjs';
import { isReady } from '../provisioner.mjs';
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
        // never delete it. Per-run markers replace deletion here.
        const dm = worker.dmChatId;
        if (!dm) {
            throw new Error(`@${worker.handle} has no standing Owner DM to work in.`);
        }

        log('asking for the workspace file');
        await kit.harness.send(
            dm,
            `Create ${workspacePath} in your workspace containing exactly the line "${markerLine}". Reply only SAVED once the file is durable.`
        );

        const writeTurn = await settleTurn(worker.id);
        expect(writeTurn.status, 'write turn status').toBe('completed');
        expect(writeTurn.failureKind ?? 'none', 'write turn failure kind').toBe('none');
        expect(writeTurn.outputProduced, 'write turn produced durable output').toBe(true);

        // A DM request can be promoted to a task and acknowledged in its Thread;
        // the durable file is the contract, not which container says SAVED.
        const saved = await kit.awaitAgentReply(dm, worker.id, (message) =>
            message.content.includes('SAVED')
        );
        expect(saved.message.content, 'write acknowledgement').toContain('SAVED');

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

        await kit.harness.send(
            dm,
            `Read ${workspacePath} from your workspace and reply with the complete "Workspace marker:" line.`
        );

        const recallTurn = await settleTurn(worker.id);
        expect(recallTurn.status, 'recall turn status').toBe('completed');
        expect(recallTurn.failureKind ?? 'none', 'recall turn failure kind').toBe('none');
        expect(recallTurn.outputProduced, 'recall turn produced durable output').toBe(true);

        log('checking gates');
        // Scoped to the recall turn so a pre-reset message that happened to echo
        // the marker cannot stand in for recovering it from the workspace.
        const recalled = await kit.awaitAgentReply(
            dm,
            worker.id,
            (message) =>
                message.content.includes(token) &&
                Date.parse(message.createdAt) >= Date.parse(recallTurn.startedAt)
        );
        expect(recalled.message.content, 'recovered workspace marker').toContain(token);
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
