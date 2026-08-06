import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { replaceTask } from './task-cache.ts';

export function useTaskUnclaim() {
    const utils = grottoTrpc.useUtils();
    return grottoTrpc.task.unclaim.useMutation({
        onSuccess: ({ task }, input) => {
            utils.task.list.setData({ serverId: input.serverId }, (items) =>
                replaceTask(items, task)
            );
            utils.task.list.setData({ chatId: task.chatId, serverId: input.serverId }, (items) =>
                replaceTask(items, task)
            );
        },
    });
}
