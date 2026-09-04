import type { Agent } from '@grotto/api';
import { EmptyState } from '@heroui-pro/react';
import { ComputerIcon, Folder01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { useComputers } from '../../../hooks/servers/use-computers.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { WorkspaceBrowserContent } from '../../chats/chat-artifact-workspace-content.tsx';
import { PageColumn } from '../../shell/page-column.tsx';
import { AgentOverview } from './agent-overview.tsx';
import { AgentReminders } from './agent-reminders.tsx';
import { AgentTriggers } from './agent-triggers.tsx';

export { AgentActivity } from './agent-activity.tsx';
export { AgentOverview };
export { AgentTools } from './agent-tools.tsx';

/**
 * Both of an Agent's standing automations on one tab: Reminders answer "at this
 * time", Triggers answer "when this outside thing happens". They share a tab
 * because the profile's Segment strip is a five-word budget — measured, a sixth
 * label overflows the strip inside the chat-side profile pane and pushes its
 * Close button past the pane edge. See `agent-profile.tsx`.
 *
 * Each section owns its own query, so a slow one never blanks the other.
 */
export function AgentAutomations({ agent, server }: { agent: Agent; server: ServerDetail }) {
    return (
        <PageColumn>
            <AgentReminders agent={agent} server={server} />
            <AgentTriggers agent={agent} server={server} />
        </PageColumn>
    );
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
