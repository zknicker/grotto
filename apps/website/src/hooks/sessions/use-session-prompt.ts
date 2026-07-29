import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useSessionPrompt(
    input: { sessionKey: string | null },
    options?: { enabled?: boolean }
) {
    return trpc.session.prompt.get.useQuery(
        {
            sessionKey: input.sessionKey ?? '',
        },
        {
            ...queryPolicy.volatileState,
            ...options,
            enabled: Boolean(input.sessionKey) && (options?.enabled ?? true),
        }
    );
}
