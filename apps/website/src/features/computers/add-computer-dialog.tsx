import { Button, Card, Chip, Modal } from '@heroui/react';
import { ComputerIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { ComputerSetupCommands } from './computer-setup-commands.tsx';

export function AddComputerDialog({
    onOpenChange,
    open,
    serverSlug,
}: {
    onOpenChange: (open: boolean) => void;
    open: boolean;
    serverSlug: string;
}) {
    return (
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container scroll="outside" size="lg">
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Icon>
                                <Icon icon={ComputerIcon} />
                            </Modal.Icon>
                            <div className="min-w-0 flex-1">
                                <Modal.Heading>Add Computer</Modal.Heading>
                                <p className="mt-1 text-muted text-sm">
                                    Run Agents on an Apple Silicon Mac you control.
                                </p>
                            </div>
                        </Modal.Header>
                        <Modal.Body>
                            <div className="grid gap-4">
                                <Card>
                                    <Card.Header>
                                        <Card.Title>Your Computer</Card.Title>
                                        <Card.Description>
                                            Run Agents on your own Computer.
                                        </Card.Description>
                                    </Card.Header>
                                    <Card.Content>
                                        <div className="grid gap-4">
                                            <ComputerSetupCommands serverSlug={serverSlug} />
                                        </div>
                                    </Card.Content>
                                </Card>
                                <Card>
                                    <Card.Header>
                                        <Card.Title>
                                            Cloud Computer
                                            <Chip className="ms-2" size="sm" variant="soft">
                                                Coming Soon
                                            </Chip>
                                        </Card.Title>
                                        <Card.Description>
                                            Managed execution without your own Mac.
                                        </Card.Description>
                                    </Card.Header>
                                </Card>
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button slot="close" variant="secondary">
                                Done
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
