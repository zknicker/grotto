import { grottoTrpc, type ServerDetail } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

const incompleteOnboardingRefetchMs = 1000;

/** One Grotto server opened at its human-facing address, with its Channels. */
export function useServer(slug: string, enabled = true) {
    return grottoTrpc.server.bySlug.useQuery(
        { slug },
        {
            ...queryPolicy.syncedSnapshot,
            enabled,
            refetchInterval: (query) => serverReconciliationInterval(query.state.data),
        }
    );
}

/** Durable fallback when an onboarding transition's realtime invalidation is missed. */
export function serverReconciliationInterval(
    server:
        | {
              onboarding: { phase: ServerDetail['onboarding']['phase'] };
          }
        | undefined
): number | false {
    return server && server.onboarding.phase !== 'complete' ? incompleteOnboardingRefetchMs : false;
}
