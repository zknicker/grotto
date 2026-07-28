import {
    Copy01Icon,
    Folder01Icon,
    Link04Icon,
    Notification03Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { CopyButton } from '../../../components/ui/copy-button.tsx';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '../../../components/ui/empty.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Spinner } from '../../../components/ui/spinner.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { HostedAgentTools } from '../../../routes/app/hosted-agent-tools.tsx';
import { WorkspaceBrowserContent } from '../../chats/chat-artifact-workspace-content.tsx';
import { serverChatRoute } from '../../servers/server-routes.ts';
import { HostedAgentProfileTab } from './hosted-agent-profile-tab.tsx';

export { HostedAgentProfileTab };

export function HostedAgentActivityTab({
    agent,
    server,
}: {
    agent: HostedAgent;
    server: ServerDetail;
}) {
    const activity = grottoTrpc.agent.activity.useQuery({
        agentId: agent.id,
        limit: 50,
        serverId: server.id,
    });
    const entries = activity.data ?? [];
    return (
        <div className="mx-auto w-full max-w-4xl py-6">
            <header className="mb-3 flex items-center justify-between gap-4 px-3">
                <h2 className="font-semibold text-base">Activity diagnostics</h2>
                <Button
                    disabled={entries.length === 0}
                    onClick={() =>
                        void navigator.clipboard.writeText(
                            entries
                                .map(
                                    (entry) =>
                                        `${entry.endedAt} · ${entry.status} · ${entry.summary}`
                                )
                                .join('\n')
                        )
                    }
                    size="sm"
                    variant="outline"
                >
                    <Icon icon={Copy01Icon} />
                    Copy Diagnostic Info
                </Button>
            </header>
            {activity.isPending ? (
                <Loading label="Loading activity..." />
            ) : entries.length === 0 ? (
                <p className="px-3 py-8 text-muted-foreground text-sm">No activity yet</p>
            ) : (
                <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                    {entries.map((entry) => (
                        <li
                            className="grid grid-cols-[6rem_auto_minmax(0,1fr)] items-baseline gap-2 px-3 py-2.5 text-sm"
                            key={entry.runId}
                        >
                            <time className="text-meta text-muted-foreground tabular-nums">
                                {new Date(entry.endedAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </time>
                            <span
                                className={`size-2 rounded-full ${
                                    entry.status === 'failed' ? 'bg-destructive' : 'bg-success'
                                }`}
                            />
                            <span>
                                <span className="font-medium capitalize">{entry.status}</span>
                                <span className="ml-2 text-muted-foreground">{entry.summary}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function HostedAgentChatTab({
    agent,
    server,
}: {
    agent: HostedAgent;
    server: ServerDetail;
}) {
    const navigate = useNavigate();
    const chats = grottoTrpc.agent.chats.useQuery({
        agentId: agent.id,
        serverId: server.id,
    });
    if (chats.isPending) {
        return <Loading label="Loading chats..." />;
    }
    const rows = chats.data ?? [];
    return (
        <div className="mx-auto grid w-full max-w-3xl gap-8 py-6">
            <header className="px-3">
                <h2 className="font-semibold text-base">Agent channels and DMs</h2>
            </header>
            {rows.length === 0 ? (
                <p className="px-3 text-muted-foreground text-sm">No chats yet.</p>
            ) : (
                <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                    {rows.map((chat) => (
                        <li key={chat.id}>
                            <button
                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-accent"
                                onClick={() => navigate(serverChatRoute(server.slug, chat.id))}
                                type="button"
                            >
                                <span className="text-muted-foreground">
                                    {chat.kind === 'channel' ? '#' : '◌'}
                                </span>
                                <span className="truncate font-medium">
                                    {chat.name ?? `Direct · @${agent.handle}`}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

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
    if (server.role === 'member' || (reminders.data?.length ?? 0) === 0) {
        return (
            <EmptyState
                description={`Just tell ${agent.displayName} what to remember and when.`}
                icon={Notification03Icon}
                title="No reminders yet"
            />
        );
    }
    return (
        <ul className="mx-auto my-6 w-full max-w-3xl divide-y divide-border rounded-xl border border-border bg-card">
            {reminders.data?.map((reminder) => (
                <li className="grid gap-1 px-4 py-3 text-sm" key={reminder.id}>
                    <span className="font-medium">{reminder.title}</span>
                    <span className="text-muted-foreground">
                        {new Date(reminder.fireAt).toLocaleString()}
                        {reminder.repeat ? ` · ${reminder.repeat}` : ''}
                    </span>
                </li>
            ))}
        </ul>
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
            <EmptyState
                description="Only Server Owners and Admins can inspect raw Agent workspace files."
                icon={Folder01Icon}
                title="Workspace unavailable"
            />
        );
    }

    return (
        <div className="flex h-full min-h-[32rem] flex-col py-3">
            <div className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-border border-b px-3 pb-3">
                <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-mono text-meta text-muted-foreground">
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
        <EmptyState
            description="Apps this Agent signs into will appear here."
            icon={Link04Icon}
            title="No connected apps yet"
        />
    );
}

export function HostedAgentMcpTab({ agent, server }: { agent: HostedAgent; server: ServerDetail }) {
    const connections = grottoTrpc.mcp.list.useQuery({ serverId: server.id });
    return (
        <div className="mx-auto w-full max-w-3xl py-6">
            <HostedAgentTools
                agent={agent}
                connections={connections.data ?? []}
                serverId={server.id}
            />
        </div>
    );
}

function Loading({ label }: { label: string }) {
    return (
        <p className="flex items-center gap-2 px-6 py-10 text-muted-foreground text-sm">
            <Spinner className="size-4" />
            {label}
        </p>
    );
}

function EmptyState({
    description,
    icon,
    title,
}: {
    description: string;
    icon: Parameters<typeof Icon>[0]['icon'];
    title: string;
}) {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Icon icon={icon} />
                </EmptyMedia>
                <EmptyTitle className="text-base">{title}</EmptyTitle>
                <EmptyDescription className="text-sm">{description}</EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}
