import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { seedAgentWorkspace, seedFactoryManagedSkills } from '@tavern/agent-workspace';
import {
    type HostedAgentConfigureCommand,
    type HostedComputerInventory,
    hostedAgentConfigureCommandSchema,
} from '@tavern/api';

export interface AppliedAgentConfiguration {
    missingResources: string[];
    modelId: string | null;
    runtimeId: string | null;
}

export interface AgentSeedConfiguration {
    agentDescription: string | null;
    agentName: string;
}

export function parseAgentConfigureCommand(frame: unknown): HostedAgentConfigureCommand | null {
    const parsed = hostedAgentConfigureCommandSchema.safeParse(frame);
    return parsed.success ? parsed.data : null;
}

export async function applyAgentConfiguration(input: {
    command: HostedAgentConfigureCommand;
    dataRoot: string;
    inventory: HostedComputerInventory;
    serverId: string;
}): Promise<AppliedAgentConfiguration> {
    const applied = resolveConfiguration(input.command, input.inventory);
    const agentRoot = join(
        input.dataRoot,
        'servers',
        input.serverId,
        'agents',
        input.command.agentId
    );
    await mkdir(agentRoot, { mode: 0o700, recursive: true });
    await Promise.all(
        ['home', 'runtime', 'skills', 'workspace'].map((directory) =>
            mkdir(join(agentRoot, directory), { mode: 0o700, recursive: true })
        )
    );
    await seedAgentWorkspace({
        agentName: input.command.agentName,
        bio: input.command.agentDescription,
        workspaceDir: join(agentRoot, 'workspace'),
    });
    await seedFactoryManagedSkills(join(agentRoot, 'skills'));
    const destination = join(agentRoot, 'configuration.json');
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(
        temporary,
        `${JSON.stringify({
            ...applied,
            seed: {
                agentDescription: input.command.agentDescription,
                agentName: input.command.agentName,
            },
        })}\n`,
        { mode: 0o600 }
    );
    await rename(temporary, destination);
    return applied;
}

export async function readAppliedAgentConfiguration(
    agentRoot: string
): Promise<AppliedAgentConfiguration | null> {
    try {
        const value = JSON.parse(
            await readFile(join(agentRoot, 'configuration.json'), 'utf8')
        ) as unknown;
        return isAppliedConfiguration(value)
            ? {
                  missingResources: value.missingResources,
                  modelId: value.modelId,
                  runtimeId: value.runtimeId,
              }
            : null;
    } catch {
        return null;
    }
}

export async function readAgentSeedConfiguration(
    agentRoot: string
): Promise<AgentSeedConfiguration | null> {
    try {
        const value = JSON.parse(
            await readFile(join(agentRoot, 'configuration.json'), 'utf8')
        ) as unknown;
        return isRecord(value) && isAgentSeedConfiguration(value.seed) ? value.seed : null;
    } catch {
        return null;
    }
}

function resolveConfiguration(
    command: HostedAgentConfigureCommand,
    inventory: HostedComputerInventory
): AppliedAgentConfiguration {
    const runtime = inventory.runtimes.find((candidate) => candidate.id === command.runtimeId);
    if (!runtime) {
        return {
            missingResources: [`runtime:${command.runtimeId}`],
            modelId: null,
            runtimeId: null,
        };
    }
    if (!runtime.models.some((candidate) => candidate.id === command.modelId)) {
        return {
            missingResources: [`model:${command.modelId}`],
            modelId: null,
            runtimeId: runtime.id,
        };
    }
    return {
        missingResources: [],
        modelId: command.modelId,
        runtimeId: command.runtimeId,
    };
}

function isAppliedConfiguration(value: unknown): value is AppliedAgentConfiguration {
    return (
        isRecord(value) &&
        Array.isArray(value.missingResources) &&
        value.missingResources.every((item) => typeof item === 'string') &&
        (typeof value.modelId === 'string' || value.modelId === null) &&
        (typeof value.runtimeId === 'string' || value.runtimeId === null)
    );
}

function isAgentSeedConfiguration(value: unknown): value is AgentSeedConfiguration {
    return (
        isRecord(value) &&
        typeof value.agentName === 'string' &&
        value.agentName.length > 0 &&
        value.agentName.length <= 80 &&
        (value.agentDescription === null ||
            (typeof value.agentDescription === 'string' &&
                value.agentDescription.length > 0 &&
                value.agentDescription.length <= 500))
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
