import { Button, Chip, Separator } from '@heroui/react';
import type {
    HostedAgent,
    HostedAgentSkillImportRecord,
    HostedAgentSkillMetadata,
    HostedImportableSkill,
} from '@tavern/api';
import * as React from 'react';
import { Link } from 'react-router-dom';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { computerHealthLabel } from '../../computers/computer-detail.tsx';
import { computerLabel } from '../../computers/presentation.ts';
import { serverComputersRoute } from '../../servers/server-routes.ts';
import {
    SettingsGroup,
    SettingsPage,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../../settings/layout/settings-page.tsx';
import { AgentIdentityDialog } from './agent-identity-dialog.tsx';
import { AgentSkillFileDialog } from './agent-skill-file-dialog.tsx';
import { HostedAgentDangerSection } from './hosted-agent-danger-section.tsx';
import { HostedAgentActions } from './hosted-agent-profile-header.tsx';
import { HostedAgentSessionSection } from './hosted-agent-session-section.tsx';
import { HostedAgentSkillsSection } from './hosted-agent-skills-section.tsx';
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

    return (
        <>
            <div className="px-5 py-6 sm:px-7">
                <div className="pb-6">
                    <HostedAgentActions agent={agent} server={server} />
                </div>
                <SettingsPage>
                    <SettingsSection
                        action={
                            canEdit ? (
                                <Button
                                    onPress={() => setIdentityOpen(true)}
                                    size="sm"
                                    variant="secondary"
                                >
                                    Edit
                                </Button>
                            ) : null
                        }
                        title="Profile"
                    >
                        <SettingsGroup>
                            <SettingsRow title="Name">
                                <SettingsValue>{agent.displayName}</SettingsValue>
                            </SettingsRow>
                            <Separator />
                            <SettingsRow title="Description">
                                <SettingsValue>
                                    {agent.description ?? 'No description yet.'}
                                </SettingsValue>
                            </SettingsRow>
                        </SettingsGroup>
                    </SettingsSection>

                    <SettingsSection title="Info">
                        <SettingsGroup>
                            <SettingsRow title="Handle">
                                <SettingsValue>@{agent.handle}</SettingsValue>
                            </SettingsRow>
                            <Separator />
                            <SettingsRow title="Role">
                                <SettingsValue className="capitalize">{agent.role}</SettingsValue>
                            </SettingsRow>
                            <Separator />
                            <SettingsRow title="Computer">
                                <SettingsValue>
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
                                </SettingsValue>
                            </SettingsRow>
                            <Separator />
                            <SettingsRow title="Created">
                                <SettingsValue>{formatDate(agent.createdAt)}</SettingsValue>
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
                        title="Runtime Config"
                    >
                        <SettingsGroup>
                            <ConfigRow
                                available={Boolean(execution.runtime)}
                                title="Runtime"
                                value={execution.runtimeLabel}
                            />
                            <Separator />
                            <ConfigRow
                                available={Boolean(execution.model)}
                                title="Model"
                                value={execution.modelLabel}
                            />
                            <Separator />
                            <SettingsRow
                                description={
                                    agent.status === 'degraded'
                                        ? 'Choose an installed runtime and model to restore this Agent.'
                                        : undefined
                                }
                                title="Status"
                            >
                                <SettingsValue>
                                    {runtimeConfigStatusLabel(agent, computer?.health)}
                                </SettingsValue>
                            </SettingsRow>
                        </SettingsGroup>
                    </SettingsSection>

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

function ConfigRow({
    available,
    title,
    value,
}: {
    available: boolean;
    title: string;
    value: string;
}) {
    return (
        <SettingsRow title={title}>
            <SettingsValue>
                <span className="flex flex-wrap items-center gap-2">
                    {value}
                    {available ? null : (
                        <Chip color="warning" size="sm" variant="soft">
                            Not installed
                        </Chip>
                    )}
                </span>
            </SettingsValue>
        </SettingsRow>
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
