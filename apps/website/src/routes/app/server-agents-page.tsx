import type { HostedAgent, HostedComputerInventory, HostedMcpConnection } from '@tavern/api';
import { resolveAgentDefaultCharacter } from '@tavern/api/agent-appearance';
import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge.tsx';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../components/ui/empty.tsx';
import { EmptyState } from '../../components/ui/empty-state.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Form } from '../../components/ui/primitives/form.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
} from '../../components/ui/settings-row.tsx';
import { AgentFace } from '../../features/chats/agent-face.tsx';
import { RequireOperator } from '../../features/servers/require-operator.tsx';
import { serverRoute } from '../../features/servers/server-routes.ts';
import { useServer } from '../../hooks/servers/use-server.ts';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { HostedAgentTools } from './hosted-agent-tools.tsx';
import { HostedDeleteDialog } from './hosted-delete-dialog.tsx';

interface ReportedComputer {
    id: string;
    inventory: HostedComputerInventory;
    label: string;
}

/** Create Cove or another Agent on one reported Computer, and watch desired config converge on effective. */
export function ServerAgentsPage() {
    const { slug = '' } = useParams();
    const server = useServer(slug);
    const serverId = server.data?.id ?? '';
    const enabled = Boolean(server.data);
    const computers = grottoTrpc.computer.list.useQuery({ serverId }, { enabled });
    const agents = grottoTrpc.agent.list.useQuery({ serverId }, { enabled });
    const connections = grottoTrpc.mcp.list.useQuery({ serverId }, { enabled });

    if (!server.data) {
        return null;
    }

    const reported: ReportedComputer[] = (computers.data ?? [])
        .filter((computer) => (computer.reportedInventory?.runtimes.length ?? 0) > 0)
        .map((computer) => ({
            id: computer.id,
            inventory: computer.reportedInventory as HostedComputerInventory,
            label: `${computer.operatingSystem ?? 'Computer'} · ${computer.architecture ?? '—'}`,
        }));

    return (
        <RequireOperator
            description="Agents are created and removed by Server operators."
            role={server.data.role}
        >
            <main className="h-full overflow-y-auto pt-[calc(var(--topbar-height)-4px)]">
                <SettingsPage className="px-6 py-6">
                    <Link
                        className="px-3 text-muted-foreground text-sm hover:text-foreground"
                        to={serverRoute(slug)}
                    >
                        Back to /{slug}
                    </Link>
                    <SettingsPageHeader
                        description="An Agent runs on exactly one Computer with a chosen runtime and model."
                        title="Agents"
                    />

                    {reported.length > 0 ? (
                        <CreateAgentForm
                            firstAgent={(agents.data?.length ?? 0) === 0}
                            reported={reported}
                            serverId={serverId}
                        />
                    ) : (
                        <SettingsSection title="New Agent">
                            <SettingsGroup>
                                <Empty className="py-10 md:py-12">
                                    <EmptyHeader>
                                        <EmptyTitle>Waiting for a Computer</EmptyTitle>
                                        <EmptyDescription>
                                            Attach one on the{' '}
                                            <Link to={`${serverRoute(slug)}/computers`}>
                                                Computers
                                            </Link>{' '}
                                            page to see its runtimes.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            </SettingsGroup>
                        </SettingsSection>
                    )}

                    <AgentList
                        agents={agents.data ?? []}
                        connections={connections.data ?? []}
                        serverId={serverId}
                    />
                </SettingsPage>
            </main>
        </RequireOperator>
    );
}

