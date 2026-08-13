import { Button, toast } from '@heroui/react';
import type { Chat } from '@tavern/api';
import { useChannelUnarchive } from '../../../hooks/servers/use-channel-lifecycle.ts';

export function ArchivedChannelBar({ canManage, chat }: { canManage: boolean; chat: Chat }) {
    const unarchive = useChannelUnarchive();

    return (
        <div className="mx-auto flex w-full items-center justify-between gap-4 px-9 pb-4 text-muted text-sm">
            <p>This channel is archived. Its history is read-only.</p>
            {canManage ? (
                <Button
                    isPending={unarchive.isPending}
                    onPress={() =>
                        unarchive
                            .mutateAsync({ chatId: chat.id, serverId: chat.serverId })
                            .then(() => toast.success('Channel restored'))
                            .catch((error: Error) =>
                                toast.danger('Restore failed', { description: error.message })
                            )
                    }
                    size="sm"
                    variant="outline"
                >
                    Restore
                </Button>
            ) : null}
        </div>
    );
}
