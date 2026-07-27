import type { ComputerUpdatePhase } from '@tavern/api';

const phaseLabels = {
    available: 'Update available',
    checking: 'Checking production release…',
    complete: 'Update complete',
    failed: 'Update failed',
    idle: 'Not checked',
    installing: 'Installing signed release…',
    restarting: 'Restarting Computer…',
    'waiting-for-agents': 'Waiting for active Agents…',
} as const satisfies Record<ComputerUpdatePhase, string>;

export function computerUpdateView(input: {
    health: 'degraded' | 'healthy' | 'offline' | 'update-required';
    isChecking?: boolean;
    phase: ComputerUpdatePhase;
}) {
    const connected = input.health !== 'offline';
    const busy =
        input.isChecking ||
        ['checking', 'installing', 'waiting-for-agents', 'restarting'].includes(input.phase);
    return {
        canCheck: connected && !busy,
        canUpdate: connected && input.phase === 'available' && !busy,
        label: input.isChecking ? phaseLabels.checking : phaseLabels[input.phase],
        needsLocalRecovery: input.health === 'offline' || input.health === 'update-required',
    };
}
