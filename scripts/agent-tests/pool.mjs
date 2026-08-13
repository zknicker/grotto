// The standing agent-test pool. Pool Agents are created once with stable
// handles and reused across runs; isolation comes from wiping an Agent on lease
// (session reset plus leftover chat cleanup), not from creating and deleting an
// Agent per scenario, which used to dominate the wall clock of the old lane.

import { sleep } from '../eval-harness.mjs';

export const poolProfiles = Object.freeze([
    { displayName: 'Eval Worker 1', handle: 'eval-worker-1', kind: 'worker' },
    { displayName: 'Eval Worker 2', handle: 'eval-worker-2', kind: 'worker' },
    { displayName: 'Eval Worker 3', handle: 'eval-worker-3', kind: 'worker' },
    { displayName: 'Eval Coordinator', handle: 'eval-coordinator', kind: 'coordinator' },
]);

export const poolAgentDescription =
    'Standing Grotto agent-test Agent. Act only when explicitly addressed, mentioned, or assigned a task. Keep replies short and do exactly what the message asks.';

/** Scenario lanes each hold one worker Agent, so the pool caps concurrency. */
export const poolLaneCapacity = poolProfiles.filter((profile) => profile.kind === 'worker').length;

/** A lane past the pool only queues behind a lease, so requests are clamped. */
export function clampLanes(requested) {
    const lanes = Math.trunc(Number(requested));
    return Number.isFinite(lanes) && lanes >= 1
        ? Math.min(lanes, poolLaneCapacity)
        : poolLaneCapacity;
}

const readyTimeoutMs = 120_000;
/** A queued lane waits behind a whole settle window, so the lease outlasts one. */
const leaseTimeoutMs = 360_000;

export function createAgentPool({ modelHint = 'terra', serverId, trpc }) {
    const leased = new Set();
    let acquiring = Promise.resolve();

    async function listAgents() {
        return await trpc('agent.list', { serverId });
    }

    /** Creates any missing pool Agent from an applied template, then waits for readiness. */
    async function ensure(profiles = poolProfiles) {
        let agents = await listAgents();
        const missing = profiles.filter(
            (profile) => !agents.some((agent) => agent.handle === profile.handle)
        );
        if (missing.length > 0) {
            const template = await waitForTemplate(agents);
            for (const profile of missing) {
                await trpc('agent.create', {
                    computerId: template.computerId,
                    description: poolAgentDescription,
                    displayName: profile.displayName,
                    handle: profile.handle,
                    modelId: template.desiredModelId,
                    role: 'member',
                    runtimeId: template.desiredRuntimeId,
                    serverId,
                });
            }
            agents = await listAgents();
        }

        const ready = [];
        for (const profile of profiles) {
            const agent = agents.find((candidate) => candidate.handle === profile.handle);
            if (!agent) {
                throw new Error(`The agent-test pool could not create @${profile.handle}.`);
            }
            ready.push({ ...(await waitForReady(agent.id)), kind: profile.kind });
        }
        return ready;
    }

    async function waitForTemplate(seed) {
        let agents = seed;
        const deadline = Date.now() + 60_000;
        for (;;) {
            const template = findPoolTemplate(agents, modelHint);
            if (template) {
                return template;
            }
            if (Date.now() >= deadline) {
                throw new Error(
                    `The agent-test pool needs one applied online ${modelHint} Agent to copy its Computer, runtime, and model.`
                );
            }
            await sleep(1000);
            agents = await listAgents();
        }
    }

    function waitForReady(agentId) {
        return pollUntil(async () => {
            const agents = await listAgents();
            const agent = agents.find((candidate) => candidate.id === agentId);
            return isReady(agent) ? agent : null;
        }, `Agent ${agentId} never became ready`);
    }

    /**
     * Checks out one pool Agent per request. Acquisition is serialized so two
     * lanes cannot claim the same Agent; `wipe` runs before the Agent is handed
     * to the scenario.
     */
    async function lease(requests, { wipe } = {}) {
        const attempt = acquiring.then(() => acquireAll(requests));
        acquiring = attempt.catch(() => undefined);
        const agents = await attempt;
        try {
            const prepared = [];
            for (const [index, agent] of agents.entries()) {
                await wipe?.(agent, requests[index]);
                prepared.push(agent);
            }
            return { agents: prepared, release: () => release(prepared) };
        } catch (error) {
            release(agents);
            throw error;
        }
    }

    async function acquireAll(requests) {
        const deadline = Date.now() + leaseTimeoutMs;
        for (;;) {
            const agents = await listAgents();
            const claimed = [];
            for (const request of requests) {
                const match = agents.find(
                    (agent) =>
                        matchesKind(agent.handle, request.kind) &&
                        !leased.has(agent.handle) &&
                        !claimed.some((entry) => entry.handle === agent.handle) &&
                        isReady(agent)
                );
                if (!match) {
                    break;
                }
                claimed.push({ ...match, kind: request.kind });
            }
            if (claimed.length === requests.length) {
                for (const agent of claimed) {
                    leased.add(agent.handle);
                }
                return claimed;
            }
            if (Date.now() >= deadline) {
                throw new Error(
                    `The agent-test pool had no free ${requests.map((request) => request.kind).join(', ')} Agent within ${Math.round(leaseTimeoutMs / 1000)}s.`
                );
            }
            await sleep(1000);
        }
    }

    function release(agents) {
        for (const agent of agents) {
            leased.delete(agent.handle);
        }
    }

    return { ensure, lease, listAgents, release, waitForReady };
}

export function matchesKind(handle, kind) {
    const profile = poolProfiles.find((entry) => entry.handle === handle);
    return profile?.kind === kind;
}

export function isReady(agent) {
    return Boolean(
        agent &&
            agent.status === 'applied' &&
            agent.availability === 'idle' &&
            agent.effectiveRuntimeId === agent.desiredRuntimeId &&
            agent.effectiveModelId === agent.desiredModelId &&
            agent.missingResources.length === 0
    );
}

export function findPoolTemplate(agents, modelHint = 'terra') {
    return agents.find(
        (agent) =>
            agent.status === 'applied' &&
            agent.availability !== 'offline' &&
            agent.availability !== 'stopped' &&
            agent.desiredModelId.toLowerCase().includes(modelHint.toLowerCase())
    );
}

async function pollUntil(read, message, timeoutMs = readyTimeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let latest = null;
    while (Date.now() < deadline) {
        latest = await read();
        if (latest) {
            return latest;
        }
        await sleep(1000);
    }
    throw new Error(`${message} within ${Math.round(timeoutMs / 1000)}s.`);
}
