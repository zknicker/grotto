import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { replaceHostedTask } from './server-task-cache.ts';

export function useAssignServerTask() {
    const utils = grottoTrpc.useUtils();
    return grottoTrpc.task.assign.useMutation({
        onSuccess: ({ task }, input) => {
            utils.task.list.setData({ serverId: input.serverId }, (items) =>
                replaceHostedTask(items, task)
            );
        },
    });
}
