import { AlertDialog, Button } from '@heroui/react';

export function BrowserDisableConfirmationDialog({
    affectedAgentNames,
    onConfirm,
    onOpenChange,
    open,
}: {
    affectedAgentNames: string[];
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    return (
        <AlertDialog isOpen={open} onOpenChange={onOpenChange}>
            <AlertDialog.Backdrop isDismissable>
                <AlertDialog.Container size="sm">
                    <AlertDialog.Dialog>
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="danger" />
                            <AlertDialog.Heading>Disable Browser?</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p>
                                {affectedAgentNames.join(', ')} will lose Browser access.
                                Re-enabling Browser will not restore their grants.
                            </p>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button slot="close" type="button" variant="secondary">
                                Cancel
                            </Button>
                            <Button onPress={onConfirm} slot="close" variant="danger">
                                Disable
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
    );
}

export function BrowserSkillConflictConfirmationDialog({
    isSaving,
    onCancel,
    onOpenChange,
    onReplace,
    open,
}: {
    isSaving: boolean;
    onCancel: () => void;
    onOpenChange: (open: boolean) => void;
    onReplace: () => void;
    open: boolean;
}) {
    return (
        <AlertDialog isOpen={open} onOpenChange={onOpenChange}>
            <AlertDialog.Backdrop isDismissable>
                <AlertDialog.Container size="sm">
                    <AlertDialog.Dialog>
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="warning" />
                            <AlertDialog.Heading>Replace Existing Skill?</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p>
                                Enabling Browser reserves the browser skill so the agent gets the
                                right tools and widget guidance.
                            </p>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button
                                isDisabled={isSaving}
                                onPress={onCancel}
                                slot="close"
                                type="button"
                                variant="secondary"
                            >
                                Cancel
                            </Button>
                            <Button
                                isPending={isSaving}
                                onPress={onReplace}
                                type="button"
                                variant="danger"
                            >
                                Replace Skill
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
    );
}
