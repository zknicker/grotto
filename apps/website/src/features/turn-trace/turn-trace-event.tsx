import type { AgentActivityEvent, AgentActivityPhase } from '@grotto/api';
import { formatShortTime } from '../../lib/format.ts';
import { cn } from '../../lib/utils.ts';
import { formatAgentActivityEvent } from '../members/agent-profile/agent-activity-model.ts';

const phaseDots: Record<AgentActivityPhase, string> = {
    completed: 'bg-muted',
    failed: 'bg-danger',
    interrupted: 'bg-warning',
    started: 'bg-accent',
};

/**
 * A Server verb in the trace column. It shares the tool trigger's height and
 * left edge so a turn reads as one sequence rather than two stacked lists.
 */
export function TurnTraceEvent({ event }: { event: AgentActivityEvent }) {
    return (
        <div className="flex min-w-0 items-center gap-2 px-3 py-1.5 text-sm">
            <span
                aria-hidden
                className={cn('size-1.5 shrink-0 rounded-full', phaseDots[event.phase])}
            />
            <span className="min-w-0 flex-1 truncate text-foreground">
                {formatAgentActivityEvent(event)}
            </span>
            <time
                className="shrink-0 font-mono text-muted text-xs tabular-nums"
                dateTime={event.occurredAt}
            >
                {formatShortTime(event.occurredAt)}
            </time>
        </div>
    );
}
