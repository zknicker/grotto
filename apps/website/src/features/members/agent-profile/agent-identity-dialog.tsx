import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { Alert, AlertDescription } from '../../../components/ui/alert.tsx';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../../components/ui/dialog.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Field, FieldLabel } from '../../../components/ui/primitives/field.tsx';
import { Form } from '../../../components/ui/primitives/form.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { Textarea } from '../../../components/ui/textarea.tsx';

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
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent showCloseButton={false}>
                {open ? (
                    <AgentIdentityForm
                        agent={agent}
                        error={error}
                        onCancel={() => onOpenChange(false)}
                        onSave={onSave}
                        pending={pending}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function AgentIdentityForm({
    agent,
    error,
    onCancel,
    onSave,
    pending,
}: {
    agent: HostedAgent;
    error: string | null;
    onCancel: () => void;
    onSave: (identity: { description: string | null; displayName: string }) => Promise<void>;
    pending: boolean;
}) {
    const [displayName, setDisplayName] = React.useState(agent.displayName);
    const [description, setDescription] = React.useState(agent.description ?? '');
    const trimmedName = displayName.trim();

    return (
        <Form
            className="contents"
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
            <DialogHeader>
                <DialogTitle>Edit profile</DialogTitle>
                <DialogDescription>Update how this Agent appears to people.</DialogDescription>
            </DialogHeader>
            <DialogPanel className="grid gap-4">
                <Field>
                    <FieldLabel htmlFor="agent-display-name">Name</FieldLabel>
                    <Input
                        autoFocus
                        id="agent-display-name"
                        maxLength={80}
                        onChange={(event) => setDisplayName(event.currentTarget.value)}
                        value={displayName}
                    />
                </Field>
                <Field>
                    <FieldLabel htmlFor="agent-description">
                        Description{' '}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                    </FieldLabel>
                    <Textarea
                        id="agent-description"
                        maxLength={500}
                        onChange={(event) => setDescription(event.currentTarget.value)}
                        rows={3}
                        value={description}
                    />
                </Field>
                {error ? (
                    <Alert variant="error">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}
            </DialogPanel>
            <DialogFooter variant="bare">
                <Button
                    disabled={pending}
                    onClick={onCancel}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    Cancel
                </Button>
                <Button
                    disabled={!trimmedName || pending}
                    loading={pending}
                    size="sm"
                    type="submit"
                >
                    Save
                </Button>
            </DialogFooter>
        </Form>
    );
}
