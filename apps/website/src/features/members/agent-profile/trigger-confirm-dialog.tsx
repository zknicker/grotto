import { AlertDialog, Button } from '@heroui/react';

/**
 * The two Trigger actions that cannot be taken back — rotating its secret and
 * deleting it — ask first, in the same shape.
 */
export function TriggerConfirmDialog({
    body,
    confirmLabel,
    heading,
    isOpen,
    isPending,
    onConfirm,
    onOpenChange,
    status = 'warning',
}: {
    body: string;
    confirmLabel: string;
    heading: string;
    isOpen: boolean;
    isPending: boolean;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
    status?: 'danger' | 'warning';
}) {
    return (
        <AlertDialog isOpen={isOpen} onOpenChange={onOpenChange}>
            <AlertDialog.Backdrop isDismissable>
                <AlertDialog.Container size="sm">
                    <AlertDialog.Dialog>
                        <AlertDialog.Header>
                            <AlertDialog.Icon status={status} />
                            <AlertDialog.Heading>{heading}</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>{body}</AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button isDisabled={isPending} slot="close" variant="secondary">
                                Cancel
                            </Button>
                            <Button
                                isPending={isPending}
                                onPress={onConfirm}
                                type="button"
                                variant={status === 'danger' ? 'danger' : 'primary'}
                            >
                                {confirmLabel}
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
    );
}
