import type { ServerDetail } from '../../lib/grotto-server.tsx';

export type CoveOnboardingView =
    | 'app'
    | 'connect-computer'
    | 'connect-failed'
    | 'detecting-runtimes'
    | 'meet-cove';

type ServerOnboarding = ServerDetail['onboarding'];

/** Server-owned progress is the only authority for entering the general App. */
export function getCoveOnboardingView(onboarding: ServerOnboarding): CoveOnboardingView {
    if (onboarding.phase === 'complete') {
        return 'app';
    }
    if (onboarding.phase === 'awaiting-cove') {
        return 'meet-cove';
    }
    if (onboarding.failure) {
        return 'connect-failed';
    }
    return onboarding.computerId ? 'detecting-runtimes' : 'connect-computer';
}
