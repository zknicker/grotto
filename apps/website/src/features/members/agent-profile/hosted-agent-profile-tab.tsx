import type { HostedAgent, HostedAgentSkillMetadata, HostedImportableSkill } from '@tavern/api';
import * as React from 'react';
import { Badge } from '../../../components/ui/badge.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../../../components/ui/settings-row.tsx';
import { Textarea } from '../../../components/ui/textarea.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { PickerPopover } from '../../agents/picker-popover.tsx';
import { formatSkillName } from '../../skills/skill-name-format.ts';

const selectClass =
    'h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground disabled:opacity-50';

export function HostedAgentProfileTab({
    agent,
    server,
}: {
    agent: HostedAgent;
    server: ServerDetail;
}) {
    const utils = grottoTrpc.useUtils();
    const computers = grottoTrpc.computer.list.useQuery({ serverId: server.id });
    const updateProfile = grottoTrpc.agent.updateProfile.useMutation({
        onSuccess: () => utils.agent.list.invalidate({ serverId: server.id }),
    });
    const configure = grottoTrpc.agent.configure.useMutation({
        onSuccess: () => utils.agent.list.invalidate({ serverId: server.id }),
    });
    const [displayName, setDisplayName] = React.useState(agent.displayName);
    const [description, setDescription] = React.useState(agent.description ?? '');
    const computer = computers.data?.find((candidate) => candidate.id === agent.computerId);
    const runtimes = computer?.reportedInventory?.runtimes ?? [];
    const selectedRuntime =
        runtimes.find((runtime) => runtime.id === agent.desiredRuntimeId) ?? runtimes[0];
    const selectedModel =
        selectedRuntime?.models.find((model) => model.id === agent.desiredModelId) ??
        selectedRuntime?.models[0];
    const agentSkills =
        computer?.reportedInventory?.agentSkills?.find((entry) => entry.agentId === agent.id)
            ?.skills ?? [];
    const importableSkills = selectAddableHostedSkills(
        computer?.reportedInventory?.importableSkills ?? [],
        agentSkills
    );
    const canEdit = server.role === 'owner' || server.role === 'admin';
    const importSkill = grottoTrpc.agent.importSkill.useMutation();

    React.useEffect(() => setDisplayName(agent.displayName), [agent.displayName]);
    React.useEffect(() => setDescription(agent.description ?? ''), [agent.description]);

    const saveIdentity = () => {
        const nextName = displayName.trim();
        const nextDescription = description.trim() || null;
        if (
            !(canEdit && nextName) ||
            (nextName === agent.displayName && nextDescription === agent.description)
        ) {
            return;
        }
        void withSavingToast(() =>
            updateProfile.mutateAsync({
                agentId: agent.id,
                description: nextDescription,
                displayName: nextName,
                serverId: server.id,
            })
        ).catch(() => undefined);
    };

    return (
        <div className="mx-auto grid w-full max-w-3xl gap-9 py-6">
            <SettingsSection title="Identity">
                <SettingsGroup>
                    <SettingsRow title="Display name">
                        <Input
                            disabled={!canEdit || updateProfile.isPending}
                            onBlur={saveIdentity}
                            onChange={(event) => setDisplayName(event.currentTarget.value)}
                            value={displayName}
                        />
                    </SettingsRow>
                    <Separator />
                    <SettingsRow
                        description="A short job description visible to people and other Agents."
                        title="Description"
                    >
                        <Textarea
                            disabled={!canEdit || updateProfile.isPending}
                            maxLength={500}
                            onBlur={saveIdentity}
                            onChange={(event) => setDescription(event.currentTarget.value)}
                            rows={2}
                            value={description}
                        />
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
                            {computer?.operatingSystem ?? agent.computerId}
                            {computer ? ` · ${computer.health}` : ''}
                        </SettingsValue>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Created">
                        <SettingsValue>
                            {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                                new Date(agent.createdAt)
                            )}
                        </SettingsValue>
                    </SettingsRow>
                </SettingsGroup>
            </SettingsSection>

            <SettingsSection title="Runtime config">
                <SettingsGroup>
                    <SettingsRow title="Runtime">
                        <select
                            className={selectClass}
                            disabled={!canEdit || configure.isPending}
                            onChange={(event) => {
                                const runtime = runtimes.find(
                                    (candidate) => candidate.id === event.currentTarget.value
                                );
                                const model = runtime?.models[0];
                                if (!(runtime && model)) {
                                    return;
                                }
                                configure.mutate({
                                    agentId: agent.id,
                                    modelId: model.id,
                                    runtimeId: runtime.id,
                                    serverId: server.id,
                                });
                            }}
                            value={selectedRuntime?.id ?? ''}
                        >
                            {runtimes.map((runtime) => (
                                <option key={runtime.id} value={runtime.id}>
                                    {runtime.label}
                                </option>
                            ))}
                        </select>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Model">
                        <select
                            className={selectClass}
                            disabled={!canEdit || configure.isPending || !selectedRuntime}
                            onChange={(event) =>
                                selectedRuntime &&
                                configure.mutate({
                                    agentId: agent.id,
                                    modelId: event.currentTarget.value,
                                    runtimeId: selectedRuntime.id,
                                    serverId: server.id,
                                })
                            }
                            value={selectedModel?.id ?? ''}
                        >
                            {selectedRuntime?.models.map((model) => (
                                <option key={model.id} value={model.id}>
                                    {model.label}
                                </option>
                            ))}
                        </select>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Effective">
                        <SettingsValue>
                            {agent.effectiveRuntimeId && agent.effectiveModelId
                                ? `${agent.effectiveRuntimeId} · ${agent.effectiveModelId}`
                                : 'Waiting for Computer'}
                        </SettingsValue>
                    </SettingsRow>
                </SettingsGroup>
            </SettingsSection>

            <SettingsSection
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
                title={
                    <span className="flex items-center gap-2">
                        Skills
                        <Badge size="sm" variant="subtle">
                            {agentSkills.length}
                        </Badge>
                    </span>
                }
            >
                <SettingsGroup>
                    {agentSkills.length > 0 ? (
                        agentSkills.map((skill, index) => (
                            <React.Fragment key={skill.name}>
                                {index > 0 ? <Separator /> : null}
                                <SettingsRow description={skill.description} title={skill.name}>
                                    <SettingsValue>
                                        Updated{' '}
                                        {new Intl.DateTimeFormat(undefined, {
                                            dateStyle: 'medium',
                                        }).format(new Date(skill.modifiedAt))}
                                    </SettingsValue>
                                </SettingsRow>
                            </React.Fragment>
                        ))
                    ) : (
                        <p className="px-4 py-3 text-muted-foreground text-sm">No skills yet.</p>
                    )}
                    {importSkill.error ? (
                        <p className="px-4 py-3 text-error text-sm">{importSkill.error.message}</p>
                    ) : null}
                </SettingsGroup>
            </SettingsSection>
        </div>
    );
}

export function selectAddableHostedSkills(
    sources: HostedImportableSkill[],
    owned: HostedAgentSkillMetadata[]
) {
    const ownedNames = new Set(owned.map((skill) => skill.name));
    return sources.filter((source) => !ownedNames.has(source.name));
}
