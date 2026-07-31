import { AlertDialog, Button, InputGroup, Label, TextField } from '@heroui/react';
import * as React from 'react';

export function DeleteServerDialog({
    displayName,
    onConfirm,
    onOpenChange,
    open,
    slug,
}: {
    displayName: string;
    onConfirm(confirmation: string): void;
    onOpenChange(open: boolean): void;
    open: boolean;
    slug: string;
}) {
    const [typed, setTyped] = React.useState('');
    const canConfirm = isDeleteServerConfirmation(typed, slug);
    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            setTyped('');
        }
        onOpenChange(nextOpen);
    };

    return (
        <AlertDialog isOpen={open} onOpenChange={handleOpenChange}>
            <AlertDialog.Backdrop>
                <AlertDialog.Container size="sm">
                    <AlertDialog.Dialog>
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="danger" />
                            <AlertDialog.Heading>Delete {displayName}?</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <div className="grid gap-4">
                                <p>
                                    This permanently destroys collaboration history, members,
                                    invites, agents, Computers, credentials, pending work,
                                    reminders, and attachments. It cannot be undone. Access ends
                                    immediately; attached Computers lose their credentials and the
                                    cleanup never waits for an offline machine.
                                </p>
                                <TextField fullWidth onChange={setTyped} value={typed}>
                                    <Label htmlFor="server-delete-confirmation">
                                        Type the Server address to confirm
                                    </Label>
                                    <InputGroup fullWidth>
                                        <InputGroup.Prefix>/</InputGroup.Prefix>
                                        <InputGroup.Input
                                            autoComplete="off"
                                            id="server-delete-confirmation"
                                            placeholder={slug}
                                        />
                                    </InputGroup>
                                </TextField>
                            </div>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button slot="close" variant="secondary">
                                Cancel
                            </Button>
                            <Button
                                isDisabled={!canConfirm}
                                onPress={() => onConfirm(typed)}
                                variant="danger"
                            >
                                Delete Server
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
    );
}

export function isDeleteServerConfirmation(typed: string, slug: string) {
    return typed === slug;
}
