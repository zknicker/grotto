import type { HostedAgent, HostedComputerInventory } from '@tavern/api';
import { hostedComputerRuntimeCatalog } from '@tavern/api/hosted-computer-runtime';

export interface ComputerPresentation {
    architecture: string | null;
    id: string;
    name: string | null;
    operatingSystem: string | null;
}

export type ComputerRuntimePresentation = HostedComputerInventory['runtimes'][number] & {
    detected: boolean;
};

export function computerLabel(computer: ComputerPresentation) {
    return (
        computer.name?.trim() ||
        `${operatingSystemLabel(computer.operatingSystem) ?? ''} Computer`.trim()
    );
}

export function computerSystemLabel(computer: ComputerPresentation) {
    return (
        [operatingSystemLabel(computer.operatingSystem), architectureLabel(computer.architecture)]
            .filter(Boolean)
            .join(' · ') || 'Awaiting first report'
    );
}

export function agentExecutionLabels(
    agent: Pick<HostedAgent, 'desiredModelId' | 'desiredRuntimeId'>,
    inventory: HostedComputerInventory | null
) {
    const runtime = inventory?.runtimes?.find(
        (candidate) => candidate.id === agent.desiredRuntimeId
    );
    const model = runtime?.models.find((candidate) => candidate.id === agent.desiredModelId);
    return {
        model: model?.label ?? agent.desiredModelId,
        modelAvailable: Boolean(model),
        runtime: runtime?.label ?? agent.desiredRuntimeId,
        runtimeAvailable: Boolean(runtime),
    };
}

export function computerRuntimePresentations(
    inventory: HostedComputerInventory | null
): ComputerRuntimePresentation[] {
    const detectedRuntimes = new Map(
        inventory?.runtimes?.map((runtime) => [runtime.id, runtime] as const) ?? []
    );
    const supportedRuntimes = hostedComputerRuntimeCatalog.map((runtime) => {
        const detectedRuntime = detectedRuntimes.get(runtime.id);
        detectedRuntimes.delete(runtime.id);
        return {
            ...(detectedRuntime ?? runtime),
            detected: Boolean(detectedRuntime),
            models: detectedRuntime?.models ?? [],
        };
    });

    return [
        ...supportedRuntimes,
        ...Array.from(detectedRuntimes.values(), (runtime) => ({
            ...runtime,
            detected: true,
        })),
    ];
}

export function availabilityLabel(value: HostedAgent['availability']) {
    switch (value) {
        case 'idle':
            return 'Online';
        case 'working':
            return 'Working';
        case 'error':
            return 'Needs attention';
        case 'stopped':
            return 'Stopped';
        case 'offline':
            return 'Offline';
    }
}

export function computerHealthLabel(
    health: 'degraded' | 'healthy' | 'offline' | 'update-required'
) {
    switch (health) {
        case 'healthy':
            return 'Online';
        case 'offline':
            return 'Offline';
        case 'update-required':
            return 'Update required';
        case 'degraded':
            return 'Needs attention';
    }
}

export function computerHealthColor(
    health: 'degraded' | 'healthy' | 'offline' | 'update-required'
) {
    return health === 'healthy'
        ? ('success' as const)
        : health === 'offline'
          ? ('default' as const)
          : ('warning' as const);
}

function operatingSystemLabel(value: string | null) {
    switch (value?.toLowerCase()) {
        case 'darwin':
            return 'Mac';
        case 'linux':
            return 'Linux';
        case 'win32':
        case 'windows':
            return 'Windows';
        default:
            return value;
    }
}

function architectureLabel(value: string | null) {
    switch (value?.toLowerCase()) {
        case 'arm64':
            return 'Apple Silicon';
        case 'x64':
        case 'x86_64':
            return 'Intel';
        default:
            return value;
    }
}
