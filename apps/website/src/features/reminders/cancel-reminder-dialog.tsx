import { Alert, AlertDialog, Button } from '@heroui/react';

interface CancelReminderDialogProps {
    errorMessage: string | null;
    isOpen: boolean;
    isPending: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    reminderName: string | null;
}

// Reminders can't be deleted, only canceled so they stop firing (D4
// immutability posture).
export function CancelReminderDialog({
    errorMessage,
    isOpen,
    isPending,
    onClose,
    onConfirm,
    reminderName,
}: CancelReminderDialogProps) {
    return (
        <AlertDialog
            isOpen={isOpen}
            onOpenChange={(nextOpen) => {
                if (!(nextOpen || isPending)) {
                    onClose();
                }
            }}
        >
            <AlertDialog.Backdrop>
                <AlertDialog.Container size="sm">
                    <AlertDialog.Dialog>
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="danger" />
                            <AlertDialog.Heading>Cancel Reminder?</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <div className="grid gap-4">
                                <p>
                                    {`Cancel "${reminderName ?? 'this reminder'}"? It will not fire again. This cannot be undone.`}
                                </p>
                                {errorMessage ? (
                                    <Alert role="alert" status="danger">
                                        <Alert.Indicator />
                                        <Alert.Content>
                                            <Alert.Description>{errorMessage}</Alert.Description>
                                        </Alert.Content>
                                    </Alert>
                                ) : null}
                            </div>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button isDisabled={isPending} slot="close" variant="secondary">
                                Keep Reminder
                            </Button>
                            <Button
                                isPending={isPending}
                                onPress={() => {
                                    void onConfirm();
                                }}
                                variant="danger-soft"
                            >
                                Cancel Reminder
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
    );
}
