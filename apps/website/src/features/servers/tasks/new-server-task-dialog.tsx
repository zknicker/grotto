import { Button, Form, Label, ListBox, Modal, Select, TextArea, TextField } from '@heroui/react';
import * as React from 'react';
import { useCreateServerTask } from '../../../hooks/servers/use-create-server-task.ts';

export interface ServerTaskChatOption {
    id: string;
    label: string;
}

export function NewServerTaskDialog({
    chats,
    onOpenChange,
    open,
    serverId,
}: {
    chats: ServerTaskChatOption[];
    onOpenChange: (open: boolean) => void;
    open: boolean;
    serverId: string;
}) {
    const create = useCreateServerTask();
    const resetCreate = create.reset;
    const [body, setBody] = React.useState('');
    const [chatId, setChatId] = React.useState('');
    const wasOpen = React.useRef(false);
    const firstChatId = chats[0]?.id ?? '';

    React.useEffect(() => {
        if (open && !wasOpen.current) {
            setBody('');
            setChatId(firstChatId);
            resetCreate();
        }
        wasOpen.current = open;
    }, [firstChatId, open, resetCreate]);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        const content = body.trim();
        if (!(content && chatId)) {
            return;
        }
        await create.mutateAsync({
            chatId,
            content,
            nonce: crypto.randomUUID(),
            serverId,
        });
        onOpenChange(false);
    }

    const selectedChat = chats.find((chat) => chat.id === chatId) ?? null;

    return (
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog>
                        <Form onSubmit={submit}>
                            <Modal.Header>
                                <div className="min-w-0 flex-1">
                                    <Modal.Heading>New Task</Modal.Heading>
                                    <p className="mt-1 text-muted text-sm">
                                        Create a message and use its Thread as the task work
                                        surface.
                                    </p>
                                </div>
                            </Modal.Header>
                            <Modal.Body>
                                <div className="grid gap-4">
                                    <Select
                                        fullWidth
                                        onChange={(value) => value && setChatId(String(value))}
                                        value={chatId}
                                        variant="secondary"
                                    >
                                        <Label>Chat</Label>
                                        <Select.Trigger>
                                            <Select.Value>
                                                {selectedChat?.label ?? 'Choose a chat'}
                                            </Select.Value>
                                            <Select.Indicator />
                                        </Select.Trigger>
                                        <Select.Popover>
                                            <ListBox>
                                                {chats.map((chat) => (
                                                    <ListBox.Item
                                                        id={chat.id}
                                                        key={chat.id}
                                                        textValue={chat.label}
                                                    >
                                                        <Label>{chat.label}</Label>
                                                        <ListBox.ItemIndicator />
                                                    </ListBox.Item>
                                                ))}
                                            </ListBox>
                                        </Select.Popover>
                                    </Select>
                                    <TextField
                                        fullWidth
                                        onChange={setBody}
                                        value={body}
                                        variant="secondary"
                                    >
                                        <Label>Task</Label>
                                        <TextArea
                                            autoFocus
                                            placeholder="What needs to be done?"
                                            rows={4}
                                        />
                                    </TextField>
                                    {create.error ? (
                                        <p className="text-danger text-sm" role="alert">
                                            {create.error.message}
                                        </p>
                                    ) : null}
                                </div>
                            </Modal.Body>
                            <Modal.Footer>
                                <Button slot="close" type="button" variant="secondary">
                                    Cancel
                                </Button>
                                <Button
                                    isDisabled={!(body.trim() && chatId)}
                                    isPending={create.isPending}
                                    type="submit"
                                >
                                    Create Task
                                </Button>
                            </Modal.Footer>
                        </Form>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
