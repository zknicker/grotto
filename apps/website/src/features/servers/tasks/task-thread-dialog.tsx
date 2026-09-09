import * as React from 'react';
import { useChats } from '../../../hooks/servers/use-chats.ts';
import { useTasks } from '../../../hooks/servers/use-tasks.ts';
import { useServerContext } from '../server-context.ts';
import { ThreadPeekDialog } from '../thread/thread-peek-dialog.tsx';
import { useTaskView } from './task-view.ts';

/**
 * The Task peek: opening a task from the Board or List lenses shows its
 * Thread work surface over the tasks page. `?task=<messageId>` owns the open
 * task, so deep links and Back work.
 */
export function TaskThreadDialog() {
    const { server } = useServerContext();
    const { closeTask, openTaskId } = useTaskView();
    // The peek addresses one task by id, so it reads past the Board's lens: a
    // background-tier task the Board hides still opens from `?task=`.
    const tasks = useTasks(server.id, undefined, {
        enabled: openTaskId !== null,
        includeBackground: true,
    });
    const chats = useChats(server.id);
    const item = openTaskId
        ? tasks.data?.tasks.find((candidate) => candidate.task.messageId === openTaskId)
        : undefined;
    const chat = item
        ? chats.data?.find((candidate) => candidate.id === item.task.chatId)
        : undefined;
    // The task-list message may omit the task projection; the Thread's
    // metadata section keys off `anchor.task`, so attach it explicitly.
    const anchor = React.useMemo(
        () => (item ? { ...item.message, task: item.task } : null),
        [item]
    );

    if (!(item && chat && anchor)) {
        return null;
    }

    return (
        <ThreadPeekDialog
            anchor={anchor}
            ariaLabel={`Task #${item.task.number} thread`}
            chat={chat}
            headerTitle={`Task #${item.task.number}`}
            initialThreadChatId={item.task.threadChatId}
            onClose={closeTask}
            summary={item.threadSummary}
        />
    );
}
