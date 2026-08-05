import { Button } from '@heroui/react';
import type { HostedAgent, HostedComputerInventory } from '@tavern/api';
import * as React from 'react';
import { useAgentRuntime } from '../../../hooks/members/use-agent-runtime.ts';
import {
    SettingsChipField,
    SettingsChipRow,
    SettingsGroup,
    SettingsSection,
} from '../../settings/layout/settings-page.tsx';
import { RuntimeDialog } from './runtime-dialog.tsx';
import { resolveRuntimeConfig, runtimeConfigStatusLabel } from './runtime-model.ts';

type Runtime = HostedComputerInventory['runtimes'][number];
type ComputerHealth = Parameters<typeof runtimeConfigStatusLabel>[1];

export function AgentRuntime({
    agent,
    canEdit,
    computerHealth,
    runtimes,
    serverId,
}: {
    agent: HostedAgent;
    canEdit: boolean;
    computerHealth: ComputerHealth;
    runtimes: Runtime[];
    serverId: string;
}) {
    const [open, setOpen] = React.useState(false);
    const configure = useAgentRuntime(serverId, agent.id);
    const execution = resolveRuntimeConfig(agent, runtimes);

    return (
        <>
            <SettingsSection
                action={
                    canEdit ? (
                        <Button onPress={() => setOpen(true)} size="sm" variant="secondary">
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
                        {agent.status === 'applied' ? null : (
                            <SettingsChipField
                                color={agent.status === 'degraded' ? 'danger' : 'warning'}
                                label="Status"
                                value={runtimeConfigStatusLabel(agent, computerHealth)}
                            />
                        )}
                    </SettingsChipRow>
                </SettingsGroup>
            </SettingsSection>
            <RuntimeDialog
                agent={agent}
                error={configure.error?.message ?? null}
                onOpenChange={setOpen}
                onSave={async (draft) => {
                    await configure.save(draft);
                    setOpen(false);
                }}
                open={open}
                pending={configure.isPending}
                runtimes={runtimes}
            />
        </>
    );
}
