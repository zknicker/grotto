import { Chip } from '@heroui/react';
import { useTurnJournal } from '../../hooks/members/use-turn-journal.ts';
import {
    getAgentActivityColor,
    getAgentActivityPhaseLabel,
    type TurnDetailAccess,
    type TurnJournalPresentation,
} from '../members/agent-profile/agent-activity-model.ts';
import {
    type AgentActivityTurn,
    formatActivityTurnCounts,
    formatActivityTurnHeadline,
    getActivityTurnPhase,
} from '../members/agent-profile/agent-activity-turns.ts';
import { TurnTraceNote } from './turn-trace-blocks.tsx';
import { TurnTraceEvent } from './turn-trace-event.tsx';
import { buildTurnTrace } from './turn-trace-model.ts';
import { TurnTraceReasoning } from './turn-trace-reasoning.tsx';
import { TurnTraceToolCall } from './turn-trace-tool.tsx';

/** The turn's outcome at a glance, for surfaces that do not already say it. */
export function TurnTraceHeader({ turn }: { turn: AgentActivityTurn }) {
    const phase = getActivityTurnPhase(turn);

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Chip color={getAgentActivityColor(phase)} size="sm" variant="soft">
                {getAgentActivityPhaseLabel(phase)}
            </Chip>
            <span className="font-medium text-foreground text-sm">
                {formatActivityTurnHeadline(turn)}
            </span>
            <span className="text-muted text-sm">{formatActivityTurnCounts(turn)}</span>
        </div>
    );
}

/**
 * What the Agent actually did, in order: the Server's semantic verbs merged
 * with the Computer's reasoning and tool calls. The journal is requested only
 * while this is mounted and open, and only for viewers Server allows.
 */
export function TurnTrace({
    access,
    agentId,
    enabled,
    runId,
    serverId,
    turn,
}: {
    access: TurnDetailAccess;
    agentId: string | null;
    enabled: boolean;
    runId: string | null;
    serverId: string;
    turn: AgentActivityTurn | null;
}) {
    const journal = useTurnJournal({
        access,
        agentId,
        enabled,
        live: turn?.kind === 'active',
        runId,
        serverId,
    });
    const presentation = journal.presentation;

    if (!runId) {
        return <TurnTraceNote>This message has no available turn identity.</TurnTraceNote>;
    }

    return (
        <TurnTracePresentation
            access={access}
            isPending={journal.isPending}
            presentation={presentation}
            turn={turn}
        />
    );
}

/** The rendered trace, split from the relay so its shape can be proved directly. */
export function TurnTracePresentation({
    access,
    isPending,
    presentation,
    turn,
}: {
    access: TurnDetailAccess;
    isPending: boolean;
    presentation: TurnJournalPresentation | null;
    turn: AgentActivityTurn | null;
}) {
    const entries = buildTurnTrace({
        journal: presentation?.kind === 'available' ? presentation.journal : null,
        turn,
    });

    return (
        <div className="grid min-w-0 gap-2">
            <TurnTraceNotice access={access} isPending={isPending} presentation={presentation} />
            {entries.length === 0 ? (
                <TurnTraceNote>No activity was recorded for this turn.</TurnTraceNote>
            ) : (
                <div className="grid min-w-0 gap-1">
                    {entries.map((entry) =>
                        entry.kind === 'event' ? (
                            <TurnTraceEvent event={entry.event} key={entry.key} />
                        ) : entry.kind === 'reasoning' ? (
                            <TurnTraceReasoning
                                isStreaming={entry.isStreaming}
                                key={entry.key}
                                reasoning={entry.reasoning}
                            />
                        ) : (
                            <TurnTraceToolCall key={entry.key} tool={entry.tool} />
                        )
                    )}
                </div>
            )}
        </div>
    );
}

function TurnTraceNotice({
    access,
    isPending,
    presentation,
}: {
    access: TurnDetailAccess;
    isPending: boolean;
    presentation: TurnJournalPresentation | null;
}) {
    if (access === 'summary') {
        return <TurnTraceNote>Execution details are available to owners and admins.</TurnTraceNote>;
    }
    if (isPending && !presentation) {
        return <TurnTraceNote>Loading detailed activity...</TurnTraceNote>;
    }
    if (!presentation || presentation.kind === 'available') {
        return null;
    }
    return <TurnTraceNote>{`${presentation.title} — ${presentation.description}`}</TurnTraceNote>;
}
