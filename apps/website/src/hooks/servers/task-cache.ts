import type { MessageTask, TaskListItem } from '@grotto/api';

export function replaceTask(
    items: TaskListItem[] | undefined,
    task: MessageTask
): TaskListItem[] | undefined {
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
