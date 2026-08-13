// Turn settlement. Scenarios never poll message content waiting for an Agent to
// "probably" be done: they wait for the Server-side turn record to settle, then
// assert against the collaboration that turn produced.
//
// `agent.turns` is the primary contract. Until it lands everywhere, the older
// `agent.activity` projection is feature-detected as the fallback, and
// `agent.deliveryState` is the start gate either way.

import { sleep } from '../eval-harness.mjs';

const startPollMs = 1000;
const settlePollMs = 2000;
const turnWindow = 20;

export function createTurnObserver({ serverId, trpc }) {
    const capabilities = { deliveries: null, turns: null };

    async function listTurns(agentId, limit = turnWindow) {
        if (capabilities.turns !== false) {
            try {
                const rows = await trpc('agent.turns', { agentId, limit, serverId });
                capabilities.turns = true;
                return rows.map((row) => normalizeTurn(agentId, row));
            } catch (error) {
                if (!isMissingProcedure(error)) {
                    throw error;
                }
                capabilities.turns = false;
            }
        }
        const entries = await trpc('agent.activity', { agentId, limit, serverId });
        return entries.map((entry) => normalizeActivity(agentId, entry));
    }

    /** Delivery rows, or null when this Server does not expose them yet. */
    async function listDeliveries(agentId, limit = 50) {
        if (capabilities.deliveries === false) {
            return null;
        }
        try {
            const rows = await trpc('agent.deliveries', { agentId, limit, serverId });
            capabilities.deliveries = true;
            return rows;
        } catch (error) {
            if (!isMissingProcedure(error)) {
                throw error;
            }
            capabilities.deliveries = false;
            return null;
        }
    }

    function deliveryState(agentId) {
        return trpc('agent.deliveryState', { agentId, serverId });
    }

    /**
     * Waits for one new settled turn: the Agent must start within `startWithin`
     * and the Server must record a new settled turn — with delivery quiet —
     * within `settleWithin`.
     */
    async function settleTurn(
        agentId,
        { onPhase, settleWithin = 240_000, startWithin = 15_000 } = {}
    ) {
        const known = new Set((await listTurns(agentId)).map((turn) => turn.runId));
        const startDeadline = Date.now() + startWithin;
        let lastState = null;
        let started = false;

        while (Date.now() < startDeadline) {
            const [state, rows] = await Promise.all([deliveryState(agentId), listTurns(agentId)]);
            lastState = state;
            if (rows.some((turn) => !known.has(turn.runId)) || state.running) {
                started = true;
                break;
            }
            if (state.stopped) {
                throw new Error(`no turn started: Agent ${agentId} is stopped.`);
            }
            await sleep(startPollMs);
        }
        if (!started) {
            throw new Error(
                `no turn started: Agent ${agentId} began no turn within ${asSeconds(startWithin)}s (${describeState(lastState)}).`
            );
        }
        onPhase?.('turn active');

        const settleDeadline = Date.now() + settleWithin;
        let newest = null;
        const runIds = [];
        while (Date.now() < settleDeadline) {
            const [state, rows] = await Promise.all([deliveryState(agentId), listTurns(agentId)]);
            lastState = state;
            const fresh = rows.filter((turn) => !known.has(turn.runId));
            for (const turn of fresh) {
                if (!runIds.includes(turn.runId)) {
                    runIds.push(turn.runId);
                }
            }
            newest = fresh[0] ?? newest;
            if (newest && !state.running && state.pending === 0) {
                return { ...newest, runIds };
            }
            await sleep(settlePollMs);
        }
        throw new Error(
            `turn did not settle: Agent ${agentId} was still working after ${asSeconds(settleWithin)}s (${describeState(lastState)}, new turns ${runIds.length}).`
        );
    }

    return {
        capabilities: () => ({ ...capabilities }),
        deliveryState,
        listDeliveries,
        listTurns,
        settleTurn,
    };
}

function normalizeTurn(agentId, row) {
    return {
        agentId: row.agentId ?? agentId,
        endedAt: row.endedAt,
        failureKind: row.failureKind ?? null,
        messageCount: row.messageCount ?? 0,
        outputProduced: row.outputProduced ?? (row.messageCount ?? 0) > 0,
        runId: row.runId,
        source: 'turns',
        startedAt: row.startedAt,
        status: row.status,
        summary: row.summary ?? '',
    };
}

/**
 * `agent.activity` carries no failure kind and no output flag, so output is
 * inferred from the turn's durable message count.
 */
function normalizeActivity(agentId, entry) {
    return {
        agentId,
        endedAt: entry.endedAt,
        failureKind: null,
        messageCount: entry.messageCount ?? 0,
        outputProduced: (entry.messageCount ?? 0) > 0,
        runId: entry.runId,
        source: 'activity',
        startedAt: entry.startedAt,
        status: entry.status,
        summary: entry.summary ?? '',
    };
}

/**
 * Only a genuinely unrouted tRPC path counts as a missing capability. An
 * authorization or unknown-Agent refusal is a `NOT_FOUND` 404 too, so matching
 * the code or the status would silently downgrade a real denial into a skipped
 * assertion for the rest of the process. tRPC words an unrouted path as
 * `No "query"-procedure on path "agent.turns"`, JSON-escaped inside the
 * response body the harness quotes back.
 */
export function isMissingProcedure(error) {
    return /no\s+\\?"(?:query|mutation|subscription)\\?"-procedure on path/iu.test(String(error));
}

function describeState(state) {
    if (!state) {
        return 'delivery state unknown';
    }
    return `pending=${state.pending}, running=${state.running}, stopped=${state.stopped}`;
}

function asSeconds(ms) {
    return Math.round(ms / 1000);
}
