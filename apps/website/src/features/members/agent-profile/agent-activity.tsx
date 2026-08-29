import type { Agent } from '@grotto/api';
import { Button, Chip, Separator } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import * as React from 'react';
import { CopyButton } from '../../../components/copy-button.tsx';
import { useAgentActivityHistory } from '../../../hooks/members/use-agent-activity-history.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { useGrottoServerConnectionState } from '../../../lib/grotto-server.tsx';
import { PageColumn } from '../../shell/page-column.tsx';
import {
    formatAgentActivityDiagnosticInfo,
    formatAgentActivityEvent,
    getAgentActivityColor,
    getAgentActivityPhaseLabel,
} from './agent-activity-model.ts';
import { AgentChats } from './agent-chats.tsx';
import { AgentLoading } from './agent-loading.tsx';

export function AgentActivity({ agent, server }: { agent: Agent; server: ServerDetail }) {
    const activity = useAgentActivityHistory(server.id, agent.id);
    const connectionState = useGrottoServerConnectionState();
    const events = activity.events;
    const unavailable = events.length === 0 && activity.error !== null;
    const diagnosticInfo = formatAgentActivityDiagnosticInfo(events);

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
                {activity.isPending ? (
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
                ) : events.length === 0 ? (
                    <ItemCardGroup className="overflow-hidden">
                        <ItemCard>
                            <ItemCard.Content>
                                <ItemCard.Description>No activity yet.</ItemCard.Description>
                            </ItemCard.Content>
                        </ItemCard>
                    </ItemCardGroup>
                ) : (
                    <ActivityHistoryRows events={events} />
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

function ActivityHistoryRows({
    events,
}: {
    events: ReturnType<typeof useAgentActivityHistory>['events'];
}) {
    return (
        <ItemCardGroup className="overflow-hidden">
            {events.map((event, index) => (
                <React.Fragment key={event.id}>
                    {index > 0 ? <Separator /> : null}
                    <ItemCard>
                        <ItemCard.Content>
                            {/* Time, phase, then what happened — one line, so
                                the column of timestamps stays scannable. */}
                            <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                                <time
                                    className="shrink-0 text-muted text-sm tabular-nums"
                                    dateTime={event.occurredAt}
                                >
                                    {formatActivityTime(event.occurredAt)}
                                </time>
                                <Chip
                                    color={getAgentActivityColor(event.phase)}
                                    size="sm"
                                    variant="soft"
                                >
                                    {getAgentActivityPhaseLabel(event.phase)}
                                </Chip>
                                <span className="min-w-0 text-foreground text-sm">
                                    {formatAgentActivityEvent(event)}
                                </span>
                            </span>
                        </ItemCard.Content>
                    </ItemCard>
                </React.Fragment>
            ))}
        </ItemCardGroup>
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
