import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { replaceHostedTask } from './server-task-cache.ts';

export function useUnclaimServerTask() {
    const utils = grottoTrpc.useUtils();
    return grottoTrpc.task.unclaim.useMutation({
        onSuccess: ({ task }, input) => {
            utils.task.list.setData({ serverId: input.serverId }, (items) =>
                replaceHostedTask(items, task)
            );
        },
    });
}
