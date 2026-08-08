import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
    seedAgentWorkspace,
    seedCoveWorkspace,
    seedFactoryManagedSkills,
    validateCoveWorkspace,
} from '@tavern/agent-workspace';
import {
    type HostedAgentConfigureCommand,
    type HostedComputerInventory,
    type HostedCoveApplyCommand,
    type HostedCoveApplyResult,
    hostedAgentConfigureCommandSchema,
    hostedCoveApplyCommandSchema,
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
export function parseCoveApplyCommand(frame: unknown): HostedCoveApplyCommand | null {
    const parsed = hostedCoveApplyCommandSchema.safeParse(frame);
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
export async function applyCoveConfiguration(input: {
    command: HostedCoveApplyCommand;
    dataRoot: string;
    inventory: HostedComputerInventory;
    serverId: string;
}): Promise<HostedCoveApplyResult> {
    const { command } = input;
    try {
        const applied = resolveConfiguration(command, input.inventory);
        if (applied.missingResources.length > 0) {
            throw new Error(
                `Cove configuration is unavailable: ${applied.missingResources.join(', ')}`
            );
        }
        const agentRoot = await ensureAgentRoot(input.dataRoot, input.serverId, command.agentId);
        const receiptPath = join(agentRoot, 'cove-application.json');
        await seedFactoryManagedSkills(join(agentRoot, 'skills'));
        const existing = await readCoveReceipt(receiptPath);
        if (existing) {
            assertMatchingCoveReceipt(existing, command);
            const manifestSha256 = await validateCoveWorkspace(join(agentRoot, 'workspace'));
            if (manifestSha256 !== existing.manifestSha256) {
                throw new Error('Cove workspace no longer matches its durable factory receipt.');
            }
            await assertMatchingCoveConfiguration(agentRoot, command);
        } else {
            const manifestSha256 = await seedCoveWorkspace(join(agentRoot, 'workspace'));
            await writeJsonAtomic(join(agentRoot, 'configuration.json'), {
                ...applied,
                seed: {
                    agentDescription: command.agentDescription,
                    agentName: command.agentName,
                    factoryKind: command.factoryKind,
                },
            });
            await writeJsonAtomic(receiptPath, {
                agentId: command.agentId,
                applicationId: command.applicationId,
                factoryKind: command.factoryKind,
                manifestSha256,
                modelId: command.modelId,
                runtimeId: command.runtimeId,
            });
        }
        return {
            agentId: command.agentId,
            applicationId: command.applicationId,
            factoryKind: 'cove',
            status: 'applied',
            type: 'cove-apply-result',
        };
    } catch (error) {
        return {
            agentId: command.agentId,
            applicationId: command.applicationId,
            error: safeCoveError(error),
            factoryKind: 'cove',
            status: 'failed',
            type: 'cove-apply-result',
        };
    }
}
async function assertMatchingCoveConfiguration(agentRoot: string, command: HostedCoveApplyCommand) {
    const configuration = await readAppliedAgentConfiguration(agentRoot);
    const seed = await readAgentSeedConfiguration(agentRoot);
    if (
        configuration?.runtimeId !== command.runtimeId ||
        configuration.modelId !== command.modelId ||
        configuration.missingResources.length > 0 ||
        seed?.agentName !== command.agentName ||
        seed.agentDescription !== command.agentDescription
    ) {
        throw new Error('Cove configuration no longer matches its durable factory receipt.');
    }
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
    command: HostedAgentConfigureCommand | HostedCoveApplyCommand,
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

interface CoveReceipt {
    agentId: string;
    applicationId: string;
    factoryKind: 'cove';
    manifestSha256: string;
    modelId: string;
    runtimeId: string;
}

async function ensureAgentRoot(dataRoot: string, serverId: string, agentId: string) {
    const agentRoot = join(dataRoot, 'servers', serverId, 'agents', agentId);
    await mkdir(agentRoot, { mode: 0o700, recursive: true });
    await Promise.all(
        ['home', 'runtime', 'skills', 'workspace'].map((directory) =>
            mkdir(join(agentRoot, directory), { mode: 0o700, recursive: true })
        )
    );
    return agentRoot;
}

async function writeJsonAtomic(destination: string, value: unknown) {
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 });
    await rename(temporary, destination);
}

async function readCoveReceipt(path: string): Promise<CoveReceipt | null> {
    try {
        const value = JSON.parse(await readFile(path, 'utf8')) as CoveReceipt;
        if (value?.factoryKind !== 'cove') {
            throw new Error('The durable Cove factory receipt is invalid.');
        }
        return value;
    } catch (error) {
        if (isMissingFile(error)) {
            return null;
        }
        throw new Error('The durable Cove factory receipt is invalid.', { cause: error });
    }
}

function isMissingFile(error: unknown): boolean {
    return (
        typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
    );
}

function assertMatchingCoveReceipt(receipt: CoveReceipt, command: HostedCoveApplyCommand) {
    if (
        receipt.agentId !== command.agentId ||
        receipt.applicationId !== command.applicationId ||
        receipt.runtimeId !== command.runtimeId ||
        receipt.modelId !== command.modelId
    ) {
        throw new Error('A conflicting Cove factory application is already durable.');
    }
}

function safeCoveError(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Cove application failed.';
    return message.slice(0, 300);
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
