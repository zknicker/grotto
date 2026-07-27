import * as React from 'react';
import {
    AlertDialog,
    AlertDialogClose,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogPopup,
    AlertDialogTitle,
} from '../../components/ui/alert-dialog.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { Label } from '../../components/ui/primitives/label.tsx';

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
        <AlertDialog onOpenChange={handleOpenChange} open={open}>
            <AlertDialogPopup>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete {displayName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This permanently destroys collaboration history, members, invites, agents,
                        Computers, credentials, pending work, reminders, and attachments. It cannot
                        be undone. Access ends immediately; attached Computers lose their
                        credentials and the cleanup never waits for an offline machine.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="server-delete-confirmation">
                        Type the Server address to confirm
                    </Label>
                    <div className="flex items-center gap-1">
                        <span className="text-muted-foreground text-sm">/</span>
                        <Input
                            autoComplete="off"
                            id="server-delete-confirmation"
                            onChange={(event) => setTyped(event.target.value)}
                            placeholder={slug}
                            value={typed}
                        />
                    </div>
                </div>
                <AlertDialogFooter>
                    <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
                    <Button
                        disabled={!canConfirm}
                        onClick={() => onConfirm(typed)}
                        variant="destructive"
                    >
                        Delete Server
                    </Button>
                </AlertDialogFooter>
            </AlertDialogPopup>
        </AlertDialog>
    );
}

export function isDeleteServerConfirmation(typed: string, slug: string) {
    return typed === slug;
}
