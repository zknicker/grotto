import * as React from 'react';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Field, FieldLabel } from '../../components/ui/primitives/field.tsx';
import { Form } from '../../components/ui/primitives/form.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { Textarea } from '../../components/ui/textarea.tsx';
import { useChatUpdate } from '../../hooks/chats/use-chat-update.ts';
import type { ChatListItem } from './chat-list-data.ts';

/**
 * Rename a channel or update its description. Participants have their own
 * dialog behind the topbar's people control; this one is only identity copy.
 */
export function ChannelEditDialog({
    chat,
    onClose,
    open,
}: {
    chat: ChatListItem;
    onClose: () => void;
    open: boolean;
}) {
    return (
        <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
            <DialogContent className="max-w-lg" showCloseButton={false}>
                {open ? <ChannelEditForm chat={chat} onClose={onClose} /> : null}
            </DialogContent>
        </Dialog>
    );
}

function ChannelEditForm({ chat, onClose }: { chat: ChatListItem; onClose: () => void }) {
    const nameInputId = React.useId();
    const descriptionInputId = React.useId();
    const updateChat = useChatUpdate();
    const [displayName, setDisplayName] = React.useState(chat.displayName);
    const [description, setDescription] = React.useState(chat.description ?? '');
    const trimmedDisplayName = displayName.trim();
    const canSubmit = trimmedDisplayName.length > 0 && !updateChat.isPending;

    const handleSubmit = React.useEffectEvent(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canSubmit) {
            return;
        }

        await updateChat.mutateAsync({
            agentIds: chat.boundAgentIds,
            chatId: chat.id,
            description: description.trim() || null,
            displayName: trimmedDisplayName,
        });
        onClose();
    });

    return (
        <Form className="contents" onSubmit={handleSubmit}>
            <DialogHeader className="pe-6">
                <DialogTitle>Edit channel</DialogTitle>
                <DialogDescription>Rename the channel or update its description.</DialogDescription>
            </DialogHeader>
            <DialogPanel className="grid gap-4">
                <Field>
                    <FieldLabel htmlFor={nameInputId}>Name</FieldLabel>
                    <Input
                        autoFocus
                        id={nameInputId}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder="planning"
                        type="text"
                        value={displayName}
                    />
                </Field>
                <Field>
                    <FieldLabel htmlFor={descriptionInputId}>
                        Description{' '}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                    </FieldLabel>
                    <Textarea
                        id={descriptionInputId}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="What is this channel about?"
                        rows={3}
                        value={description}
                    />
                </Field>
                {updateChat.error ? (
                    <Alert variant="error">
                        <AlertDescription>{updateChat.error.message}</AlertDescription>
                    </Alert>
                ) : null}
            </DialogPanel>
            <DialogFooter variant="bare">
                <Button onClick={onClose} size="sm" type="button" variant="ghost">
                    Cancel
                </Button>
                <Button
                    disabled={!canSubmit}
                    loading={updateChat.isPending}
                    size="sm"
                    type="submit"
                >
                    Save changes
                </Button>
            </DialogFooter>
        </Form>
    );
}
