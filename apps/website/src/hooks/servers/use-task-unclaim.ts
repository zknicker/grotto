import { hausTrpc } from '../../lib/haus-server.tsx';
import { replaceTask } from './task-cache.ts';

export function useTaskUnclaim() {
    const utils = hausTrpc.useUtils();
    return hausTrpc.task.unclaim.useMutation({
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
