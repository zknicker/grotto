import { Button } from '@heroui/react';
import { useTaskClaim } from '../../../hooks/servers/use-task-claim.ts';
import { useTaskUnclaim } from '../../../hooks/servers/use-task-unclaim.ts';
import { useHostedServerContext } from '../hosted-server-context.ts';
import { TaskAssignee } from './task-assignee.tsx';
import { TaskMetadata } from './task-metadata.tsx';
import { type TaskItem, taskClaimAction } from './task-model.ts';

export function TaskActions({ task }: { task: TaskItem }) {
    const { server } = useHostedServerContext();
    const claim = useTaskClaim();
    const unclaim = useTaskUnclaim();
    const error = claim.error ?? unclaim.error;
    const action = taskClaimAction(task, server.viewerUserId);

    return (
        <div className="relative z-20 flex flex-wrap items-center gap-2">
            <TaskMetadata task={task} />
            <TaskAssignee task={task} />
            {action === 'claim' || action === 'claim-reservation' ? (
                <Button
                    isPending={claim.isPending}
                    onPress={() =>
                        claim.mutate({
                            expectedVersion: task.version,
                            messageId: task.id,
                            serverId: server.id,
                        })
                    }
                    size="sm"
                    variant="secondary"
                >
                    {action === 'claim' ? 'Claim' : 'Claim Reservation'}
                </Button>
            ) : action === 'unclaim' ? (
                <Button
                    isPending={unclaim.isPending}
                    onPress={() =>
                        unclaim.mutate({
                            expectedVersion: task.version,
                            messageId: task.id,
                            serverId: server.id,
                        })
                    }
                    size="sm"
                    variant="ghost"
                >
                    Unclaim
                </Button>
            ) : null}
            {error ? (
                <span className="basis-full text-danger text-xs" role="alert">
                    {error.message}
                </span>
            ) : null}
        </div>
    );
}
