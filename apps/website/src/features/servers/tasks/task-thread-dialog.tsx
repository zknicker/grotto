import { Modal } from '@heroui/react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useChats } from '../../../hooks/servers/use-chats.ts';
import { useTasks } from '../../../hooks/servers/use-tasks.ts';
import { useServerContext } from '../server-context.ts';
import { serverChatRoute } from '../server-routes.ts';
import { ThreadContent } from '../thread/thread-content.tsx';
import { useTaskView } from './task-view.ts';

/**
 * Raft-style task peek: opening a task from the Board or List lenses shows
 * its Thread work surface in a dialog over the tasks page instead of
 * navigating into the parent Chat. `?task=<messageId>` owns the open task, so
 * deep links and Back work. "View in chat" (and artifact opens, which are
 * chat-scoped) still navigate to the parent Chat.
 */
export function TaskThreadDialog() {
    const navigate = useNavigate();
    const { server } = useServerContext();
    const { closeTask, openTaskId } = useTaskView();
    const tasks = useTasks(server.id);
    const chats = useChats(server.id);
    const item = openTaskId
        ? tasks.data?.find((candidate) => candidate.task.messageId === openTaskId)
        : undefined;
    const chat = item
        ? chats.data?.find((candidate) => candidate.id === item.task.chatId)
        : undefined;
    // The task-list message may omit the task projection; the Thread's
    // metadata section keys off `anchor.task`, so attach it explicitly.
    const anchor = React.useMemo(
        () => (item ? { ...item.message, task: item.task } : null),
        [item]
    );

    if (!(item && chat && anchor)) {
        return null;
    }

    const openParentChat = () => {
        closeTask();
        navigate(serverChatRoute(server.slug, chat.id));
    };
    const readOnly = (chat.kind === 'dm' && chat.peerAgentRetired) || chat.archivedAt !== null;

    return (
        <Modal.Backdrop
            isDismissable
            isOpen
            onOpenChange={(open) => {
                if (!open) {
                    closeTask();
                }
            }}
        >
            <Modal.Container placement="center" size="lg">
                <Modal.Dialog
                    aria-label={`Task #${item.task.number} thread`}
                    // A fixed height: the transcript scrolls inside it, so the
                    // dialog does not resize as replies load or arrive. Capped
                    // in rem so it stays proportionate on tall displays.
                    className="flex h-[min(85vh,44rem)] max-w-3xl flex-col overflow-hidden p-0"
                >
                    <ThreadContent
                        active
                        anchor={anchor}
                        canManage={server.role === 'owner' || server.role === 'admin'}
                        chat={chat}
                        composerVariant="secondary"
                        headerTitle={`Task #${item.task.number}`}
                        initialThreadChatId={item.task.threadChatId}
                        key={anchor.id}
                        onClose={closeTask}
                        onOpenArtifact={openParentChat}
                        onViewInChannel={openParentChat}
                        readOnly={readOnly}
                        summary={item.threadSummary}
                        takeover={false}
                        turnDetailsAccess={server.role === 'member' ? 'summary' : 'journal'}
                        width={null}
                    />
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
