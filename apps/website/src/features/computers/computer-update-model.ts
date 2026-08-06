import type { ComputerUpdatePhase } from '@tavern/api';

const phaseLabels = {
    available: 'Update available',
    checking: 'Checking production release…',
    complete: 'Update complete',
    downloading: 'Downloading Grotto Computer',
    failed: 'Update failed',
    idle: 'Not checked',
    installing: 'Installing update',
    requested: 'Download requested',
    restarting: 'Restarting Grotto Computer',
    verifying: 'Verifying signature and integrity',
    'waiting-for-agents': 'Waiting for active Agents…',
} as const satisfies Record<ComputerUpdatePhase, string>;

export function computerUpdateView(input: {
    health: 'degraded' | 'healthy' | 'offline' | 'update-required';
    isChecking?: boolean;
    phase: ComputerUpdatePhase;
    targetVersion?: string | null;
}) {
    const connected = input.health !== 'offline';
    const busy =
        input.isChecking ||
        [
            'checking',
            'requested',
            'downloading',
            'verifying',
            'installing',
            'waiting-for-agents',
            'restarting',
        ].includes(input.phase);
    return {
        canCheck: connected && !busy,
        canUpdate: connected && input.phase === 'available' && !busy,
        label: input.isChecking
            ? phaseLabels.checking
            : input.phase === 'idle' && input.targetVersion
              ? 'Up to date'
              : phaseLabels[input.phase],
        needsLocalRecovery:
            input.health === 'update-required' ||
            (input.health === 'offline' && input.phase !== 'restarting'),
    };
}
