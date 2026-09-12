import type { Agent, AgentLifecycleEvent } from '@haus/api';
import {
    type CurrentAgentActivity,
    filterCurrentAgentActivityByLifecycle,
    formatCurrentAgentActivityLabel,
} from '../../../hooks/agents/current-agent-activity.ts';
import { elapsedSince } from '../../cloud-agents/cloud-agent-presentation.ts';

/** One Agent in a turn, as both the roster band and Happening now read it. */
export interface HappeningNowAgent {
    agent: Agent | null;
    id: string;
    /** The current step and how long it has been running: `Editing files · 3m`. */
    label: string;
    name: string;
}

/**
 * The Agent's current step by id, for a surface that already has its own row
 * for that Agent. Lifecycle filtering happens here so no caller can forget it:
 * a settled run's last step must never be painted onto a newer one.
 */
export function currentAgentActivityLabels(
    activities: readonly CurrentAgentActivity[],
    lifecycles: ReadonlyMap<string, AgentLifecycleEvent>
): ReadonlyMap<string, string> {
    return new Map(
        filterCurrentAgentActivityByLifecycle(activities, lifecycles).map((activity) => [
            activity.agentId,
            formatCurrentAgentActivityLabel(activity),
        ])
    );
}

/**
 * Agents in a turn as rows. The snapshot carries one event per Agent — the
 * step it is on — so elapsed is time in that step, which is the number that
 * answers "is this moving?". The run's own start is not in this projection.
 */
export function happeningNowAgentRows(
    activities: readonly CurrentAgentActivity[],
    lifecycles: ReadonlyMap<string, AgentLifecycleEvent>,
    agents: readonly Agent[],
    now: number
): HappeningNowAgent[] {
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));

    return filterCurrentAgentActivityByLifecycle(activities, lifecycles).map((activity) => {
        const agent = agentById.get(activity.agentId) ?? null;
        return {
            agent,
            id: activity.agentId,
            label: stepWithElapsed(
                formatCurrentAgentActivityLabel(activity),
                activity.occurredAt,
                now
            ),
            name: agent?.displayName ?? `Agent ${activity.agentId.slice(-6)}`,
        };
    });
}

/**
 * The step label carries a trailing ellipsis to say "still going". Once an
 * elapsed clause follows it, the clause says that instead, so the ellipsis
 * comes off rather than reading as `Editing files… · 3m`.
 */
function stepWithElapsed(label: string, occurredAt: string, now: number): string {
    const elapsed = elapsedSince(occurredAt, now);
    return elapsed === null ? label : `${label.replace(/…$/u, '')} · ${elapsed}`;
}
