import type { Chat, ChatMessage, ThreadSummary } from '@grotto/api';
import { ChatSidePaneShell } from '../../chats/chat-side-pane-shell.tsx';
import type { GrottoResourceTarget } from '../../chats/grotto-resource-link.ts';
import { ThreadContent } from './thread-content.tsx';

export function ThreadPanel({
    active,
    anchor,
    canManage,
    chat,
    initialThreadChatId,
    onClose,
    onExitComplete,
    onOpenArtifact,
    onViewInChannel,
    readOnly,
    summary,
    takeover,
    turnDetailsAccess,
}: {
    active: boolean;
    anchor: ChatMessage;
    canManage: boolean;
    chat: Chat;
    initialThreadChatId?: string;
    onClose: () => void;
    onExitComplete: () => void;
    onOpenArtifact: (target: GrottoResourceTarget) => void;
    onViewInChannel: () => void;
    readOnly: boolean;
    summary: ThreadSummary | null;
    takeover: boolean;
    turnDetailsAccess: 'journal' | 'summary';
}) {
    return (
        <ChatSidePaneShell
            keepMounted
            label="Thread"
            onExitComplete={onExitComplete}
            open={active}
            takeover={takeover}
        >
            {(width) => (
                <ThreadContent
                    active={active}
                    anchor={anchor}
                    canManage={canManage}
                    chat={chat}
                    initialThreadChatId={initialThreadChatId}
                    key={anchor.id}
                    onClose={onClose}
                    onOpenArtifact={onOpenArtifact}
                    onViewInChannel={onViewInChannel}
                    readOnly={readOnly}
                    summary={summary}
                    takeover={takeover}
                    turnDetailsAccess={turnDetailsAccess}
                    width={width}
                />
            )}
        </ChatSidePaneShell>
    );
}
