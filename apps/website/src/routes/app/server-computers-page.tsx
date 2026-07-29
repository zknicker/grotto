import { resolveAgentDefaultCharacter } from '@tavern/api/agent-appearance';
import * as React from 'react';
import { useParams } from 'react-router-dom';
import { CodeSnippet } from '../../components/ui/code-snippet.tsx';
import { Empty, EmptyDescription, EmptyHeader } from '../../components/ui/empty.tsx';
import { EmptyState } from '../../components/ui/empty-state.tsx';
import { navSelectedClass } from '../../components/ui/nav.tsx';
import { PaneTopbar, PaneTopbarTitle, SidePane } from '../../components/ui/pane.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsItem,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../../components/ui/settings-row.tsx';
import { StatusDot, type StatusDotProps } from '../../components/ui/status-dot.tsx';
import { AgentFace } from '../../features/chats/agent-face.tsx';
import { ComputerUpdateControls } from '../../features/servers/computer-update-controls.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { RequireOperator } from '../../features/servers/require-operator.tsx';
import type { GrottoOutputs } from '../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { cn } from '../../lib/utils.ts';
import { HostedDeleteDialog } from './hosted-delete-dialog.tsx';

type Computer = GrottoOutputs['computer']['list'][number];

/** Server-owned Computer inventory backed by persisted reports and the live attachment socket. */
export function ServerComputersPage() {
    const { slug = '' } = useParams();
    const { agents, server } = useHostedServerContext();
    const computers = grottoTrpc.computer.list.useQuery({ serverId: server.id }, { enabled: true });
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [removing, setRemoving] = React.useState<string | null>(null);
    const utils = grottoTrpc.useUtils();
    const remove = grottoTrpc.computer.remove.useMutation({
        onSuccess: () => {
            setRemoving(null);
            void utils.computer.list.invalidate({ serverId: server.id });
        },
    });

    const items = computers.data ?? [];
    const selected = items.find((computer) => computer.id === selectedId) ?? items[0] ?? null;

    return (
        <RequireOperator
            description="Computers are attached and removed by Server operators."
            role={server.role}
        >
            <div className="flex h-full min-h-0 w-full">
                <SidePane className="app-shell-sidebar-top-inset w-72 flex-col bg-sidebar" side="left">
                    <PaneTopbar className="bg-transparent">
                        <PaneTopbarTitle className="font-medium">
                            Computers <span className="text-muted-foreground">{items.length}</span>
                        </PaneTopbarTitle>
                    </PaneTopbar>
                    <div className="min-h-0 flex-1 overflow-y-auto p-2">
                        {items.map((computer) => (
                            <button
                                className={cn(
                                    'flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-sm',
                                    selected?.id === computer.id
                                        ? navSelectedClass
                                        : 'hover:bg-[var(--nav-hover)]'
                                )}
                                key={computer.id}
                                onClick={() => setSelectedId(computer.id)}
                                type="button"
                            >
                                <span className="font-medium">{computerLabel(computer)}</span>
                                <span className="flex items-center gap-1.5 text-meta text-muted-foreground">
                                    <StatusDot status={healthStatus(computer.health)} />
                                    {healthLabel(computer.health)} · v
                                    {computer.productVersion ?? '—'}
                                </span>
                            </button>
                        ))}
                        {items.length === 0 ? (
                            <Empty className="px-3 py-10 md:py-10">
                                <EmptyHeader>
                                    <EmptyDescription className="text-sm">
                                        No Computers attached.
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        ) : null}
                    </div>
                    <div className="border-[var(--content-card-border)] border-t p-4">
                        <p className="text-muted-foreground text-sm">
                            Add one from an Apple Silicon Mac:
                        </p>
                        <CodeSnippet
                            className="mt-2 h-auto py-2"
                            lines={`curl -fsSL https://releases.grotto.sh/computer/install.sh | sh -s -- /${slug}`}
                        />
                    </div>
                </SidePane>
                <main className="app-shell-sidebar-top-inset min-w-0 flex-1 overflow-y-auto">
                    {selected ? (
                        <ComputerDetail
                            agents={agents.filter((agent) => agent.computerId === selected.id)}
                            computer={selected}
                            onRemove={() => setRemoving(selected.id)}
                            serverId={server.id}
                            serverSlug={slug}
                        />
                    ) : (
                        <EmptyState
                            className="min-h-full"
                            description="Computers run Agents and keep their workspaces, skills, connections, and execution credentials local."
                            title="Attach a Computer"
                        />
                    )}
                </main>
                {removing ? (
                    <HostedDeleteDialog
                        confirmation="REMOVE"
                        description="This immediately revokes this Computer’s credential. It cannot be removed while any Agent is assigned to it."
                        onConfirm={() =>
                            remove.mutate({
                                computerId: removing,
                                confirmation: 'REMOVE',
                                serverId: server.id,
                            })
                        }
                        onOpenChange={(open) => !open && setRemoving(null)}
                        pending={remove.isPending}
                        title="Remove Computer"
                    />
                ) : null}
            </div>
        </RequireOperator>
    );
}

