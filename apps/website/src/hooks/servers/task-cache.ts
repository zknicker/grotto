import type { MessageTask, TaskList } from '@haus/api';

export function replaceTask(list: TaskList | undefined, task: MessageTask): TaskList | undefined {
    if (!list) {
        return list;
    }
    return {
        ...list,
        tasks: list.tasks.map((item) =>
            item.task.messageId === task.messageId
                ? {
                      ...item,
                      message: { ...item.message, task },
                      task,
                  }
                : item
        ),
    };
}
