import {
    Alert,
    Button,
    Description,
    Form,
    Input,
    Label,
    Modal,
    TextArea,
    TextField,
} from '@heroui/react';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';

export function AgentIdentityDialog({
    agent,
    error,
    onOpenChange,
    onSave,
    open,
    pending,
}: {
    agent: HostedAgent;
    error: string | null;
    onOpenChange: (open: boolean) => void;
    onSave: (identity: { description: string | null; displayName: string }) => Promise<void>;
    open: boolean;
    pending: boolean;
}) {
    return (
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container size="md">
                    <Modal.Dialog>
                        <AgentIdentityForm
                            agent={agent}
                            error={error}
                            onSave={onSave}
                            pending={pending}
                        />
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}

function AgentIdentityForm({
    agent,
    error,
    onSave,
    pending,
}: {
    agent: HostedAgent;
    error: string | null;
    onSave: (identity: { description: string | null; displayName: string }) => Promise<void>;
    pending: boolean;
}) {
    const [displayName, setDisplayName] = React.useState(agent.displayName);
    const [description, setDescription] = React.useState(agent.description ?? '');
    const trimmedName = displayName.trim();

    return (
        <Form
            onSubmit={(event) => {
                event.preventDefault();
                if (trimmedName && !pending) {
                    void onSave({
                        description: description.trim() || null,
                        displayName: trimmedName,
                    }).catch(() => undefined);
                }
            }}
        >
            <Modal.Header>
                <div className="min-w-0 flex-1">
                    <Modal.Heading>Edit Profile</Modal.Heading>
                    <p className="mt-1 text-muted text-sm">
                        Update how this Agent appears to people.
                    </p>
                </div>
            </Modal.Header>
            <Modal.Body>
                <div className="grid gap-4">
                    <TextField fullWidth onChange={setDisplayName} value={displayName}>
                        <Label>Name</Label>
                        <Input autoFocus maxLength={80} />
                    </TextField>
                    <TextField fullWidth onChange={setDescription} value={description}>
                        <Label>Description</Label>
                        <TextArea maxLength={500} rows={3} />
                        <Description>Optional</Description>
                    </TextField>
                    {error ? (
                        <Alert status="danger">
                            <Alert.Content>
                                <Alert.Description>{error}</Alert.Description>
                            </Alert.Content>
                        </Alert>
                    ) : null}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button isDisabled={pending} slot="close" type="button" variant="secondary">
                    Cancel
                </Button>
                <Button isDisabled={!trimmedName} isPending={pending} type="submit">
                    Save
                </Button>
            </Modal.Footer>
        </Form>
    );
}
