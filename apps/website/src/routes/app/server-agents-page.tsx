import type { HostedAgent, HostedComputerInventory, HostedMcpConnection } from '@tavern/api';
import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Field, FieldError, FieldLabel } from '../../components/ui/primitives/field.tsx';
import { Form } from '../../components/ui/primitives/form.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { serverRoute } from '../../features/servers/server-routes.ts';
import { useServer } from '../../hooks/servers/use-server.ts';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { HostedAgentTools } from './hosted-agent-tools.tsx';

interface ReportedComputer {
    id: string;
    inventory: HostedComputerInventory;
    label: string;
}

const selectClass =
    'h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground disabled:opacity-50';

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
    if (server.data.role === 'member') {
        return (
            <main className="grid min-h-dvh place-content-center text-muted-foreground text-sm">
                Owner or Admin required.
            </main>
        );
    }

    const reported: ReportedComputer[] = (computers.data ?? [])
        .filter((computer) => (computer.reportedInventory?.runtimes.length ?? 0) > 0)
        .map((computer) => ({
            id: computer.id,
            inventory: computer.reportedInventory as HostedComputerInventory,
            label: `${computer.operatingSystem ?? 'Computer'} · ${computer.architecture ?? '—'}`,
        }));

    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 p-6">
            <Link
                className="text-muted-foreground text-sm hover:text-foreground"
                to={serverRoute(slug)}
            >
                Back to /{slug}
            </Link>
            <div>
                <h1 className="font-semibold text-foreground text-xl">Agents</h1>
                <p className="text-muted-foreground text-sm">
                    An Agent runs on exactly one Computer with a chosen runtime and model.
                </p>
            </div>

            {reported.length > 0 ? (
                <CreateAgentForm
                    firstAgent={(agents.data?.length ?? 0) === 0}
                    reported={reported}
                    serverId={serverId}
                />
            ) : (
                <p className="rounded-lg border border-border border-dashed p-4 text-muted-foreground text-sm">
                    Waiting for a Computer to report its runtimes. Attach one on the{' '}
                    <Link className="underline" to={`${serverRoute(slug)}/computers`}>
                        Computers
                    </Link>{' '}
                    page.
                </p>
            )}

            <AgentList
                agents={agents.data ?? []}
                connections={connections.data ?? []}
                serverId={serverId}
            />
        </main>
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

    return (
        <Form
            className="rounded-lg border border-border p-4"
            onSubmit={(event) => {
                event.preventDefault();
                create.mutate(
                    {
                        computerId: computer?.id ?? '',
                        displayName: displayName.trim(),
                        handle: handle.trim(),
                        modelId:
                            runtime?.models.find((model) => model.id === modelId)?.id ?? modelId,
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
            {firstAgent ? (
                <p className="text-muted-foreground text-sm">
                    Start with <span className="font-medium text-foreground">Cove</span>, or name
                    your own first Agent.
                </p>
            ) : null}
            <Field>
                <FieldLabel htmlFor="agent-name">Name</FieldLabel>
                <Input
                    autoComplete="off"
                    id="agent-name"
                    onChange={(event) => setDisplayName(event.currentTarget.value)}
                    placeholder="Cove"
                    value={displayName}
                />
            </Field>
            <Field>
                <FieldLabel htmlFor="agent-handle">Handle</FieldLabel>
                <Input
                    autoComplete="off"
                    id="agent-handle"
                    onChange={(event) => setHandle(event.currentTarget.value)}
                    placeholder="cove"
                    value={handle}
                />
            </Field>
            <Field>
                <FieldLabel htmlFor="agent-computer">Computer</FieldLabel>
                <select
                    className={selectClass}
                    id="agent-computer"
                    onChange={(event) => {
                        setComputerId(event.currentTarget.value);
                        const next = reported.find(
                            (entry) => entry.id === event.currentTarget.value
                        );
                        const firstRuntime = next?.inventory.runtimes[0];
                        setRuntimeId(firstRuntime?.id ?? '');
                        setModelId(firstRuntime?.models[0]?.id ?? '');
                    }}
                    value={computer?.id ?? ''}
                >
                    {reported.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                            {entry.label}
                        </option>
                    ))}
                </select>
            </Field>
            <Field>
                <FieldLabel htmlFor="agent-runtime">Runtime</FieldLabel>
                <select
                    className={selectClass}
                    id="agent-runtime"
                    onChange={(event) => {
                        setRuntimeId(event.currentTarget.value);
                        const nextRuntime = runtimes.find(
                            (entry) => entry.id === event.currentTarget.value
                        );
                        setModelId(nextRuntime?.models[0]?.id ?? '');
                    }}
                    value={runtime?.id ?? ''}
                >
                    {runtimes.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                            {entry.label}
                        </option>
                    ))}
                </select>
            </Field>
            <Field>
                <FieldLabel htmlFor="agent-model">Model</FieldLabel>
                <select
                    className={selectClass}
                    id="agent-model"
                    onChange={(event) => setModelId(event.currentTarget.value)}
                    value={modelId}
                >
                    {models.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                            {entry.label}
                        </option>
                    ))}
                </select>
                {create.error ? <FieldError role="alert">{create.error.message}</FieldError> : null}
            </Field>
            <Button
                className="self-start"
                disabled={displayName.trim().length === 0 || handle.trim().length === 0 || !modelId}
                loading={create.isPending}
                type="submit"
            >
                Create Agent
            </Button>
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
    if (agents.length === 0) {
        return <p className="text-muted-foreground text-sm">No Agents yet.</p>;
    }
    return (
        <ul className="divide-y divide-border rounded-lg border border-border">
            {agents.map((agent) => (
                <li className="flex flex-col gap-1 p-4" key={agent.id}>
                    <div className="flex items-center justify-between gap-4">
                        <p className="font-medium text-sm">
                            {agent.displayName}{' '}
                            <span className="text-muted-foreground">@{agent.handle}</span>
                        </p>
                        <AgentStatusBadge agent={agent} />
                    </div>
                    <p className="text-muted-foreground text-xs">
                        Wants {agent.desiredRuntimeId} · {agent.desiredModelId}
                        {agent.effectiveReportedAt
                            ? ` · running ${agent.effectiveRuntimeId ?? '—'} · ${agent.effectiveModelId ?? '—'}`
                            : ' · never reported'}
                    </p>
                    {agent.status === 'degraded' ? (
                        <p className="text-destructive text-xs">
                            Missing: {agent.missingResources.join(', ')}
                        </p>
                    ) : null}
                    <HostedAgentTools agent={agent} connections={connections} serverId={serverId} />
                </li>
            ))}
        </ul>
    );
}

function AgentStatusBadge({ agent }: { agent: HostedAgent }) {
    const tone =
        agent.status === 'applied'
            ? 'text-foreground'
            : agent.status === 'degraded'
              ? 'text-destructive'
              : 'text-muted-foreground';
    const label =
        agent.status === 'applied'
            ? 'applied'
            : agent.status === 'degraded'
              ? 'degraded'
              : 'pending';
    return <span className={`text-xs ${tone}`}>{label}</span>;
}
