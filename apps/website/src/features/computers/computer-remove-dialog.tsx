import { useComputerRemove } from '../../hooks/servers/use-computer-remove.ts';
import { HostedDeleteDialog } from '../../routes/app/hosted-delete-dialog.tsx';

export function ComputerRemoveDialog({
    computerId,
    onOpenChange,
    serverId,
}: {
    computerId: string;
    onOpenChange: (open: boolean) => void;
    serverId: string;
}) {
    const remove = useComputerRemove(serverId, () => onOpenChange(false));

    return (
        <HostedDeleteDialog
            confirmation="REMOVE"
            description="This immediately revokes this Computer’s credential. Delete every Agent on this Computer first."
            onConfirm={() =>
                remove.mutate({
                    computerId,
                    confirmation: 'REMOVE',
                    serverId,
                })
            }
            onOpenChange={onOpenChange}
            pending={remove.isPending}
            title="Remove Computer"
        />
    );
}
