import type { Agent, MessageTask } from '@tavern/api';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { useTaskUpdate } from '../../../hooks/servers/use-task-update.ts';
import { useTasks } from '../../../hooks/servers/use-tasks.ts';
import type { HumanDirectory } from '../human-identity.ts';
import { useServerContext } from '../server-context.ts';
import { TaskAssignee } from './task-assignee.tsx';
import { taskUpdateInput } from './task-input.ts';
import { taskAssigneeName } from './task-model.ts';
import { TaskStatusSelect } from './task-status-select.tsx';

export function TaskThreadMetadata({
    chatId,
    fallbackTask,
    messageId,
}: {
    chatId: string;
    fallbackTask: MessageTask;
    messageId: string;
}) {
    const { server } = useServerContext();
    const agents = useAgents(server.id);
    const humans = useHumanDirectory(server.id);
    const tasks = useTasks(server.id, chatId);
    const update = useTaskUpdate();
    const task =
        tasks.data?.find((item) => item.task.messageId === messageId)?.task ?? fallbackTask;
    const agentDirectory = agents.data ?? [];
    const assigneeLabel = taskAssigneeName(task, agentDirectory, humans);
    const canAssign = server.role === 'owner' || server.role === 'admin';
    const target = {
        assigneeAgentId: task.assigneeAgentId,
        assigneeLabel,
        assigneeUserId: task.assigneeUserId,
        id: messageId,
        number: task.number,
        status: task.status,
        version: task.version,
    };

    return (
        <section
            aria-label={`Task #${task.number} details`}
            className="mb-5 rounded-xl bg-surface-secondary p-4"
        >
            <h3 className="mb-3 font-semibold text-sm">Task #{task.number}</h3>
            <dl className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
                <dt className="text-muted text-sm">Status</dt>
                <dd className="flex min-w-0 max-w-52 flex-col gap-1">
                    <TaskStatusSelect
                        error={update.error}
                        isDisabled={update.isPending}
                        onStatusChange={(status) =>
                            update.mutate(taskUpdateInput(server.id, target, { status }))
                        }
                        task={target}
                    />
                </dd>
                <dt className="text-muted text-sm">Assignee</dt>
                <dd className="min-w-0 max-w-52">
                    {canAssign ? (
                        <TaskAssignee task={target} />
                    ) : (
                        <span className="text-sm">{assigneeLabel}</span>
                    )}
                </dd>
                <dt className="text-muted text-sm">Created by</dt>
                <dd className="min-w-0 truncate text-sm">
                    {taskCreatorName(task, agentDirectory, humans)}
                </dd>
            </dl>
        </section>
    );
}

function taskCreatorName(
    task: Pick<MessageTask, 'createdByAgentId' | 'createdByUserId'>,
    agents: Agent[],
    humans: HumanDirectory
) {
    if (task.createdByAgentId) {
        const agent = agents.find((candidate) => candidate.id === task.createdByAgentId);
        return agent?.displayName ?? `Agent ${task.createdByAgentId.slice(-6)}`;
    }
    if (task.createdByUserId) {
        return humans.name(task.createdByUserId);
    }
    return 'Unknown';
}
