import { Badge, Button, Separator } from '@heroui/react';
import type {
    HostedAgent,
    HostedAgentSkillImportRecord,
    HostedAgentSkillMetadata,
    HostedImportableSkill,
} from '@tavern/api';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import { StatusDot } from '../../../components/ui/status-dot.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { HostedAgentTools } from '../../../routes/app/hosted-agent-tools.tsx';
import { AvatarPicker } from '../../avatars/avatar-picker.tsx';
import { computerHealthLabel } from '../../computers/computer-detail.tsx';
import { computerLabel } from '../../computers/presentation.ts';
import { serverComputersRoute } from '../../servers/server-routes.ts';
import { InlineEditField } from '../../settings/layout/inline-edit-field.tsx';
import {
    SettingsChipField,
    SettingsChipRow,
    SettingsGroup,
    SettingsPage,
    SettingsRow,
    SettingsSection,
} from '../../settings/layout/settings-page.tsx';
import { hostedAvailabilityBadgeColor, hostedAvailabilityStatus } from '../hosted-agent-avatar.tsx';
import { AgentSkillFileDialog } from './agent-skill-file-dialog.tsx';
import { HostedAgentChatsSection } from './hosted-agent-chat-tab.tsx';
import { HostedAgentDangerSection } from './hosted-agent-danger-section.tsx';
import { HostedAgentSessionSection } from './hosted-agent-session-section.tsx';
import { HostedAgentSkillsSection } from './hosted-agent-skills-section.tsx';
import { RuntimeConfigDialog } from './runtime-config-dialog.tsx';
import { resolveRuntimeConfig, runtimeConfigStatusLabel } from './runtime-config-model.ts';

