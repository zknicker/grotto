import type { CloudAgentWork } from '@grotto/api';
import { toast } from '@heroui/react';
import { useCloudAgentWorkCancel } from '../../hooks/servers/use-cloud-agent-work.ts';
import { useServerContext } from '../servers/server-context.ts';
import { canCancelCloudAgentWork } from './cloud-agent-presentation.ts';

/**
 * The one cancel path both surfaces press: the Thread surface's overflow menu
 * and the Thread pane header. Server records the request and the Run settles
 * through the ordinary observation path, so nothing here writes cache — the
 * work reads as cancelling until `cloud-agent-work.updated` arrives.
 */
export function useCloudAgentCancelAction(work: CloudAgentWork) {
    const { server } = useServerContext();
    const cancel = useCloudAgentWorkCancel();

    return {
        canCancel: canCancelCloudAgentWork({
            cancelRequestedAt: work.cancelRequestedAt,
            role: server.role,
            status: work.status,
        }),
        isPending: cancel.isPending,
        requestCancel: () => {
            cancel
                .mutateAsync({ serverId: server.id, workId: work.id })
                .then(() => toast.success('Cancel requested'))
                .catch((error: unknown) =>
                    toast.danger('Could not cancel this work', {
                        description: error instanceof Error ? error.message : 'Try again.',
                    })
                );
        },
    };
}
