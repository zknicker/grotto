import type { Agent } from '@grotto/api';
import { Accordion, Button, Chip } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import { CopyButton } from '../../../components/copy-button.tsx';
import { useAgentActivityHistory } from '../../../hooks/members/use-agent-activity-history.ts';
import { useAgentTurns } from '../../../hooks/members/use-agent-turns.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { useGrottoServerConnectionState } from '../../../lib/grotto-server.tsx';
import { PageColumn } from '../../shell/page-column.tsx';
import {
    formatAgentActivityDiagnosticInfo,
    getAgentActivityColor,
    getAgentActivityPhaseLabel,
} from './agent-activity-model.ts';
import { AgentActivityTimeline } from './agent-activity-timeline.tsx';
import {
    type AgentActivityTurn,
    formatActivityTurnCounts,
    formatActivityTurnHeadline,
    getActivityTurnPhase,
    groupAgentActivityTurns,
} from './agent-activity-turns.ts';
import { AgentChats } from './agent-chats.tsx';
import { AgentLoading } from './agent-loading.tsx';

export function AgentActivity({ agent, server }: { agent: Agent; server: ServerDetail }) {
    const activity = useAgentActivityHistory(server.id, agent.id);
    const settledTurns = useAgentTurns(server.id, agent.id);
    const connectionState = useGrottoServerConnectionState();
    const events = activity.events;
    const unavailable =
        events.length === 0 && activity.error !== null && settledTurns.error !== null;
    const diagnosticInfo = formatAgentActivityDiagnosticInfo(events);
    const turns = groupAgentActivityTurns(events, settledTurns.data ?? []);

    return (
        <PageColumn>
            <ItemCardGroup variant="transparent">
                <ItemCardGroup.Header className="flex items-center justify-between gap-3">
                    <ItemCardGroup.Title>Activity History</ItemCardGroup.Title>
                    {/* Icon-only, with the negative margin absorbing the
                        button's box so this header stays the same height as
                        the button-less headers on sibling tabs. */}
                    <CopyButton
                        className="-my-1.5"
                        disabled={events.length === 0}
                        label="Copy diagnostic info"
                        value={diagnosticInfo}
                    />
                </ItemCardGroup.Header>
                {activity.isPending && settledTurns.isPending ? (
                    <AgentLoading label="Loading activity history..." />
                ) : unavailable ? (
                    // Empty and error states sit in the group they replace, so
                    // the section keeps its shape instead of collapsing to a
                    // loose line of grey text.
                    <ItemCardGroup className="overflow-hidden">
                        <ItemCard>
                            <ItemCard.Content>
                                <ItemCard.Description>
                                    {connectionState === 'connecting' ||
                                    connectionState === 'reconnecting'
                                        ? 'Activity history is unavailable while offline. Reconnect to try again.'
                                        : 'Activity history is unavailable right now.'}
                                </ItemCard.Description>
                            </ItemCard.Content>
                        </ItemCard>
                    </ItemCardGroup>
                ) : turns.length === 0 ? (
                    <ItemCardGroup className="overflow-hidden">
                        <ItemCard>
                            <ItemCard.Content>
                                <ItemCard.Description>No activity yet.</ItemCard.Description>
                            </ItemCard.Content>
                        </ItemCard>
                    </ItemCardGroup>
                ) : (
                    <ActivityTurnHistory turns={turns} />
                )}
                {events.length > 0 && activity.hasMore ? (
                    <div className="flex justify-center border-separator border-t px-4 py-3">
                        <Button
                            isDisabled={activity.isFetching}
                            onPress={activity.loadMore}
                            size="sm"
                            variant="ghost"
                        >
                            {activity.isFetching
                                ? 'Loading older activity...'
                                : 'Load older activity'}
                        </Button>
                    </div>
                ) : null}
            </ItemCardGroup>
            <AgentChats agent={agent} server={server} />
        </PageColumn>
    );
}

function ActivityTurnHistory({ turns }: { turns: readonly AgentActivityTurn[] }) {
    return (
        <Accordion allowsMultipleExpanded variant="surface">
            {turns.map((turn) => {
                const phase = getActivityTurnPhase(turn);
                return (
                    <Accordion.Item id={turn.runId} key={turn.runId}>
                        <Accordion.Heading>
                            <Accordion.Trigger>
                                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-left">
                                    <time
                                        className="shrink-0 text-muted text-sm tabular-nums"
                                        dateTime={turn.startedAt}
                                    >
                                        {formatActivityTime(turn.startedAt)}
                                    </time>
                                    <Chip
                                        color={getAgentActivityColor(phase)}
                                        size="sm"
                                        variant="soft"
                                    >
                                        {getAgentActivityPhaseLabel(phase)}
                                    </Chip>
                                    <span className="font-medium text-foreground text-sm">
                                        {formatActivityTurnHeadline(turn)}
                                    </span>
                                    <span className="text-muted text-sm">
                                        {formatActivityTurnCounts(turn)}
                                    </span>
                                </span>
                                <Accordion.Indicator />
                            </Accordion.Trigger>
                        </Accordion.Heading>
                        <Accordion.Panel>
                            <Accordion.Body>
                                <AgentActivityTimeline turn={turn} />
                            </Accordion.Body>
                        </Accordion.Panel>
                    </Accordion.Item>
                );
            })}
        </Accordion>
    );
}

function formatActivityTime(value: string) {
    return new Date(value).toLocaleString([], {
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
    });
}
