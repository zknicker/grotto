import type { HostedAgentTurnSummary } from '@tavern/api';

type FailureKind = NonNullable<HostedAgentTurnSummary['failureKind']>;

export function shouldRetryFailure(kind: FailureKind | undefined): boolean {
    return !(kind && ['authentication', 'configuration', 'input'].includes(kind));
}
