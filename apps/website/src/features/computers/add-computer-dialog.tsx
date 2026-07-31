import { Button, Card, Chip, Modal } from '@heroui/react';
import { ComputerIcon } from '@hugeicons-pro/core-stroke-rounded';
import { CodeSnippet } from '../../components/code-snippet.tsx';
import { Icon } from '../../components/ui/icon.tsx';

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
                                            <div className="grid gap-2">
                                                <p className="font-medium text-foreground text-sm">
                                                    1. Install
                                                </p>
                                                <CodeSnippet lines="curl -fsSL https://releases.grotto.sh/computer/install.sh | sh" />
                                            </div>
                                            <div className="grid gap-2">
                                                <p className="font-medium text-foreground text-sm">
                                                    2. Set up
                                                </p>
                                                <CodeSnippet
                                                    lines={`grotto-computer setup /${serverSlug}`}
                                                />
                                            </div>
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
