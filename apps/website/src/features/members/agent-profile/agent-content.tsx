import type { Agent } from '@grotto/api';
import { Separator } from '@heroui/react';
import { EmptyState, ItemCard, ItemCardGroup } from '@heroui-pro/react';
import { ComputerIcon, Folder01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAgentReminders } from '../../../hooks/members/use-agent-reminders.ts';
import { useComputers } from '../../../hooks/servers/use-computers.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { WorkspaceBrowserContent } from '../../chats/chat-artifact-workspace-content.tsx';
import { PageColumn } from '../../shell/page-column.tsx';
import { AgentLoading } from './agent-loading.tsx';
import { AgentOverview } from './agent-overview.tsx';

export { AgentActivity } from './agent-activity.tsx';
export { AgentOverview };
export { AgentTools } from './agent-tools.tsx';

export function AgentReminders({ agent, server }: { agent: Agent; server: ServerDetail }) {
    const canView = server.role !== 'member';
    const reminders = useAgentReminders(server.id, agent.id, canView);
    const rows = reminders.data ?? [];
    if (canView && reminders.isPending) {
        return (
            <PageColumn>
                <AgentLoading label="Loading reminders" />
            </PageColumn>
        );
    }

    // The section keeps its header even when empty, so every profile tab
    // shares one anatomy instead of this one collapsing to a floating
    // full-page empty state.
    return (
        <PageColumn>
            <ItemCardGroup variant="transparent">
                <ItemCardGroup.Header>
                    <ItemCardGroup.Title>
                        Reminders
                        <span className="ms-2 text-muted tabular-nums">{rows.length}</span>
                    </ItemCardGroup.Title>
                </ItemCardGroup.Header>
                <ItemCardGroup className="overflow-hidden">
                    {rows.length === 0 ? (
                        <ItemCard>
                            <ItemCard.Content>
                                <ItemCard.Description>
                                    No reminders yet. Just tell {agent.displayName} what to remember
                                    and when.
                                </ItemCard.Description>
                            </ItemCard.Content>
                        </ItemCard>
                    ) : (
                        rows.map((reminder, index) => (
                            <React.Fragment key={reminder.id}>
                                {index > 0 ? <Separator /> : null}
                                <ItemCard>
                                    <ItemCard.Content>
                                        <ItemCard.Title>{reminder.title}</ItemCard.Title>
                                        <ItemCard.Description className="tabular-nums">
                                            {formatReminderFireAt(reminder.fireAt)}
                                            {reminder.repeat ? ` · ${reminder.repeat}` : ''}
                                        </ItemCard.Description>
                                    </ItemCard.Content>
                                </ItemCard>
                            </React.Fragment>
                        ))
                    )}
                </ItemCardGroup>
            </ItemCardGroup>
        </PageColumn>
    );
}

function formatReminderFireAt(value: Date | string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export type WorkspaceAvailability = 'available' | 'computer-offline' | 'loading' | 'restricted';

/**
 * Workspace data always comes from the Agent's Computer, so the browser can
 * only resolve once we know that Computer is actually reachable. Without
 * this gate, an offline Computer leaves the workspace query pending forever
 * and the tab is stuck showing "Loading workspace files…".
 */
export function resolveWorkspaceAvailability({
    computerId,
    computers,
    role,
}: {
    computerId: string;
    computers:
        | Array<{
              health: 'degraded' | 'healthy' | 'offline' | 'update-required';
              id: string;
          }>
        | undefined;
    role: ServerDetail['role'];
}): WorkspaceAvailability {
    if (role === 'member') {
        return 'restricted';
    }
    if (!computers) {
        return 'loading';
    }
    const computer = computers.find((candidate) => candidate.id === computerId);
    return computer?.health === 'healthy' ? 'available' : 'computer-offline';
}

export function AgentWorkspace({ agent, server }: { agent: Agent; server: ServerDetail }) {
    const canView = server.role !== 'member';
    const computers = useComputers(server.id, { enabled: canView });
    const availability = resolveWorkspaceAvailability({
        computerId: agent.computerId,
        computers: computers.data,
        role: server.role,
    });

    if (availability === 'restricted') {
        return (
            <TabEmptyState
                description="Only workspace owners and admins can inspect raw Agent workspace files."
                icon={Folder01Icon}
                title="Workspace Unavailable"
            />
        );
    }

    if (availability === 'computer-offline') {
        return (
            <TabEmptyState
                description={`Workspace files will be browsable again once ${agent.displayName}'s Computer reconnects.`}
                icon={ComputerIcon}
                title="Computer Offline"
            />
        );
    }

    return (
        // Full-bleed: the file rail sits at the primary sidebar's width while
        // sharing the workspace content ground rather than forming another
        // block of app-sidebar chrome.
        <WorkspaceBrowserContent
            agentId={agent.id}
            railVariant="sidebar"
            serverId={server.id}
            treeSide="end"
        />
    );
}

function TabEmptyState({
    description,
    icon,
    title,
}: {
    description: string;
    icon: Parameters<typeof Icon>[0]['icon'];
    title: string;
}) {
    return (
        <EmptyState>
            <EmptyState.Header>
                <EmptyState.Media variant="icon">
                    <Icon icon={icon} />
                </EmptyState.Media>
                <EmptyState.Title>{title}</EmptyState.Title>
                <EmptyState.Description>{description}</EmptyState.Description>
            </EmptyState.Header>
        </EmptyState>
    );
}
