import { Drawer } from '@heroui/react';
import { useChatTool } from '../../../hooks/chats/use-chat-tool.ts';
import { useSessionTool } from '../../../hooks/sessions/use-session-tool.ts';
import type { ChatToolOutput, SessionToolOutput } from '../../../lib/trpc.tsx';
import { ToolDrawerBody } from './tool-drawer-body.tsx';
import { buildToolDrawerCall } from './tool-drawer-call.ts';
import { ToolDrawerHeader } from './tool-drawer-header.tsx';

type ToolDrawerProps = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
} & (
    | { activityId: string; chatId: string; source: 'chat' }
    | { sessionKey: string; source: 'session'; toolCallId: string }
);

export function ToolDrawer(props: ToolDrawerProps) {
    if (props.source === 'session') {
        return <SessionToolDrawer {...props} />;
    }

    return <ChatToolDrawer {...props} />;
}

function ChatToolDrawer({
    activityId,
    chatId,
    isOpen,
    onOpenChange,
}: Extract<ToolDrawerProps, { source: 'chat' }>) {
    const toolQuery = useChatTool(
        {
            activityId,
            chatId,
        },
        {
            enabled: isOpen,
        }
    );
    const details: ChatToolOutput | null = toolQuery.data ?? null;

    return (
        <ToolDrawerShell
            details={details}
            isOpen={isOpen}
            isPending={toolQuery.isPending}
            onOpenChange={onOpenChange}
            queryError={!toolQuery.isPending && Boolean(toolQuery.error || !details)}
        />
    );
}

function SessionToolDrawer({
    isOpen,
    onOpenChange,
    sessionKey,
    toolCallId,
}: Extract<ToolDrawerProps, { source: 'session' }>) {
    const toolQuery = useSessionTool(
        {
            sessionKey,
            toolCallId,
        },
        {
            enabled: isOpen,
        }
    );
    const details: SessionToolOutput | null = toolQuery.data ?? null;

    return (
        <ToolDrawerShell
            details={details}
            isOpen={isOpen}
            isPending={toolQuery.isPending}
            onOpenChange={onOpenChange}
            queryError={!toolQuery.isPending && Boolean(toolQuery.error || !details)}
        />
    );
}

function ToolDrawerShell({
    details,
    isOpen,
    isPending,
    onOpenChange,
    queryError,
}: {
    details: ChatToolOutput | SessionToolOutput | null;
    isOpen: boolean;
    isPending: boolean;
    onOpenChange: (isOpen: boolean) => void;
    queryError: boolean;
}) {
    return (
        <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Drawer.Content placement="right">
                {/* The header supplies the accessible name once details land; until
                    then the dialog names itself. */}
                <Drawer.Dialog aria-label={details ? undefined : 'Tool details'}>
                    <Drawer.CloseTrigger />
                    {details ? <ToolDrawerHeader call={buildToolDrawerCall(details)} /> : null}
                    <Drawer.Body>
                        <ToolDrawerBody
                            details={details}
                            isPending={isPending}
                            queryError={queryError}
                        />
                    </Drawer.Body>
                </Drawer.Dialog>
            </Drawer.Content>
        </Drawer.Backdrop>
    );
}
