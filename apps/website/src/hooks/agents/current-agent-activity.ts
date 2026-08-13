import type { HostedAgent, HostedAgentActivityEvent } from '@tavern/api';

export type CurrentAgentActivity = HostedAgentActivityEvent;

const activityLabels: Record<HostedAgentActivityEvent['category'], string> = {
    browsing: 'Browsing…',
    checking_messages: 'Checking messages…',
    editing_files: 'Editing files…',
    reading_files: 'Reading files…',
    running_command: 'Running a command…',
    searching_web: 'Searching the web…',
    sending_message: 'Sending a message…',
    starting_work: 'Starting work…',
    thinking: 'Thinking…',
    using_tool: 'Using a tool…',
    working: 'Working…',
};

export function formatCurrentAgentActivityLabel(activity: CurrentAgentActivity) {
    return activityLabels[activity.category];
}

/**
 * Reconciles one committed activity event into the current-run snapshot.
 * Array position is the run's stable presentation order; category changes only
 * replace the existing row, while terminal events remove it.
 */
export function applyCurrentAgentActivityEvent(
    activities: readonly CurrentAgentActivity[],
    event: CurrentAgentActivity
): CurrentAgentActivity[] {
    const index = activities.findIndex((activity) => activityKey(activity) === activityKey(event));
    const current = index >= 0 ? activities[index] : undefined;

    if (current && event.position <= current.position) {
        return [...activities];
    }

    const projected = projectCurrentAgentActivityEvent(event);
    if (!projected) {
        return index < 0
            ? [...activities]
            : activities.filter((_, itemIndex) => itemIndex !== index);
    }

    if (index < 0) {
        return [
            ...activities.filter((activity) => activity.agentId !== projected.agentId),
            projected,
        ];
    }

    return activities.map((activity, itemIndex) => (itemIndex === index ? projected : activity));
}

/**
 * Current activity is an accepted-run projection, not the durable journal.
 * Semantic completion means the Agent is between operations; only the
 * Server-owned working completion is authoritative turn settlement.
 */
export function projectCurrentAgentActivityEvent(
    event: CurrentAgentActivity
): CurrentAgentActivity | null {
    if (isTerminalAgentActivityEvent(event)) {
        return null;
    }
    return event.phase === 'started' ? event : { ...event, category: 'working', phase: 'started' };
}

export function projectCurrentAgentActivitySnapshot(
    activities: readonly CurrentAgentActivity[]
): CurrentAgentActivity[] {
    return activities.flatMap((activity) => {
        const projected = projectCurrentAgentActivityEvent(activity);
        return projected ? [projected] : [];
    });
}

export function reconcileCurrentAgentActivity(
    snapshot: readonly CurrentAgentActivity[],
    liveEvents: readonly CurrentAgentActivity[]
) {
    return liveEvents.reduce(
        applyCurrentAgentActivityEvent,
        projectCurrentAgentActivitySnapshot(snapshot)
    );
}

export function splitCurrentAgentActivity(
    activities: readonly CurrentAgentActivity[],
    maximumRows = 4
) {
    const visible = activities.slice(0, maximumRows);
    return {
        hiddenCount: Math.max(0, activities.length - visible.length),
        visible,
    };
}

/** Semantic activity describes only Agents whose canonical availability is working. */
export function filterCurrentAgentActivityByAvailability(
    activities: readonly CurrentAgentActivity[],
    agents: readonly Pick<HostedAgent, 'availability' | 'id'>[]
) {
    const workingAgentIds = new Set(
        agents.filter((agent) => agent.availability === 'working').map((agent) => agent.id)
    );
    return activities.filter((activity) => workingAgentIds.has(activity.agentId));
}

function activityKey(activity: CurrentAgentActivity) {
    return `${activity.agentId}:${activity.runId}`;
}

function isTerminalAgentActivityEvent(activity: CurrentAgentActivity) {
    return (
        activity.producer === 'server' &&
        activity.category === 'working' &&
        activity.phase !== 'started'
    );
}
