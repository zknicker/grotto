import { Button, Modal } from '@heroui/react';

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
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container size="sm">
                    <Modal.Dialog role="alertdialog">
                        <Modal.Header>
                            <Modal.Heading>Disable Browser?</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body>
                            <p className="text-muted text-sm">
                                {affectedAgentNames.join(', ')} will lose Browser access.
                                Re-enabling Browser will not restore their grants.
                            </p>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button slot="close" variant="secondary">
                                Cancel
                            </Button>
                            <Button onPress={onConfirm} slot="close" variant="danger-soft">
                                Disable
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
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
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container size="sm">
                    <Modal.Dialog role="alertdialog">
                        <Modal.Header>
                            <Modal.Heading>Replace Existing Skill?</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body>
                            <p className="text-muted text-sm">
                                Enabling Browser reserves the browser skill so the agent gets the
                                right tools and widget guidance.
                            </p>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button isDisabled={isSaving} onPress={onCancel} variant="secondary">
                                Cancel
                            </Button>
                            <Button
                                isPending={isSaving}
                                onPress={onReplace}
                                type="button"
                                variant="danger-soft"
                            >
                                Replace Skill
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
