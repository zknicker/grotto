import type { AgentTurnSummary } from '@tavern/api';

type FailureKind = NonNullable<AgentTurnSummary['failureKind']>;

export function shouldRetryFailure(kind: FailureKind | undefined): boolean {
    return !(kind && ['authentication', 'configuration', 'input'].includes(kind));
}
