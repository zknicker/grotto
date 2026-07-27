import type { HostedMessageTask, HostedTaskListItem } from '@tavern/api';

export function replaceHostedTask(
    items: HostedTaskListItem[] | undefined,
    task: HostedMessageTask
): HostedTaskListItem[] | undefined {
    return items?.map((item) =>
        item.task.messageId === task.messageId
            ? {
                  ...item,
                  message: { ...item.message, task },
                  task,
              }
            : item
    );
}
