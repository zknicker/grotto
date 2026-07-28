import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HostedAgentConfigureCommand, HostedComputerInventory } from '@tavern/api';

export interface AppliedAgentConfiguration {
    missingResources: string[];
    modelId: string | null;
    runtimeId: string | null;
}

export function parseAgentConfigureCommand(frame: unknown): HostedAgentConfigureCommand | null {
    if (
        !isRecord(frame) ||
        frame.type !== 'agent-configure' ||
        !isId(frame.agentId) ||
        typeof frame.modelId !== 'string' ||
        frame.modelId.length === 0 ||
        frame.modelId.length > 128 ||
        typeof frame.runtimeId !== 'string' ||
        frame.runtimeId.length === 0 ||
        frame.runtimeId.length > 64
    ) {
        return null;
    }
    return frame as unknown as HostedAgentConfigureCommand;
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
    const destination = join(agentRoot, 'configuration.json');
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(applied)}\n`, { mode: 0o600 });
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
        return isAppliedConfiguration(value) ? value : null;
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

function isId(value: unknown) {
    return typeof value === 'string' && /^[a-z]+_[A-Za-z0-9_-]{16}$/u.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
