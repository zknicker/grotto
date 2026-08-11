import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import type { ChatEventInvalidation } from './chat-event-invalidation.ts';
import { useChatEvent } from './use-chat-event-stream.tsx';

/**
 * Task rows embed their label records, so a catalog edit changes both the
 * label catalog and every task read.
 */
export function useTaskLabelEvents() {
    const utils = grottoTrpc.useUtils();

    useChatEvent('task.label.updated', async (_events, serverId) => {
        await invalidateTaskLabelChanges({ serverId, utils });
    });
}

export async function invalidateTaskLabelChanges({
    serverId,
    utils,
}: Pick<ChatEventInvalidation<'task.label.updated'>, 'serverId' | 'utils'>) {
    await Promise.all([
        utils.task.list.invalidate({ serverId }, { refetchType: 'all' }),
        utils.taskLabel.list.invalidate({ serverId }, { refetchType: 'all' }),
    ]);
}
