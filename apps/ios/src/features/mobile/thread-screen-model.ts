import type { ThreadSummary } from '@tavern/api';

export function resolveThreadChatId(input: {
    anchorMessageId: string | undefined;
    createdThreadChatId: string | undefined;
    routeThreadChatId: string | undefined;
    threads: readonly ThreadSummary[];
}) {
    return (
        input.routeThreadChatId ??
        input.createdThreadChatId ??
        input.threads.find((thread) => thread.anchorMessageId === input.anchorMessageId)
            ?.threadChatId
    );
}
