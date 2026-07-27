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

export interface PendingMemberChange {
    /** Prose naming the human and exactly what will happen to them. */
    description: string;
    label: string;
    requiresSlug: boolean;
    run(confirmation: string): void;
}

/**
 * Destructive and Owner-level changes follow Grotto's danger-zone interaction:
 * the Server's immutable address is typed in full, `/` renders as a fixed
 * prefix, and the confirming button stays disabled until the value matches
 * exactly. The Server verifies the same value inside its transaction, so this
 * is friction and clarity — never the authorization itself.
 */
export function ServerMemberConfirmDialog({
    onOpenChange,
    pending,
    slug,
}: {
    onOpenChange(open: boolean): void;
    pending: PendingMemberChange | null;
    slug: string;
}) {
    const [typed, setTyped] = React.useState('');
    const [confirming, setConfirming] = React.useState(pending);

    // Opening a different change clears what was typed for the previous one.
    // Adjusting during render rather than in an effect keeps a stale
    // confirmation from ever being briefly shown against the new change.
    if (confirming !== pending) {
        setConfirming(pending);
        setTyped('');
    }

    if (!pending) {
        return null;
    }

    const canConfirm = !pending.requiresSlug || typed === slug;

    return (
        <AlertDialog onOpenChange={onOpenChange} open>
            <AlertDialogPopup>
                <AlertDialogHeader>
                    <AlertDialogTitle>{pending.label}</AlertDialogTitle>
                    <AlertDialogDescription>{pending.description}</AlertDialogDescription>
                </AlertDialogHeader>
                {pending.requiresSlug ? (
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="server-member-confirmation">
                            Type the Server address to confirm
                        </Label>
                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground text-sm">/</span>
                            <Input
                                autoComplete="off"
                                id="server-member-confirmation"
                                onChange={(event) => setTyped(event.target.value)}
                                placeholder={slug}
                                value={typed}
                            />
                        </div>
                    </div>
                ) : null}
                <AlertDialogFooter>
                    <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
                    <Button
                        disabled={!canConfirm}
                        onClick={() => pending.run(typed)}
                        variant="destructive"
                    >
                        {pending.label}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogPopup>
        </AlertDialog>
    );
}
