import { AlertDialog, Button, Input, Label, TextField } from '@heroui/react';
import * as React from 'react';

export function HostedDeleteDialog({
    confirmation,
    description,
    onConfirm,
    onOpenChange,
    pending,
    title,
}: {
    confirmation: string;
    description: string;
    onConfirm(): void;
    onOpenChange(open: boolean): void;
    pending: boolean;
    title: string;
}) {
    const [typed, setTyped] = React.useState('');

    return (
        <AlertDialog isOpen onOpenChange={onOpenChange}>
            <AlertDialog.Backdrop>
                <AlertDialog.Container size="sm">
                    <AlertDialog.Dialog>
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="danger" />
                            <AlertDialog.Heading>{title}</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <div className="grid gap-4">
                                <p className="text-muted text-sm">{description}</p>
                                <TextField
                                    autoComplete="off"
                                    fullWidth
                                    onChange={setTyped}
                                    value={typed}
                                >
                                    <Label>
                                        Type{' '}
                                        <span className="font-medium text-foreground">
                                            {confirmation}
                                        </span>{' '}
                                        to confirm
                                    </Label>
                                    <Input />
                                </TextField>
                            </div>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button slot="close" type="button" variant="secondary">
                                Cancel
                            </Button>
                            <Button
                                isDisabled={typed !== confirmation}
                                isPending={pending}
                                onPress={onConfirm}
                                type="button"
                                variant="danger"
                            >
                                {title}
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
    );
}
