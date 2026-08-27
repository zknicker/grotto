// Opt-in live proof for Cove's factory action-card guidance. This uses the real
// seeded Server and attached Computer; the image fixture makes the provider
// boundary deterministic without persisting the concept or calling OpenAI.

import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    contract:
        'Cove first answers a natural Agent proposal request in its Owner DM without an action, then a separate creation request produces one avatar-backed action in that same DM; human commit later drives one substantive ordinary starter Chat.',
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
        if (!(cove.desiredModelId && cove.desiredRuntimeId)) {
            throw new Error(
                'This opt-in scenario requires Cove to have a configured runtime and model.'
            );
        }

        const target = {
            modelId: cove.desiredModelId,
            runtimeId: cove.desiredRuntimeId,
        };
        await withTemporaryAgentConfiguration(
            kit.harness,
            cove,
            target,
            async () => {
                const requestsBefore = await fixtureRequestCount(requestLogPath);
                const proposalBrief = `${marker('COVE')} Can you propose a CTO / Systems Steward Agent for keeping this Computer reliable and secure?`;

                log('asking Cove for a prose Agent proposal');
                const proposalReceipt = await kit.harness.send(cove.dmChatId, proposalBrief);
                const proposalTurn = await settleTurn(cove.id, {
                    settleWithin: 300_000,
                    startWithin: 120_000,
                });
                expect(proposalTurn.status, 'proposal turn status').toBe('completed');
                expect(proposalTurn.failureKind ?? 'none', 'proposal turn failure kind').toBe(
                    'none'
                );

                const proposalMessages = (await kit.readMessages(cove.dmChatId)).filter(
                    (message) =>
                        message.sequence > proposalReceipt.message.sequence &&
                        message.author.kind === 'agent' &&
                        message.author.agentId === cove.id
                );
                expect(
                    proposalMessages.filter((message) => message.content.trim().length > 0),
                    'a substantive proposal in the parent DM'
                ).not.toHaveLength(0);
                expect(
                    proposalMessages.filter((message) => message.preparedAction),
                    'no action before the owner asks to create it'
                ).toHaveLength(0);
                const proposalTask = (await kit.trpc('task.list', { serverId: kit.serverId })).find(
                    (entry) => entry.message.id === proposalReceipt.message.id
                );
                if (proposalTask) {
                    await kit.trackChat(proposalTask.task.threadChatId);
                    expect(
                        (await kit.readMessages(proposalTask.task.threadChatId)).filter(
                            (message) => message.preparedAction
                        ),
                        'no premature action in the proposal Task Thread'
                    ).toHaveLength(0);
                }

                const creationBrief = `${marker('CREATE')} Looks good. Can you prepare that creation action? Name the Agent Mossy Lantern.`;
                log('asking Cove to prepare the approved Agent action');
                const creationReceipt = await kit.harness.send(cove.dmChatId, creationBrief);
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
                        message.sequence > creationReceipt.message.sequence &&
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

                const handle = `cove-parity-${kit.stamp.slice(-10).toLowerCase()}`;
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
            log?.('configuring Cove on the requested temporary runtime/model');
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

async function fixtureRequestCount(file) {
    const contents = await readFile(file, 'utf8').catch(() => '');
    return contents.split('\n').filter((line) => line.trim().length > 0).length;
}
