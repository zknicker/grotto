import * as React from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import { Textarea } from '../../../components/ui/textarea.tsx';
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

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent showCloseButton={false}>
                <Form className="contents" onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>New task</DialogTitle>
                        <DialogDescription>
                            Create a message and use its Thread as the task work surface.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogPanel className="grid gap-4">
                        <Field>
                            <FieldLabel>Chat</FieldLabel>
                            <Select
                                onValueChange={(value) => value && setChatId(value)}
                                value={chatId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose a chat" />
                                </SelectTrigger>
                                <SelectContent>
                                    {chats.map((chat) => (
                                        <SelectItem key={chat.id} value={chat.id}>
                                            {chat.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field>
                            <FieldLabel>Task</FieldLabel>
                            <Textarea
                                autoFocus
                                onChange={(event) => setBody(event.target.value)}
                                placeholder="What needs to be done?"
                                rows={4}
                                value={body}
                            />
                        </Field>
                        {create.error ? (
                            <p className="text-destructive text-sm" role="alert">
                                {create.error.message}
                            </p>
                        ) : null}
                    </DialogPanel>
                    <DialogFooter variant="bare">
                        <Button onClick={() => onOpenChange(false)} size="sm" variant="ghost">
                            Cancel
                        </Button>
                        <Button
                            disabled={!(body.trim() && chatId)}
                            loading={create.isPending}
                            size="sm"
                            type="submit"
                        >
                            Create task
                        </Button>
                    </DialogFooter>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
