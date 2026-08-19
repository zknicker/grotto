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

const updateInFlightPhases: ComputerUpdatePhase[] = [
    'requested',
    'downloading',
    'verifying',
    'installing',
    'waiting-for-agents',
    'restarting',
];

export function computerUpdateView(input: {
    health: 'degraded' | 'healthy' | 'offline' | 'update-required';
    isChecking?: boolean;
    phase: ComputerUpdatePhase;
    targetVersion?: string | null;
}) {
    const connected = input.health !== 'offline';
    const updateInFlight = updateInFlightPhases.includes(input.phase);
    const busy = input.isChecking || input.phase === 'checking' || updateInFlight;
    return {
        canCheck: connected && !busy,
        canUpdate: connected && input.phase === 'available' && !busy,
        // An idle offline Computer can neither check nor install, so the card has
        // no control to show and says why instead of rendering an empty slot. An
        // update already in flight keeps reporting its phase: restarting drops the
        // connection by design, and the progress must survive that.
        label:
            connected || updateInFlight
                ? input.isChecking
                    ? phaseLabels.checking
                    : input.phase === 'idle' && input.targetVersion
                      ? 'Up to date'
                      : phaseLabels[input.phase]
                : 'Unavailable while offline',
        needsLocalRecovery:
            input.health === 'update-required' ||
            (input.health === 'offline' && input.phase !== 'restarting'),
    };
}
