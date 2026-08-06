import type { HostedMessageTask, HostedTaskListItem } from '@tavern/api';

export function replaceTask(
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
