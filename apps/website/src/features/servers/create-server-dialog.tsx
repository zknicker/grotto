import { Button, Form, Modal } from '@heroui/react';
import { CreateServerFields, useCreateServerForm } from './create-server-form.tsx';

const formId = 'create-server-dialog-form';

export function CreateServerDialog({
    isOpen,
    onOpenChange,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}) {
    const form = useCreateServerForm(() => onOpenChange(false));

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Backdrop isDismissable>
                <Modal.Container size="sm">
                    <Modal.Dialog>
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>Create a Server</Modal.Heading>
                            <p className="mt-1 text-muted text-sm">
                                Start a new place for your people and Agents.
                            </p>
                        </Modal.Header>
                        <Modal.Body>
                            <Form
                                className="flex flex-col items-stretch gap-4"
                                id={formId}
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    form.submit();
                                }}
                            >
                                <CreateServerFields form={form} />
                            </Form>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button slot="close" variant="secondary">
                                Cancel
                            </Button>
                            <Button
                                form={formId}
                                isDisabled={!form.isSubmittable}
                                isPending={form.isPending}
                                type="submit"
                            >
                                Create Server
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
