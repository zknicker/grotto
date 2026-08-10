import { AlertDialog, Button, InputGroup, Label, TextField } from '@heroui/react';
import * as React from 'react';

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
        <AlertDialog isOpen onOpenChange={onOpenChange}>
            <AlertDialog.Backdrop isDismissable>
                <AlertDialog.Container size="sm">
                    <AlertDialog.Dialog>
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="danger" />
                            <AlertDialog.Heading>{pending.label}</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <div className="grid gap-4">
                                <p>{pending.description}</p>
                                {pending.requiresSlug ? (
                                    <TextField fullWidth onChange={setTyped} value={typed}>
                                        <Label htmlFor="server-member-confirmation">
                                            Type the Server address to confirm
                                        </Label>
                                        <InputGroup fullWidth>
                                            <InputGroup.Prefix>/</InputGroup.Prefix>
                                            <InputGroup.Input
                                                autoComplete="off"
                                                id="server-member-confirmation"
                                                placeholder={slug}
                                            />
                                        </InputGroup>
                                    </TextField>
                                ) : null}
                            </div>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button slot="close" variant="secondary">
                                Cancel
                            </Button>
                            <Button
                                isDisabled={!canConfirm}
                                onPress={() => pending.run(typed)}
                                variant="danger"
                            >
                                {pending.label}
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
    );
}
