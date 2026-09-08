import type { AgentActivityPhase } from '@grotto/api';
import { Timeline } from '@heroui-pro/react';
import { formatAgentActivityEvent } from './agent-activity-model.ts';
import type { AgentActivityTurn } from './agent-activity-turns.ts';

export function AgentActivityTimeline({ turn }: { turn: AgentActivityTurn }) {
    if (turn.events.length === 0) {
        return <p className="text-muted text-sm">No granular activity events were retained.</p>;
    }
    return (
        <Timeline density="compact" size="sm">
            {turn.events.map((event) => (
                <Timeline.Item key={event.id} status={timelineStatus(event.phase)}>
                    <Timeline.Marker />
                    <Timeline.Content>
                        <span className="flex min-w-0 items-baseline justify-between gap-3">
                            <span className="text-foreground text-sm">
                                {formatAgentActivityEvent(event)}
                            </span>
                            <time
                                className="shrink-0 text-muted text-xs tabular-nums"
                                dateTime={event.occurredAt}
                            >
                                {formatTimelineTime(event.occurredAt)}
                            </time>
                        </span>
                    </Timeline.Content>
                </Timeline.Item>
            ))}
        </Timeline>
    );
}

function timelineStatus(phase: AgentActivityPhase): 'current' | 'success' | 'warning' {
    if (phase === 'failed' || phase === 'interrupted') {
        return 'warning';
    }
    return phase === 'completed' ? 'success' : 'current';
}

function formatTimelineTime(value: string) {
    return new Date(value).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}
