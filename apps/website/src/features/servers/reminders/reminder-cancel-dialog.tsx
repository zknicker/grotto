import { Alert, AlertDialog, Button } from '@heroui/react';
import * as React from 'react';
import { useReminderCancel } from '../../../hooks/servers/use-reminder-cancel.ts';
import { useReminders } from '../../../hooks/servers/use-reminders.ts';

export function ReminderCancelDialog({
    onClose,
    reminderId,
    serverId,
}: {
    onClose: () => void;
    reminderId: string | null;
    serverId: string;
}) {
    const reminders = useReminders(serverId);
    const cancel = useReminderCancel();
    const resetCancel = cancel.reset;
    const reminder = reminders.data?.find((item) => item.id === reminderId);

    React.useEffect(() => {
        if (reminderId) {
            resetCancel();
        }
    }, [reminderId, resetCancel]);

    function close() {
        if (!cancel.isPending) {
            resetCancel();
            onClose();
        }
    }

    return (
        <AlertDialog
            isOpen={reminderId !== null}
            onOpenChange={(open) => {
                if (!open) {
                    close();
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
                                    {`Cancel "${reminder?.title ?? 'this reminder'}"? It will not fire again. This cannot be undone.`}
                                </p>
                                {cancel.error ? (
                                    <Alert role="alert" status="danger">
                                        <Alert.Indicator />
                                        <Alert.Content>
                                            <Alert.Description>
                                                {cancel.error.message}
                                            </Alert.Description>
                                        </Alert.Content>
                                    </Alert>
                                ) : null}
                            </div>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button isDisabled={cancel.isPending} slot="close" variant="secondary">
                                Keep Reminder
                            </Button>
                            <Button
                                isDisabled={!reminder}
                                isPending={cancel.isPending}
                                onPress={async () => {
                                    if (!reminder) {
                                        return;
                                    }
                                    await cancel.mutateAsync({
                                        commandId: crypto.randomUUID(),
                                        expectedVersion: reminder.version,
                                        reminderId: reminder.id,
                                        serverId,
                                    });
                                    onClose();
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
