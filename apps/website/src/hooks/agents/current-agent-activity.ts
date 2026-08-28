import type { Agent, AgentActivityEvent, AgentLifecycleEvent } from '@grotto/api';
import {
    isAgentCurrentActivityTerminalEvent,
    isAgentFinishingActivityEvent,
    projectAgentCurrentActivity,
} from '@grotto/api/agent-activity';

export type CurrentAgentActivity = AgentActivityEvent;

const activityLabels: Record<AgentActivityEvent['category'], string> = {
    browsing: 'Browsing…',
    checking_messages: 'Checking messages…',
    editing_files: 'Editing files…',
    reading_files: 'Reading files…',
    running_command: 'Running a command…',
    searching_web: 'Searching the web…',
    sending_message: 'Sending a message…',
    starting_work: 'Starting work…',
    thinking: 'Thinking…',
    updating_instructions: 'Updating instructions…',
    using_tool: 'Using a tool…',
    working: 'Working…',
};

export function formatCurrentAgentActivityLabel(activity: CurrentAgentActivity) {
    if (isAgentFinishingActivityEvent(activity)) {
        return 'Finishing up…';
    }
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
    // Lifecycle settlement owns row removal alongside Agent availability. Keep
    // the last semantic state until that event turns the Agent non-working.
    if (current && isAgentCurrentActivityTerminalEvent(event)) {
        return [...activities];
    }

    const projected = projectAgentCurrentActivity(current ?? null, event);
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
export function projectCurrentAgentActivitySnapshot(
    activities: readonly CurrentAgentActivity[]
): CurrentAgentActivity[] {
    return activities.filter(
        (activity) => activity.phase === 'started' || isAgentFinishingActivityEvent(activity)
    );
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

/** Compacts the live overlay to one event per Agent without losing event ordering. */
export interface CurrentAgentActivityLiveOverlay {
    event: CurrentAgentActivity;
    latestPosition: number;
}

export function mergeCurrentAgentActivityLiveEvent(
    previous: CurrentAgentActivityLiveOverlay | undefined,
    event: CurrentAgentActivity
): CurrentAgentActivityLiveOverlay {
    if (previous?.event.runId === event.runId && previous.latestPosition >= event.position) {
        return previous;
    }
    if (previous?.event.runId === event.runId && isAgentCurrentActivityTerminalEvent(event)) {
        return { ...previous, latestPosition: event.position };
    }
    if (
        previous?.event.runId === event.runId &&
        isAgentFinishingActivityEvent(previous.event) &&
        event.phase !== 'started'
    ) {
        return { ...previous, latestPosition: event.position };
    }
    if (previous?.event.runId === event.runId && previous.event.phase === 'started') {
        const projected = projectAgentCurrentActivity(previous.event, event);
        return { event: projected ?? event, latestPosition: event.position };
    }
    return { event, latestPosition: event.position };
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
    agents: readonly Pick<Agent, 'availability' | 'id'>[]
) {
    const workingAgentIds = new Set(
        agents.filter((agent) => agent.availability === 'working').map((agent) => agent.id)
    );
    return activities.filter((activity) => workingAgentIds.has(activity.agentId));
}

/** Never carry one run's semantic presentation into a newer active lifecycle. */
export function filterCurrentAgentActivityByLifecycle(
    activities: readonly CurrentAgentActivity[],
    lifecycles: ReadonlyMap<string, AgentLifecycleEvent>
) {
    return activities.filter((activity) => {
        const lifecycle = lifecycles.get(activity.agentId);
        return !lifecycle || lifecycle.phase === 'settled' || lifecycle.runId === activity.runId;
    });
}

function activityKey(activity: CurrentAgentActivity) {
    return `${activity.agentId}:${activity.runId}`;
}
