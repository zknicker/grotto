import { Button, FieldError, Form, Input, Label, Modal, TextField, toast } from '@heroui/react';
import type { Chat } from '@tavern/api';
import * as React from 'react';
import { useChannelUpdate } from '../../hooks/servers/use-channel-update.ts';
import { ChannelDialogError } from './channel-dialog-error.tsx';
import { channelHandleIssue } from './channel-handle.ts';

/** Rename a channel — its handle, and nothing else. */
export function ChannelRenameDialog({ chat, onClose }: { chat: Chat; onClose: () => void }) {
    const updateChannel = useChannelUpdate();
    const currentName = chat.name ?? '';
    const [name, setName] = React.useState(currentName);
    const trimmedName = name.trim();
    const handleIssue = channelHandleIssue(name);
    const canSubmit =
        trimmedName.length > 0 &&
        !handleIssue &&
        trimmedName !== currentName &&
        !updateChannel.isPending;

    const handleSubmit = React.useEffectEvent(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canSubmit) {
            return;
        }

        try {
            await updateChannel.mutateAsync({
                agentIds: chat.participantAgentIds,
                chatId: chat.id,
                name: trimmedName,
                serverId: chat.serverId,
            });
            toast.success('Channel renamed');
            onClose();
        } catch {
            // The dialog stays open and shows the failure inline.
        }
    });

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()}>
            <Modal.Backdrop isDismissable>
                <Modal.Container size="sm">
                    <Modal.Dialog>
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>Rename channel</Modal.Heading>
                            <p className="text-muted text-sm leading-5">
                                The name is the channel's handle, so agents address it by whatever
                                you type here.
                            </p>
                        </Modal.Header>
                        <Modal.Body>
                            <Form
                                className="flex flex-col gap-4"
                                id="channel-rename-form"
                                onSubmit={handleSubmit}
                            >
                                <TextField
                                    fullWidth
                                    isDisabled={updateChannel.isPending}
                                    isInvalid={Boolean(handleIssue)}
                                    onChange={setName}
                                    value={name}
                                    variant="secondary"
                                >
                                    <Label>Channel name</Label>
                                    <Input autoFocus placeholder="planning" type="text" />
                                    {handleIssue ? <FieldError>{handleIssue}</FieldError> : null}
                                </TextField>
                                <ChannelDialogError
                                    message={updateChannel.error?.message ?? null}
                                />
                            </Form>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button slot="close" type="button" variant="secondary">
                                Cancel
                            </Button>
                            <Button
                                form="channel-rename-form"
                                isDisabled={!canSubmit}
                                isPending={updateChannel.isPending}
                                type="submit"
                            >
                                Save
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
