import { CheckListIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { AppCommandGroup } from './types.ts';

/**
 * The one Task command that is not a destination: whether Chat states the
 * tasks Agents claim for themselves. It reads as what pressing it does, so the
 * palette says `Hide tasks in chat` while they are showing.
 */
export function buildTaskCommandGroup({
    setShowTasksInChat,
    showTasksInChat,
}: {
    setShowTasksInChat: (enabled: boolean) => void;
    showTasksInChat: boolean;
}): AppCommandGroup {
    return {
        commands: [
            {
                icon: CheckListIcon,
                id: 'tasks.show-in-chat',
                keywords: ['task', 'tasks', 'chat', 'claim', 'show', 'hide', 'transcript'],
                run: () => setShowTasksInChat(!showTasksInChat),
                title: showTasksInChat ? 'Hide tasks in chat' : 'Show tasks in chat',
            },
        ],
        id: 'tasks',
        title: 'Tasks',
    };
}
