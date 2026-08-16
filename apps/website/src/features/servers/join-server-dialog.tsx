import { Button, Form, Modal } from '@heroui/react';
import { JoinServerFields, useJoinServerForm } from './join-server-form.tsx';

const formId = 'join-server-dialog-form';

export function JoinServerDialog({
    isOpen,
    onOpenChange,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}) {
    const form = useJoinServerForm();

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Backdrop isDismissable>
                <Modal.Container size="sm">
                    <Modal.Dialog>
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>Join a Server</Modal.Heading>
                            <p className="mt-1 text-muted text-sm">
                                Paste an invitation link or token.
                            </p>
                        </Modal.Header>
                        <Modal.Body>
                            <Form
                                id={formId}
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    if (!form.isSubmittable) {
                                        return;
                                    }
                                    form.submit();
                                    onOpenChange(false);
                                }}
                            >
                                <JoinServerFields form={form} />
                            </Form>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button slot="close" variant="secondary">
                                Cancel
                            </Button>
                            <Button form={formId} isDisabled={!form.isSubmittable} type="submit">
                                Continue
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
