import { Button, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import * as React from 'react';
import { useChats } from '../../../hooks/servers/use-chats.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { useHostedServerContext } from '../hosted-server-context.ts';
import { NewTaskDialog } from './new-task-dialog.tsx';
import { taskChatOptions } from './task-model.ts';
import { useTaskView } from './task-view.ts';

export function TaskControls({ chatId }: { chatId?: string }) {
    const { server } = useHostedServerContext();
    const chats = useChats(server.id);
    const humans = useHumanDirectory(server.id);
    const { layout, setLayout } = useTaskView();
    const [composeOpen, setComposeOpen] = React.useState(false);
    const scopedChats = chatId
        ? (chats.data?.filter((chat) => chat.id === chatId) ?? [])
        : (chats.data ?? []);
    const chatOptions = taskChatOptions(scopedChats, humans);

    return (
        <>
            <ToggleButtonGroup
                aria-label="Task layout"
                disallowEmptySelection
                onSelectionChange={(keys) => {
                    const [next] = [...keys];
                    if (next === 'board' || next === 'list') {
                        setLayout(next);
                    }
                }}
                selectedKeys={[layout]}
                selectionMode="single"
                size="sm"
            >
                <ToggleButton id="board">Board</ToggleButton>
                <ToggleButton id="list">List</ToggleButton>
            </ToggleButtonGroup>
            <Button
                isDisabled={chatOptions.length === 0}
                onPress={() => setComposeOpen(true)}
                size="sm"
            >
                New Task
            </Button>
            <NewTaskDialog
                chats={chatOptions}
                onOpenChange={setComposeOpen}
                open={composeOpen}
                serverId={server.id}
            />
        </>
    );
}
