import { Button } from '@heroui/react';
import type { HostedTaskLabel } from '@tavern/api';
import { useClaimServerTask } from '../../../hooks/servers/use-claim-server-task.ts';
import { useUnclaimServerTask } from '../../../hooks/servers/use-unclaim-server-task.ts';
import { ServerTaskAssignmentControl } from './server-task-assignment-control.tsx';
import { ServerTaskMetadataControls } from './server-task-metadata-controls.tsx';
import { type ServerTask, serverTaskClaimAction } from './server-task-presentation.ts';

export function ServerTaskActions({
    canAssign,
    labels,
    serverId,
    task,
    viewerUserId,
}: {
    canAssign: boolean;
    labels: HostedTaskLabel[];
    serverId: string;
    task: ServerTask;
    viewerUserId: string;
}) {
    const claim = useClaimServerTask();
    const unclaim = useUnclaimServerTask();
    const error = claim.error ?? unclaim.error;
    const action = serverTaskClaimAction(task, viewerUserId);

    return (
        <div className="relative z-20 flex flex-wrap items-center gap-2">
            <ServerTaskMetadataControls labels={labels} serverId={serverId} task={task} />
            <ServerTaskAssignmentControl enabled={canAssign} serverId={serverId} task={task} />
            {action === 'claim' || action === 'claim-reservation' ? (
                <Button
                    isPending={claim.isPending}
                    onPress={() =>
                        claim.mutate({
                            expectedVersion: task.version,
                            messageId: task.id,
                            serverId,
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
                            serverId,
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
