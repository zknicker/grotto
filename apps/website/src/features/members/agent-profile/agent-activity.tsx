import { Button, Separator } from '@heroui/react';
import { Copy01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { StatusDot } from '../../../components/ui/status-dot.tsx';
import { useAgentActivityHistory } from '../../../hooks/members/use-agent-activity-history.ts';
import { writeClipboardText } from '../../../lib/clipboard.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { useGrottoServerConnectionState } from '../../../lib/grotto-server.tsx';
import {
    SettingsGroup,
    SettingsItem,
    SettingsPage,
    SettingsSection,
} from '../../settings/layout/settings-page.tsx';
import {
    formatAgentActivityDiagnosticInfo,
    formatAgentActivityEvent,
    getAgentActivityStatus,
} from './agent-activity-model.ts';
import { AgentChats } from './agent-chats.tsx';
import { AgentLoading } from './agent-loading.tsx';

export function AgentActivity({ agent, server }: { agent: HostedAgent; server: ServerDetail }) {
    const activity = useAgentActivityHistory(server.id, agent.id);
    const connectionState = useGrottoServerConnectionState();
    const events = activity.events;
    const unavailable = events.length === 0 && activity.error !== null;
    const diagnosticInfo = formatAgentActivityDiagnosticInfo(events);

    return (
        <div className="px-4 py-6">
            <SettingsPage>
                <SettingsSection
                    action={
                        <Button
                            isDisabled={events.length === 0}
                            onPress={() => {
                                void writeClipboardText(diagnosticInfo);
                            }}
                            size="sm"
                            variant="secondary"
                        >
                            <Icon aria-hidden="true" icon={Copy01Icon} />
                            Copy Diagnostic Info
                        </Button>
                    }
                    title="Activity History"
                >
                    {activity.isPending ? (
                        <AgentLoading label="Loading activity history..." />
                    ) : unavailable ? (
                        <p className="py-6 text-muted text-sm">
                            {connectionState === 'connecting' || connectionState === 'reconnecting'
                                ? 'Activity history is unavailable while offline. Reconnect to try again.'
                                : 'Activity history is unavailable right now.'}
                        </p>
                    ) : events.length === 0 ? (
                        <p className="py-6 text-muted text-sm">No activity yet.</p>
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
                </SettingsSection>
                <AgentChats agent={agent} server={server} />
            </SettingsPage>
        </div>
    );
}

function ActivityHistoryRows({
    events,
}: {
    events: ReturnType<typeof useAgentActivityHistory>['events'];
}) {
    return (
        <SettingsGroup>
            {events.map((event, index) => (
                <React.Fragment key={event.id}>
                    {index > 0 ? <Separator /> : null}
                    <SettingsItem>
                        <div className="grid grid-cols-[7.5rem_auto_minmax(0,1fr)] items-baseline gap-3">
                            <time
                                className="text-muted text-xs tabular-nums"
                                dateTime={event.occurredAt}
                            >
                                {formatActivityTime(event.occurredAt)}
                            </time>
                            <StatusDot status={getAgentActivityStatus(event.phase)} />
                            <span className="min-w-0 text-foreground text-sm">
                                {formatAgentActivityEvent(event)}
                            </span>
                        </div>
                    </SettingsItem>
                </React.Fragment>
            ))}
        </SettingsGroup>
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
