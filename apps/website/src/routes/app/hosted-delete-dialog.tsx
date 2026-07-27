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
        <AlertDialog onOpenChange={onOpenChange} open>
            <AlertDialogPopup>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="hosted-delete-confirmation">
                        Type <span className="font-medium text-foreground">{confirmation}</span> to
                        confirm
                    </Label>
                    <Input
                        autoComplete="off"
                        id="hosted-delete-confirmation"
                        onChange={(event) => setTyped(event.currentTarget.value)}
                        value={typed}
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogClose render={<Button type="button" variant="ghost" />}>
                        Cancel
                    </AlertDialogClose>
                    <Button
                        disabled={typed !== confirmation}
                        loading={pending}
                        onClick={onConfirm}
                        type="button"
                        variant="destructive"
                    >
                        {title}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogPopup>
        </AlertDialog>
    );
}