function ComputerDetail({
    agents,
    computer,
    onRemove,
    serverId,
    serverSlug,
}: {
    agents: GrottoOutputs['agent']['list'];
    computer: Computer;
    onRemove: () => void;
    serverId: string;
    serverSlug: string;
}) {
    const runtimes = computer.reportedInventory?.runtimes ?? [];

    return (
        <SettingsPage className="px-6 py-6">
            <SettingsPageHeader
                description={
                    <span className="flex items-center gap-2">
                        <StatusDot status={healthStatus(computer.health)} />
                        {healthLabel(computer.health)}
                        {computer.lastConnectedAt
                            ? ` · Last connected ${formatTimestamp(computer.lastConnectedAt)}`
                            : ''}
                    </span>
                }
                title={computerLabel(computer)}
            />

            <SettingsSection title="Info">
                <SettingsGroup>
                    <SettingsRow title="OS">
                        <SettingsValue>
                            {[computer.operatingSystem, computer.architecture]
                                .filter(Boolean)
                                .join(' · ') || 'Awaiting first report'}
                        </SettingsValue>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Computer version">
                        <SettingsValue>v{computer.productVersion ?? '—'}</SettingsValue>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Protocol">
                        <SettingsValue>{computer.protocolVersion?.toString() ?? '—'}</SettingsValue>
                    </SettingsRow>
                </SettingsGroup>
            </SettingsSection>

            <SettingsSection title="Detected Agent runtimes">
                <SettingsGroup>
                    {runtimes.length > 0 ? (
                        runtimes.map((runtime, index) => (
                            <React.Fragment key={runtime.id}>
                                {index > 0 ? <Separator /> : null}
                                <SettingsRow title={runtime.label}>
                                    <SettingsValue>
                                        {runtime.models.map((model) => model.label).join(', ') ||
                                            'No models reported'}
                                    </SettingsValue>
                                </SettingsRow>
                            </React.Fragment>
                        ))
                    ) : (
                        <SettingsItem className="text-muted-foreground text-sm">
                            No runtimes reported yet.
                        </SettingsItem>
                    )}
                </SettingsGroup>
            </SettingsSection>

            <SettingsSection title="Assigned Agents">
                <SettingsGroup>
                    {agents.length > 0 ? (
                        agents.map((agent, index) => (
                            <React.Fragment key={agent.id}>
                                {index > 0 ? <Separator /> : null}
                                <SettingsRow title={<AgentRowLabel agent={agent} />}>
                                    <SettingsValue>
                                        {agent.availability} · {agent.desiredRuntimeId} ·{' '}
                                        {agent.desiredModelId}
                                    </SettingsValue>
                                </SettingsRow>
                            </React.Fragment>
                        ))
                    ) : (
                        <SettingsItem className="text-muted-foreground text-sm">
                            No Agents assigned.
                        </SettingsItem>
                    )}
                </SettingsGroup>
            </SettingsSection>

            <SettingsSection title="Updates">
                <SettingsGroup>
                    <SettingsItem>
                        <ComputerUpdateControls computer={computer} serverId={serverId} />
                    </SettingsItem>
                </SettingsGroup>
            </SettingsSection>

            <SettingsSection title="Recovery">
                <SettingsGroup>
                    <SettingsItem className="space-y-2">
                        <p className="text-muted-foreground text-sm">
                            If the App and this Computer disagree, check the machine directly:
                        </p>
                        <CodeSnippet
                            lines={[
                                'grotto-computer status',
                                'grotto-computer doctor',
                                `grotto-computer restart /${serverSlug}`,
                                'grotto-computer upgrade --rollback',
                            ]}
                        />
                    </SettingsItem>
                </SettingsGroup>
            </SettingsSection>

            <SettingsSection title="Danger zone">
                <SettingsGroup>
                    <SettingsRow
                        description="Every assigned Agent must be deleted first."
                        title="Remove Computer"
                        trailingWidth="intrinsic"
                    >
                        <div className="flex justify-start md:justify-end">
                            <Button onClick={onRemove} type="button" variant="destructive">
                                Remove Computer
                            </Button>
                        </div>
                    </SettingsRow>
                </SettingsGroup>
            </SettingsSection>
        </SettingsPage>
    );
}

function AgentRowLabel({ agent }: { agent: GrottoOutputs['agent']['list'][number] }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center overflow-visible"
            >
                <AgentFace
                    animate={false}
                    head={resolveAgentDefaultCharacter(agent.id)}
                    size={24}
                    style={{ flexShrink: 0, height: 24, overflow: 'visible', width: 24 }}
                />
            </span>
            <span className="truncate">{agent.displayName}</span>
        </span>
    );
}

function computerLabel(computer: Computer) {
    const platform = computer.operatingSystem === 'darwin' ? 'Mac' : computer.operatingSystem;
    return platform
        ? `${platform} · ${computer.id.slice(-6)}`
        : `Computer · ${computer.id.slice(-6)}`;
}

function healthLabel(health: Computer['health']) {
    switch (health) {
        case 'healthy':
            return 'Online';
        case 'offline':
            return 'Offline';
        case 'update-required':
            return 'Update required';
        case 'degraded':
            return 'Needs attention';
    }
}

function healthStatus(health: Computer['health']): StatusDotProps['status'] {
    switch (health) {
        case 'healthy':
            return 'success';
        case 'offline':
            return 'muted';
        default:
            return 'warning';
    }
}

function formatTimestamp(value: Date | string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
