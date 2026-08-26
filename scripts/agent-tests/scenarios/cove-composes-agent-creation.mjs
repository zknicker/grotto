// Opt-in live proof for the complete Cove recipe. This uses the real seeded
// Server and attached Computer; the image fixture makes the one provider
// boundary deterministic without persisting the concept or calling OpenAI.

import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    contract:
        'Cove turns one short brief into one avatar-backed pending Agent action, finishes the preparation turn, then after human commit makes one distinct continuation that sends one substantive ordinary Chat message to the created Agent.',
    name: 'cove-composes-agent-creation',
    optIn: true,
    async run({ expect, kit, log, marker, settleTurn }) {
        const requestLogPath = process.env.GROTTO_AGENT_E2E_AVATAR_REQUEST_LOG;
        const fixturePath = process.env.GROTTO_AGENT_E2E_AVATAR_FIXTURE_PATH;
        if (
            process.env.GROTTO_AGENT_E2E_AVATAR_FIXTURE !== '1' ||
            !fixturePath ||
            !isAbsolute(fixturePath) ||
            !requestLogPath ||
            !isAbsolute(requestLogPath)
        ) {
            throw new Error(
                'This opt-in scenario requires GROTTO_AGENT_E2E_AVATAR_FIXTURE=1, an absolute GROTTO_AGENT_E2E_AVATAR_FIXTURE_PATH, and an absolute GROTTO_AGENT_E2E_AVATAR_REQUEST_LOG.'
            );
        }

        const agents = await kit.trpc('agent.list', { serverId: kit.serverId });
        const cove = agents.find(
            (agent) => agent.factoryKind === 'cove' && agent.handle === 'cove'
        );
        if (!cove) {
            throw new Error(
                'This opt-in scenario requires an active Cove created through the onboarding flow.'
            );
        }
        expect(cove.dmChatId, 'Cove Owner DM').toBeTruthy();

        const target = await terraTarget(kit, cove.computerId);
        await withTemporaryAgentConfiguration(
            kit.harness,
            cove,
            target,
            async () => {
                const requestsBefore = await fixtureRequestCount(requestLogPath);
                const brief = [
                    `${marker('COVE')} Use recipes/playbook/agent-creation for this short freeform Agent request.`,
                    'Create one vivid, high-personality cartoon character for a teammate who keeps launch notes clear and useful.',
                    'Preserve the requested Agent name: Mossy Lantern.',
                    'Generate exactly one avatar before preparing exactly one native create-Agent action carrying that avatar.',
                    'After preparing the action, finish this preparation turn. Do not create the Agent, poll, sleep, or send a bootstrap message yet.',
                ].join(' ');

                log('asking Cove for one avatar-backed proposal');
                const receipt = await kit.harness.send(cove.dmChatId, brief);
                const preparation = await settleTurn(cove.id, {
                    settleWithin: 300_000,
                    startWithin: 120_000,
                });
                expect(preparation.status, 'preparation turn status').toBe('completed');
                expect(preparation.failureKind ?? 'none', 'preparation turn failure kind').toBe(
                    'none'
                );

                const coveMessages = await kit.readMessages(cove.dmChatId);
                const pendingActions = coveMessages.filter(
                    (message) =>
                        message.sequence > receipt.message.sequence &&
                        message.author.kind === 'agent' &&
                        message.author.agentId === cove.id &&
                        message.preparedAction?.kind === 'agent:create' &&
                        message.preparedAction.status === 'pending'
                );
                expect(pendingActions, 'one pending Agent action').toHaveLength(1);
                const actionMessage = pendingActions[0];
                const action = actionMessage?.preparedAction;
                expect(action?.proposal.avatar.id, 'pending action avatar media').toBeTruthy();
                expect(
                    action?.proposal.avatar.byteSize,
                    'pending action avatar bytes'
                ).toBeGreaterThan(0);

                const requestsAfter = await fixtureRequestCount(requestLogPath);
                expect(requestsAfter - requestsBefore, 'avatar provider requests').toBe(1);

                const handle = `cove-recipe-${kit.stamp.slice(-10).toLowerCase()}`;
                const committed = await kit.trpc('preparedAction.commit', {
                    actionId: action.id,
                    computerId: cove.computerId,
                    description: action.proposal.description,
                    displayName: action.proposal.name,
                    handle,
                    modelId: target.modelId,
                    reasoningEffort: cove.desiredReasoningEffort,
                    runtimeId: target.runtimeId,
                    serverId: kit.serverId,
                });
                await kit.trackAgent(committed.agent);
                expect(committed.action.status, 'committed action status').toBe('executed');

                const committedAgents = (
                    await kit.trpc('agent.list', { serverId: kit.serverId })
                ).filter((agent) => agent.id === committed.agent.id);
                expect(committedAgents, 'one committed Agent').toHaveLength(1);

                log('waiting for Cove’s typed action continuation');
                const continuation = await settleTurn(cove.id, {
                    settleWithin: 300_000,
                    startWithin: 120_000,
                });
                expect(continuation.status, 'Cove continuation status').toBe('completed');
                expect(continuation.failureKind ?? 'none', 'Cove continuation failure kind').toBe(
                    'none'
                );
                expect(
                    continuation.runId === preparation.runId,
                    'Cove continuation is distinct'
                ).toBe(false);

                const createdMessages = await kit.readMessages(committed.chat.id);
                const starters = createdMessages.filter(
                    (message) =>
                        message.author.kind === 'agent' &&
                        message.author.agentId === cove.id &&
                        message.content.trim().length > 0
                );
                expect(starters, 'one substantive Cove starter Chat message').toHaveLength(1);

                log('settling the created Agent’s ordinary delivery');
                const createdTurn = await settleTurn(committed.agent.id, {
                    settleWithin: 300_000,
                    startWithin: 120_000,
                });
                expect(createdTurn.status, 'created Agent turn status').toBe('completed');
                expect(createdTurn.failureKind ?? 'none', 'created Agent turn failure kind').toBe(
                    'none'
                );

                const deliveries = await kit.turns.listDeliveries(committed.agent.id);
                const starterDeliveries = (deliveries ?? []).filter(
                    (delivery) =>
                        delivery.workId === starters[0]?.id &&
                        delivery.source === `agent:${cove.handle}` &&
                        delivery.state === 'seen'
                );
                expect(starterDeliveries, 'starter delivered through ordinary Chat').toHaveLength(
                    1
                );
            },
            log
        );
    },
});

