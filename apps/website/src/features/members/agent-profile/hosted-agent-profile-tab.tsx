import type { HostedAgent, HostedAgentSkillMetadata, HostedImportableSkill } from '@tavern/api';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../../components/ui/badge.tsx';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { PickerPopover } from '../../agents/picker-popover.tsx';
import { computerHealthLabel } from '../../computers/computer-detail.tsx';
import { computerLabel } from '../../computers/presentation.ts';
import { serverComputersRoute } from '../../servers/server-routes.ts';
import { formatSkillName } from '../../skills/skill-name-format.ts';
import { AgentIdentityDialog } from './agent-identity-dialog.tsx';
import { HostedAgentDangerSection } from './hosted-agent-danger-section.tsx';
import { RuntimeConfigDialog } from './runtime-config-dialog.tsx';
import { resolveRuntimeConfig, runtimeConfigStatusLabel } from './runtime-config-model.ts';

export function HostedAgentProfileTab({
    agent,
    onDeleted,
    server,
}: {
    agent: HostedAgent;
    onDeleted: () => void;
    server: ServerDetail;
}) {
    const utils = grottoTrpc.useUtils();
    const computers = grottoTrpc.computer.list.useQuery({ serverId: server.id });
    const [identityOpen, setIdentityOpen] = React.useState(false);
    const [runtimeConfigOpen, setRuntimeConfigOpen] = React.useState(false);
    const updateProfile = grottoTrpc.agent.updateProfile.useMutation({
        onSuccess: () => utils.agent.list.invalidate({ serverId: server.id }),
    });
    const configure = grottoTrpc.agent.configure.useMutation({
        onSuccess: () => utils.agent.list.invalidate({ serverId: server.id }),
    });
    const computer = computers.data?.find((candidate) => candidate.id === agent.computerId);
    const runtimes = computer?.reportedInventory?.runtimes ?? [];
    const execution = resolveRuntimeConfig(agent, runtimes);
    const agentSkills =
        computer?.reportedInventory?.agentSkills?.find((entry) => entry.agentId === agent.id)
            ?.skills ?? [];
    const importableSkills = selectAddableHostedSkills(
        computer?.reportedInventory?.importableSkills ?? [],
        agentSkills
    );
    const canEdit = server.role === 'owner' || server.role === 'admin';
    const importSkill = grottoTrpc.agent.importSkill.useMutation();

    return (
        <>
            <div className="w-full px-5 pb-8 sm:px-7">
                <DetailSection
                    action={
                        canEdit ? (
                            <Button
                                onClick={() => setIdentityOpen(true)}
                                size="sm"
                                variant="secondary"
                            >
                                Edit
                            </Button>
                        ) : null
                    }
                    title="Profile"
                >
                    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                        <DetailFact label="Name">{agent.displayName}</DetailFact>
                        <DetailFact label="Description">
                            {agent.description ?? 'No description yet.'}
                        </DetailFact>
                    </dl>
                </DetailSection>

                <DetailSection title="Info">
                    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                        <DetailFact label="Handle">@{agent.handle}</DetailFact>
                        <DetailFact label="Role">
                            <span className="capitalize">{agent.role}</span>
                        </DetailFact>
                        <DetailFact label="Computer">
                            {computer ? (
                                <Link
                                    className="hover:text-foreground"
                                    to={`${serverComputersRoute(server.slug)}?computer=${encodeURIComponent(computer.id)}`}
                                >
                                    {computerLabel(computer)} ·{' '}
                                    {computerHealthLabel(computer.health)}
                                </Link>
                            ) : (
                                'Computer unavailable'
                            )}
                        </DetailFact>
                        <DetailFact label="Created">{formatDate(agent.createdAt)}</DetailFact>
                    </dl>
                </DetailSection>

                <DetailSection
                    action={
                        canEdit ? (
                            <Button
                                onClick={() => setRuntimeConfigOpen(true)}
                                size="sm"
                                variant="secondary"
                            >
                                Edit
                            </Button>
                        ) : null
                    }
                    title="Runtime config"
                >
                    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
                        <ConfigFact
                            available={Boolean(execution.runtime)}
                            label="Runtime"
                            value={execution.runtimeLabel}
                        />
                        <ConfigFact
                            available={Boolean(execution.model)}
                            label="Model"
                            value={execution.modelLabel}
                        />
                        <DetailFact label="Status">
                            {runtimeConfigStatusLabel(agent, computer?.health)}
                        </DetailFact>
                    </dl>
                    {agent.status === 'degraded' ? (
                        <p className="text-base text-warning-foreground sm:text-sm">
                            Choose an installed runtime and model to restore this Agent.
                        </p>
                    ) : null}
                </DetailSection>

                <DetailSection
                    action={
                        canEdit ? (
                            <PickerPopover
                                emptyText="Every available skill is already added."
                                isPending={importSkill.isPending}
                                items={importableSkills.map((skill) => ({
                                    id: skill.id,
                                    name: formatSkillName(skill.name),
                                }))}
                                label="Add skills"
                                onAdd={(skill) =>
                                    void withSavingToast(() =>
                                        importSkill.mutateAsync({
                                            agentId: agent.id,
                                            serverId: server.id,
                                            sourceId: skill.id,
                                        })
                                    ).catch(() => undefined)
                                }
                                searchPlaceholder="Search skills..."
                            />
                        ) : null
                    }
                    count={agentSkills.length}
                    title="Skills"
                >
                    {agentSkills.length > 0 ? (
                        <div className="divide-y divide-border/50 border-border/60 border-y">
                            {agentSkills.map((skill) => (
                                <div
                                    className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                                    key={skill.name}
                                >
                                    <div className="min-w-0">
                                        <p className="font-medium text-foreground text-sm">
                                            {skill.name}
                                        </p>
                                        <p className="text-base text-muted-foreground sm:text-sm">
                                            {skill.description}
                                        </p>
                                    </div>
                                    <p className="shrink-0 text-meta text-muted-foreground">
                                        Updated {formatDate(skill.modifiedAt)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-base text-muted-foreground sm:text-sm">No skills yet.</p>
                    )}
                    {importSkill.error ? (
                        <p className="text-error text-sm">{importSkill.error.message}</p>
                    ) : null}
                </DetailSection>
                <HostedAgentDangerSection agent={agent} onDeleted={onDeleted} server={server} />
            </div>
            <AgentIdentityDialog
                agent={agent}
                error={updateProfile.error?.message ?? null}
                onOpenChange={setIdentityOpen}
                onSave={async (identity) => {
                    await withSavingToast(() =>
                        updateProfile.mutateAsync({
                            agentId: agent.id,
                            serverId: server.id,
                            ...identity,
                        })
                    );
                    setIdentityOpen(false);
                }}
                open={identityOpen}
                pending={updateProfile.isPending}
            />
            <RuntimeConfigDialog
                agent={agent}
                error={configure.error?.message ?? null}
                onOpenChange={setRuntimeConfigOpen}
                onSave={async (draft) => {
                    await withSavingToast(() =>
                        configure.mutateAsync({
                            agentId: agent.id,
                            serverId: server.id,
                            ...draft,
                        })
                    );
                    setRuntimeConfigOpen(false);
                }}
                open={runtimeConfigOpen}
                pending={configure.isPending}
                runtimes={runtimes}
            />
        </>
    );
}

function DetailSection({
    action,
    children,
    count,
    last = false,
    title,
}: {
    action?: React.ReactNode;
    children: React.ReactNode;
    count?: number;
    last?: boolean;
    title: string;
}) {
    return (
        <section className={`grid gap-4 py-5 ${last ? '' : 'border-border/50 border-b'}`}>
            <BadgeDivider action={action} subtext={count?.toString()} variant="subtle">
                {title}
            </BadgeDivider>
            {children}
        </section>
    );
}

function DetailFact({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <div className="grid gap-1">
            <dt className="text-meta text-muted-foreground">{label}</dt>
            <dd className="text-base text-foreground sm:text-sm">{children}</dd>
        </div>
    );
}

function ConfigFact({
    available,
    label,
    value,
}: {
    available: boolean;
    label: string;
    value: string;
}) {
    return (
        <DetailFact label={label}>
            <span className="flex flex-wrap items-center gap-2">
                {value}
                {available ? null : (
                    <Badge size="sm" variant="warning">
                        Not installed
                    </Badge>
                )}
            </span>
        </DetailFact>
    );
}

function formatDate(value: Date | string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function selectAddableHostedSkills(
    sources: HostedImportableSkill[],
    owned: HostedAgentSkillMetadata[]
) {
    const ownedNames = new Set(owned.map((skill) => skill.name));
    return sources.filter((source) => !ownedNames.has(source.name));
}
