import * as React from 'react';
import { selectNeedsYouCount } from '../../features/servers/inbox/needs-you-count.ts';
import { useMembers } from './use-members.ts';
import { useOpenAsks } from './use-open-asks.ts';
import { useTasks } from './use-tasks.ts';

/**
 * How much work is waiting on this human right now, for surfaces that badge the
 * Inbox instead of opening it.
 *
 * It reads the same three queries the Inbox section itself reads — the viewer's
 * open Asks, the default Task lens, and the member directory that names the
 * viewer — so the badge costs nothing extra once the Inbox has been visited and
 * never drifts from what the section lists.
 *
 * `isReady` is the whole claim settling at once: a badge that counts Asks now
 * and Tasks a moment later would tick upward in front of the reader.
 */
export function useInboxNeedsYouCount(serverId: string | undefined): {
    count: number;
    isReady: boolean;
} {
    const asks = useOpenAsks(serverId);
    const tasks = useTasks(serverId);
    const members = useMembers(serverId);
    const askCount = asks.data?.length ?? 0;
    const taskItems = tasks.data?.tasks;
    const viewerUserId = members.data?.viewerUserId ?? null;
    const isReady = Boolean(asks.data && tasks.data && members.data);
    const count = React.useMemo(
        () =>
            selectNeedsYouCount({
                askCount,
                tasks: (taskItems ?? []).map((item) => item.task),
                viewerUserId,
            }),
        [askCount, taskItems, viewerUserId]
    );

    return { count: isReady ? count : 0, isReady };
}
