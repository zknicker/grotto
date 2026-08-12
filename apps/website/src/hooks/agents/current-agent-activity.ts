import type { HostedAgentActivityEvent } from '@tavern/api';

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

    if (event.phase !== 'started') {
        return index < 0
            ? [...activities]
            : activities.filter((_, itemIndex) => itemIndex !== index);
    }

    if (index < 0) {
        return [...activities, event];
    }

    return activities.map((activity, itemIndex) => (itemIndex === index ? event : activity));
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

function activityKey(activity: CurrentAgentActivity) {
    return `${activity.agentId}:${activity.runId}`;
}
