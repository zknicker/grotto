import { Separator } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { Folder01Icon, Link04Icon, Notification03Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { CopyButton } from '../../../components/copy-button.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { HostedAgentTools } from '../../../routes/app/hosted-agent-tools.tsx';
import { WorkspaceBrowserContent } from '../../chats/chat-artifact-workspace-content.tsx';
import {
    SettingsGroup,
    SettingsItem,
    SettingsPage,
    SettingsSection,
} from '../../settings/layout/settings-page.tsx';
import { HostedAgentProfileTab } from './hosted-agent-profile-tab.tsx';

export { HostedAgentActivityTab } from './hosted-agent-activity-tab.tsx';
export { HostedAgentChatTab } from './hosted-agent-chat-tab.tsx';
export { HostedAgentProfileTab };

export function HostedAgentRemindersTab({
    agent,
    server,
}: {
    agent: HostedAgent;
    server: ServerDetail;
}) {
    const reminders = grottoTrpc.reminder.list.useQuery(
        { agentId: agent.id, serverId: server.id },
        { enabled: server.role !== 'member' }
    );
    const rows = reminders.data ?? [];
    if (server.role === 'member' || rows.length === 0) {
        return (
            <TabEmptyState
                description={`Just tell ${agent.displayName} what to remember and when.`}
                icon={Notification03Icon}
                title="No Reminders Yet"
            />
        );
    }

    return (
        <div className="px-5 py-6 sm:px-7">
            <SettingsPage>
                <SettingsSection title="Reminders">
                    <SettingsGroup>
                        {rows.map((reminder, index) => (
                            <React.Fragment key={reminder.id}>
                                {index > 0 ? <Separator /> : null}
                                <SettingsItem>
                                    <div className="grid gap-1 text-sm">
                                        <span className="font-medium text-foreground">
                                            {reminder.title}
                                        </span>
                                        <span className="text-muted">
                                            {new Date(reminder.fireAt).toLocaleString()}
                                            {reminder.repeat ? ` · ${reminder.repeat}` : ''}
                                        </span>
                                    </div>
                                </SettingsItem>
                            </React.Fragment>
                        ))}
                    </SettingsGroup>
                </SettingsSection>
            </SettingsPage>
        </div>
    );
}

export function HostedAgentWorkspaceTab({
    agent,
    server,
}: {
    agent: HostedAgent;
    server: ServerDetail;
}) {
    const [selectedPath, setSelectedPath] = React.useState<string | null>(null);
    const workspace = grottoTrpc.agent.workspaceFiles.useQuery(
        { agentId: agent.id, path: '', serverId: server.id },
        { enabled: server.role !== 'member' }
    );
    if (server.role === 'member') {
        return (
            <TabEmptyState
                description="Only Server Owners and Admins can inspect raw Agent workspace files."
                icon={Folder01Icon}
                title="Workspace Unavailable"
            />
        );
    }

    return (
        <div className="flex h-full min-h-[32rem] flex-col py-3">
            <div className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-separator border-b px-3 pb-3">
                <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-mono text-muted text-xs">
                        {workspace.data?.workspaceRoot ?? 'Workspace'}
                    </span>
                    <CopyButton
                        disabled={!workspace.data?.workspaceRoot}
                        label="Copy workspace path"
                        value={workspace.data?.workspaceRoot ?? ''}
                    />
                </div>
            </div>
            <div className="min-h-0 flex-1 pt-3">
                <WorkspaceBrowserContent
                    agentId={agent.id}
                    onSelectPath={setSelectedPath}
                    selectedPath={selectedPath}
                    serverId={server.id}
                    sidebarStorageKey={`grotto.agent-profile.${agent.id}.workspace.width`}
                />
            </div>
        </div>
    );
}

export function HostedAgentAppsTab() {
    return (
        <TabEmptyState
            description="Apps this Agent signs into will appear here."
            icon={Link04Icon}
            title="No Connected Apps Yet"
        />
    );
}

export function HostedAgentMcpTab({ agent, server }: { agent: HostedAgent; server: ServerDetail }) {
    const connections = grottoTrpc.mcp.list.useQuery({ serverId: server.id });
    return (
        <div className="px-5 py-6 sm:px-7">
            <SettingsPage>
                <HostedAgentTools
                    agent={agent}
                    connections={connections.data ?? []}
                    serverId={server.id}
                />
            </SettingsPage>
        </div>
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