export async function withTemporaryAgentConfiguration(harness, agent, target, operation, log) {
    const original = {
        modelId: agent.desiredModelId,
        runtimeId: agent.desiredRuntimeId,
    };
    const changed = original.modelId !== target.modelId || original.runtimeId !== target.runtimeId;
    let configured = false;

    try {
        if (changed) {
            configured = true;
            log?.('configuring Cove on the reported Terra inventory');
            await harness.configureAgent(agent, target.runtimeId, target.modelId);
        }
        return await operation();
    } finally {
        if (configured) {
            log?.('restoring Cove’s original runtime/model');
            await harness.configureAgent(agent, original.runtimeId, original.modelId);
        }
    }
}

async function terraTarget(kit, computerId) {
    const computers = await kit.trpc('computer.list', { serverId: kit.serverId });
    const computer = computers.find((candidate) => candidate.id === computerId);
    const runtime = computer?.reportedInventory?.runtimes?.find(
        (candidate) => candidate.id === 'codex'
    );
    const model = runtime?.models?.find((candidate) =>
        candidate.id.toLowerCase().includes('terra')
    );
    if (!(computer && runtime && model && computer.health === 'healthy')) {
        throw new Error(
            'This opt-in scenario requires Cove’s attached Computer to be healthy and report a codex Terra model.'
        );
    }
    return { modelId: model.id, runtimeId: runtime.id };
}

async function fixtureRequestCount(file) {
    const contents = await readFile(file, 'utf8').catch(() => '');
    return contents.split('\n').filter((line) => line.trim().length > 0).length;
}
