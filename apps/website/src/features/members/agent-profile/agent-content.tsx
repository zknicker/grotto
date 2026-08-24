import { Separator } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { Folder01Icon, Notification03Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { Agent } from '@tavern/api';
import * as React from 'react';
import { CopyButton } from '../../../components/copy-button.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAgentReminders } from '../../../hooks/members/use-agent-reminders.ts';
import { useAgentWorkspace } from '../../../hooks/members/use-agent-workspace.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { WorkspaceBrowserContent } from '../../chats/chat-artifact-workspace-content.tsx';
import {
    SettingsGroup,
    SettingsItem,
    SettingsSection,
} from '../../settings/layout/settings-page.tsx';
import { PageColumn } from '../../shell/page-column.tsx';
import { AgentLoading } from './agent-loading.tsx';
import { AgentOverview } from './agent-overview.tsx';

export { AgentActivity } from './agent-activity.tsx';
export { AgentOverview };
export { AgentTools } from './agent-tools.tsx';

export function AgentReminders({ agent, server }: { agent: Agent; server: ServerDetail }) {
    const reminders = useAgentReminders(server.id, agent.id, server.role !== 'member');
    const rows = reminders.data ?? [];
    if (server.role !== 'member' && reminders.isPending) {
        return (
            <div className="px-5 py-6 sm:px-7">
                <AgentLoading label="Loading reminders" />
            </div>
        );
    }
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
            <PageColumn>
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
            </PageColumn>
        </div>
    );
}

export function AgentWorkspace({ agent, server }: { agent: Agent; server: ServerDetail }) {
    const [selectedPath, setSelectedPath] = React.useState<string | null>(null);
    const workspace = useAgentWorkspace(server.id, agent.id, server.role !== 'member');
    if (server.role === 'member') {
        return (
            <TabEmptyState
                description="Only workspace owners and admins can inspect raw Agent workspace files."
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