export function HostedAgentOverviewTab({
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
    const connections = grottoTrpc.mcp.list.useQuery({ serverId: server.id });
    const [runtimeConfigOpen, setRuntimeConfigOpen] = React.useState(false);
    const [avatarError, setAvatarError] = React.useState<string | null>(null);
    const setAvatar = grottoTrpc.avatar.set.useMutation({
        onSuccess: () => utils.agent.list.invalidate({ serverId: server.id }),
    });
    const [selectedSkill, setSelectedSkill] = React.useState<HostedAgentSkillMetadata | null>(null);
    const updateProfile = grottoTrpc.agent.updateProfile.useMutation({
        onSuccess: () => utils.agent.list.invalidate({ serverId: server.id }),
    });
    const configure = grottoTrpc.agent.configure.useMutation({
        onSuccess: () => utils.agent.list.invalidate({ serverId: server.id }),
    });
    const computer = computers.data?.find((candidate) => candidate.id === agent.computerId);
    const runtimes = computer?.reportedInventory?.runtimes ?? [];
    const execution = resolveRuntimeConfig(agent, runtimes);
    const skillSources = computer?.reportedInventory?.importableSkills ?? [];
    const agentSkills =
        computer?.reportedInventory?.agentSkills?.find((entry) => entry.agentId === agent.id)
            ?.skills ?? [];
    const canEdit = server.role === 'owner' || server.role === 'admin';
    const importSkill = grottoTrpc.agent.importSkill.useMutation();
    // Identity saves one field at a time, but the profile contract is a full
    // replace — each commit carries the sibling's current server value.
    const saveIdentity = async (identity: { description: string; displayName: string }) => {
        await withSavingToast(() =>
            updateProfile.mutateAsync({
                agentId: agent.id,
                description: identity.description.trim() || null,
                displayName: identity.displayName.trim(),
                serverId: server.id,
            })
        );
    };

    return (
        <>
            <div className="px-5 py-6 sm:px-7">
                <div className="mb-8 flex min-w-0 items-center gap-4">
                    <Badge.Anchor>
                        <EntityAvatar name={agent.displayName} size="lg" src={agent.avatarUrl} />
                        <Badge
                            color={hostedAvailabilityBadgeColor(agent.availability)}
                            placement="bottom-right"
                            size="sm"
                        />
                    </Badge.Anchor>
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                            <h1 className="min-w-0 truncate font-semibold text-foreground text-xl">
                                {agent.displayName}
                            </h1>
                            <span className="flex shrink-0 items-center gap-1.5 text-muted text-sm">
                                <StatusDot status={hostedAvailabilityStatus(agent.availability)} />
                                <span className="capitalize">{agent.availability}</span>
                            </span>
                        </div>
                        <p className="truncate text-muted text-sm">@{agent.handle}</p>
                    </div>
                </div>
                <SettingsPage>
                    <SettingsSection title="Profile">
                        <SettingsGroup>
                            <SettingsRow
                                description="Shown beside this Agent's messages."
                                error={avatarError ?? setAvatar.error?.message ?? null}
                                title="Photo"
                                trailingWidth="intrinsic"
                            >
                                <div className="flex items-center md:justify-end">
                                    <AvatarPicker
                                        isDisabled={!canEdit || setAvatar.isPending}
                                        label="Agent photo"
                                        name={agent.displayName}
                                        onError={setAvatarError}
                                        onSelect={async (image) => {
                                            await setAvatar.mutateAsync({
                                                bytesBase64: image.base64,
                                                mediaType: image.mediaType,
                                                serverId: server.id,
                                                target: { agentId: agent.id, kind: 'agent' },
                                            });
                                        }}
                                        src={agent.avatarUrl}
                                    />
                                </div>
                            </SettingsRow>
                            <Separator />
                            <SettingsRow title="Name">
                                <InlineEditField
                                    ariaLabel="Agent name"
                                    isDisabled={!canEdit || updateProfile.isPending}
                                    isRequired
                                    maxLength={80}
                                    onCommit={(displayName) =>
                                        saveIdentity({
                                            description: agent.description ?? '',
                                            displayName,
                                        })
                                    }
                                    placeholder="Agent name"
                                    value={agent.displayName}
                                />
                            </SettingsRow>
                            <Separator />
                            <SettingsRow title="Description" trailingWidth="wide">
                                <InlineEditField
                                    ariaLabel="Agent description"
                                    isDisabled={!canEdit || updateProfile.isPending}
                                    maxLength={500}
                                    multiline
                                    onCommit={(description) =>
                                        saveIdentity({
                                            description,
                                            displayName: agent.displayName,
                                        })
                                    }
                                    placeholder="No description yet."
                                    value={agent.description ?? ''}
                                />
                            </SettingsRow>
                        </SettingsGroup>
                    </SettingsSection>

                    <SettingsSection
                        action={
                            canEdit ? (
                                <Button
                                    onPress={() => setRuntimeConfigOpen(true)}
                                    size="sm"
                                    variant="secondary"
                                >
                                    Edit
                                </Button>
                            ) : null
                        }
                        title="Model"
                    >
                        <SettingsGroup>
                            <SettingsChipRow>
                                <SettingsChipField
                                    color={execution.model ? 'accent' : 'warning'}
                                    label="Model"
                                    value={
                                        execution.model
                                            ? execution.modelLabel
                                            : `${execution.modelLabel} · not installed`
                                    }
                                />
                                <SettingsChipField
                                    color={execution.runtime ? 'default' : 'warning'}
                                    label="Runtime"
                                    value={
                                        execution.runtime
                                            ? execution.runtimeLabel
                                            : `${execution.runtimeLabel} · not installed`
                                    }
                                />
                                {/* 'Current' is the quiet default; only a config
                                    that has not landed yet is worth a chip. */}
                                {agent.status === 'applied' ? null : (
                                    <SettingsChipField
                                        color={agent.status === 'degraded' ? 'danger' : 'warning'}
                                        label="Status"
                                        value={runtimeConfigStatusLabel(agent, computer?.health)}
                                    />
                                )}
                            </SettingsChipRow>
                        </SettingsGroup>
                    </SettingsSection>

                    <SettingsSection title="Info">
                        <SettingsGroup>
                            <SettingsChipRow>
                                <SettingsChipField
                                    label="Role"
                                    value={<span className="capitalize">{agent.role}</span>}
                                />
                                <SettingsChipField
                                    color={computer ? 'default' : 'warning'}
                                    label="Computer"
                                    value={
                                        computer ? (
                                            <Link
                                                className="hover:underline"
                                                to={`${serverComputersRoute(server.slug)}?computer=${encodeURIComponent(computer.id)}`}
                                            >
                                                {computerLabel(computer)} ·{' '}
                                                {computerHealthLabel(computer.health)}
                                            </Link>
                                        ) : (
                                            'Unavailable'
                                        )
                                    }
                                />
                                <SettingsChipField
                                    label="Created"
                                    value={formatDate(agent.createdAt)}
                                />
                            </SettingsChipRow>
                        </SettingsGroup>
                    </SettingsSection>

                    <HostedAgentChatsSection agent={agent} server={server} />

                    <HostedAgentTools
                        agent={agent}
                        connections={connections.data ?? []}
                        serverId={server.id}
                    />

                    <HostedAgentSkillsSection
                        addableSkills={selectAddableHostedSkills(skillSources, agentSkills)}
                        canEdit={canEdit}
                        importError={importSkill.error?.message ?? null}
                        importPending={importSkill.isPending}
                        imports={selectOutstandingSkillImports(
                            computer?.reportedInventory?.agentSkillImports ?? [],
                            agent.id
                        )}
                        onImport={(sourceId) =>
                            importSkill.mutate({ agentId: agent.id, serverId: server.id, sourceId })
                        }
                        onSelectSkill={setSelectedSkill}
                        skillSources={skillSources}
                        skills={agentSkills}
                    />
                    {canEdit ? <HostedAgentSessionSection agent={agent} server={server} /> : null}
                    <HostedAgentDangerSection agent={agent} onDeleted={onDeleted} server={server} />
                </SettingsPage>
            </div>
            <AgentSkillFileDialog
                agent={agent}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedSkill(null);
                    }
                }}
                server={server}
                skill={selectedSkill}
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

export function selectOutstandingSkillImports(
    records: HostedAgentSkillImportRecord[],
    agentId: string
) {
    const latestBySource = new Map<string, HostedAgentSkillImportRecord>();
    for (const record of records) {
        if (record.agentId !== agentId || latestBySource.has(record.sourceId)) {
            continue;
        }
        latestBySource.set(record.sourceId, record);
    }
    return [...latestBySource.values()].filter((record) => record.status !== 'applied');
}
