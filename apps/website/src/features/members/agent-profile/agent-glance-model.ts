import type { Reminder, Trigger } from '@grotto/api';

export interface AgentAutomationCounts {
    armedTriggers: number;
    scheduledReminders: number;
    total: number;
}

/**
 * What is still standing, not what has already run: a scheduled reminder is a
 * wake that is still coming, and an armed trigger is a door still open. Settled
 * reminders and disabled triggers are history, and the Automations tab's own
 * history drawers own them.
 */
export function countAgentAutomations(
    reminders: readonly Pick<Reminder, 'status'>[],
    triggers: readonly Pick<Trigger, 'status'>[]
): AgentAutomationCounts {
    const scheduledReminders = reminders.filter(
        (reminder) => reminder.status === 'scheduled'
    ).length;
    const armedTriggers = triggers.filter((trigger) => trigger.status === 'armed').length;
    return {
        armedTriggers,
        scheduledReminders,
        total: armedTriggers + scheduledReminders,
    };
}

/** The one muted line under the count, naming which half is which. */
export function formatAgentAutomations(counts: AgentAutomationCounts): string {
    return `${counts.scheduledReminders} scheduled · ${counts.armedTriggers} armed`;
}

/**
 * Connections this Agent can actually use right now: granted, connected, and
 * carrying at least one tool. The one definition of "this Agent's connections"
 * — the Overview tile counts this set and the peek names it, so the two can
 * never disagree. The Setup tab lists a different set on purpose: every
 * connection that is toggleable, granted or not.
 */
export function grantedAgentConnections<
    Connection extends {
        connected: boolean;
        grants: readonly { agentId: string }[];
        tools: readonly unknown[];
    },
>(connections: readonly Connection[], agentId: string): Connection[] {
    return connections.filter(
        (connection) =>
            connection.connected &&
            connection.tools.length > 0 &&
            connection.grants.some((grant) => grant.agentId === agentId)
    );
}

/** Skills are Agent-owned copies, reported by the Agent's Computer. */
export function countAgentSkills(
    agentSkills: readonly { agentId: string; skills: readonly unknown[] }[] | undefined,
    agentId: string
): number {
    return agentSkills?.find((entry) => entry.agentId === agentId)?.skills.length ?? 0;
}
