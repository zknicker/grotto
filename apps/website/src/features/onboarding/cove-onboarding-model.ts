import type { ServerDetail } from '../../lib/grotto-server.tsx';

export type CoveOnboardingView =
    | 'app'
    | 'connect-computer'
    | 'connect-failed'
    | 'detecting-runtimes'
    | 'meet-cove'
    | 'applying-cove'
    | 'apply-failed';

type ServerOnboarding = ServerDetail['onboarding'];

/** Server-owned progress is the only authority for entering the general App. */
export function getCoveOnboardingView(onboarding: ServerOnboarding): CoveOnboardingView {
    if (onboarding.phase === 'complete') {
        return 'app';
    }
    if (onboarding.phase === 'awaiting-cove') {
        return 'meet-cove';
    }
    if (onboarding.phase === 'applying') {
        return onboarding.failure ? 'apply-failed' : 'applying-cove';
    }
    if (onboarding.failure) {
        return 'connect-failed';
    }
    return onboarding.computerId ? 'detecting-runtimes' : 'connect-computer';
}

/** Human repair copy deliberately hides factory, seed, command, and acknowledgement detail. */
export function getCoveRepairMessage(
    failure: NonNullable<ServerOnboarding['failure']> | null
): string {
    if (failure?.code === 'computer-disconnected') {
        return 'Reconnect this Computer, then try again.';
    }
    if (failure?.code === 'computer-incompatible') {
        return 'Update Grotto Computer, reconnect it, then try again.';
    }
    if (failure?.code === 'inventory-empty' || failure?.code === 'inventory-invalid') {
        return 'Reconnect a Computer with an available runtime and model, then try again.';
    }
    return 'Cove isn’t ready yet. Make sure this Computer is connected, then try again.';
}