function CreateAgentForm({
    firstAgent,
    reported,
    serverId,
}: {
    firstAgent: boolean;
    reported: ReportedComputer[];
    serverId: string;
}) {
    const utils = grottoTrpc.useUtils();
    const create = grottoTrpc.agent.create.useMutation({
        onSuccess: () => {
            void utils.agent.list.invalidate({ serverId });
            void utils.chat.list.invalidate({ serverId });
        },
    });
    const [computerId, setComputerId] = React.useState(reported[0]?.id ?? '');
    const computer = reported.find((entry) => entry.id === computerId) ?? reported[0];
    const runtimes = computer?.inventory.runtimes ?? [];
    const [runtimeId, setRuntimeId] = React.useState(runtimes[0]?.id ?? '');
    const runtime = runtimes.find((entry) => entry.id === runtimeId) ?? runtimes[0];
    const models = runtime?.models ?? [];
    const [modelId, setModelId] = React.useState(models[0]?.id ?? '');
    const [displayName, setDisplayName] = React.useState(firstAgent ? 'Cove' : '');
    const [handle, setHandle] = React.useState(firstAgent ? 'cove' : '');
    const model = models.find((entry) => entry.id === modelId) ?? models[0];

    return (
        <Form
            onSubmit={(event) => {
                event.preventDefault();
                create.mutate(
                    {
                        computerId: computer?.id ?? '',
                        displayName: displayName.trim(),
                        handle: handle.trim(),
                        modelId: model?.id ?? modelId,
                        role: 'member',
                        runtimeId: runtime?.id ?? '',
                        serverId,
                    },
                    {
                        onSuccess: () => {
                            setDisplayName('');
                            setHandle('');
                        },
                    }
                );
            }}
        >
            <SettingsSection title="New Agent">
                <SettingsGroup>
                    <SettingsRow
                        description={
                            firstAgent
                                ? 'Start with Cove, or name your own first Agent.'
                                : undefined
                        }
                        title="Name"
                    >
                        <Input
                            autoComplete="off"
                            id="agent-name"
                            onChange={(event) => setDisplayName(event.currentTarget.value)}
                            placeholder="Cove"
                            value={displayName}
                        />
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Handle">
                        <Input
                            autoComplete="off"
                            id="agent-handle"
                            onChange={(event) => setHandle(event.currentTarget.value)}
                            placeholder="cove"
                            value={handle}
                        />
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Computer">
                        <Select
                            onValueChange={(value) => {
                                const nextId = value ?? '';
                                setComputerId(nextId);
                                const next = reported.find((entry) => entry.id === nextId);
                                const firstRuntime = next?.inventory.runtimes[0];
                                setRuntimeId(firstRuntime?.id ?? '');
                                setModelId(firstRuntime?.models[0]?.id ?? '');
                            }}
                            value={computer?.id ?? ''}
                        >
                            <SelectTrigger aria-label="Computer">
                                <SelectValue>{computer?.label}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {reported.map((entry) => (
                                    <SelectItem key={entry.id} value={entry.id}>
                                        {entry.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Runtime">
                        <Select
                            onValueChange={(value) => {
                                const nextId = value ?? '';
                                setRuntimeId(nextId);
                                const nextRuntime = runtimes.find((entry) => entry.id === nextId);
                                setModelId(nextRuntime?.models[0]?.id ?? '');
                            }}
                            value={runtime?.id ?? ''}
                        >
                            <SelectTrigger aria-label="Runtime">
                                <SelectValue>{runtime?.label}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {runtimes.map((entry) => (
                                    <SelectItem key={entry.id} value={entry.id}>
                                        {entry.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow error={create.error?.message ?? null} title="Model">
                        <Select
                            onValueChange={(value) => setModelId(value ?? '')}
                            value={model?.id ?? ''}
                        >
                            <SelectTrigger aria-label="Model">
                                <SelectValue>{model?.label}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {models.map((entry) => (
                                    <SelectItem key={entry.id} value={entry.id}>
                                        {entry.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingsRow>
                </SettingsGroup>
                <div className="flex justify-end px-3">
                    <Button
                        disabled={
                            displayName.trim().length === 0 ||
                            handle.trim().length === 0 ||
                            !modelId
                        }
                        loading={create.isPending}
                        type="submit"
                    >
                        Create Agent
                    </Button>
                </div>
            </SettingsSection>
        </Form>
    );
}

function AgentList({
    agents,
    connections,
    serverId,
}: {
    agents: HostedAgent[];
    connections: HostedMcpConnection[];
    serverId: string;
}) {
    const utils = grottoTrpc.useUtils();
    const [deleting, setDeleting] = React.useState<HostedAgent | null>(null);
    const remove = grottoTrpc.agent.delete.useMutation({
        onSuccess: () => {
            setDeleting(null);
            void utils.agent.list.invalidate({ serverId });
            void utils.computer.list.invalidate({ serverId });
        },
    });

    if (agents.length === 0) {
        return (
            <SettingsSection title="Agents">
                <SettingsGroup>
                    <EmptyState
                        className="py-10 md:py-12"
                        description="Create one above to give this Server its first Agent."
                        title="No Agents yet"
                    />
                </SettingsGroup>
            </SettingsSection>
        );
    }

    return (
        <>
            {agents.map((agent) => (
                <SettingsSection className="space-y-4" key={agent.id} title={`@${agent.handle}`}>
                    <SettingsGroup>
                        <SettingsRow
                            description={<AgentConfigSummary agent={agent} />}
                            title={<AgentRowLabel agent={agent} />}
                            trailingWidth="intrinsic"
                        >
                            <div className="flex items-center gap-2 md:justify-end">
                                <AgentStatusBadge agent={agent} />
                                <Button
                                    onClick={() => setDeleting(agent)}
                                    size="sm"
                                    type="button"
                                    variant="destructive"
                                >
                                    Delete Agent
                                </Button>
                            </div>
                        </SettingsRow>
                    </SettingsGroup>
                    <HostedAgentTools agent={agent} connections={connections} serverId={serverId} />
                </SettingsSection>
            ))}
            {deleting ? (
                <HostedDeleteDialog
                    confirmation={deleting.displayName}
                    description="This permanently destroys the Agent’s local workspace, skills, runtime state, queues, and vault when its Computer can be reached. Its authored collaboration history remains."
                    onConfirm={() =>
                        remove.mutate({
                            agentId: deleting.id,
                            confirmation: deleting.displayName,
                            serverId,
                        })
                    }
                    onOpenChange={(open) => !open && setDeleting(null)}
                    pending={remove.isPending}
                    title="Delete Agent"
                />
            ) : null}
        </>
    );
}

function AgentRowLabel({ agent }: { agent: HostedAgent }) {
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

function AgentConfigSummary({ agent }: { agent: HostedAgent }) {
    return (
        <>
            <span className="block">
                Wants {agent.desiredRuntimeId} · {agent.desiredModelId}
                {agent.effectiveReportedAt
                    ? ` · running ${agent.effectiveRuntimeId ?? '—'} · ${agent.effectiveModelId ?? '—'}`
                    : ' · never reported'}
            </span>
            {agent.status === 'degraded' ? (
                <span className="block text-destructive">
                    Missing: {agent.missingResources.join(', ')}
                </span>
            ) : null}
        </>
    );
}

function AgentStatusBadge({ agent }: { agent: HostedAgent }) {
    if (agent.status === 'applied') {
        return <Badge variant="success">applied</Badge>;
    }
    if (agent.status === 'degraded') {
        return <Badge variant="destructive">degraded</Badge>;
    }
    return <Badge variant="secondary">pending</Badge>;
}
