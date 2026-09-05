import { activeCloudAgentWorkThreadAnchor } from '@grotto/api';
import { useChats } from '../../hooks/servers/use-chats.ts';
import { useActiveCloudAgentWork } from '../../hooks/servers/use-cloud-agent-work.ts';
import { useServerContext } from '../servers/server-context.ts';
import { ThreadPeekDialog } from '../servers/thread/thread-peek-dialog.tsx';
import { useCloudAgentWorkView } from './use-cloud-agent-work-view.ts';

/**
 * The Cloud Agent work peek: opening a work row shows its conversation over
 * the page it was opened from, rather than navigating into the Chat.
 * `?work=<messageId>` owns which one is open.
 *
 * The Thread is anchored on the Message it hangs off, which for work launched
 * inside a Thread is that Thread's own anchor rather than the work Message.
 */
export function CloudAgentWorkDialog() {
    const { server } = useServerContext();
    const { closeWork, openWorkId } = useCloudAgentWorkView();
    const active = useActiveCloudAgentWork(server.id);
    const chats = useChats(server.id);
    const item = openWorkId
        ? active.data?.find((candidate) => candidate.work.messageId === openWorkId)
        : undefined;
    const chat = item
        ? chats.data?.find((candidate) => candidate.id === item.conversationChatId)
        : undefined;

    if (!(item && chat)) {
        return null;
    }

    return (
        <ThreadPeekDialog
            anchor={activeCloudAgentWorkThreadAnchor(item)}
            ariaLabel={`Cloud Agent work: ${item.work.title}`}
            chat={chat}
            headerTitle={item.work.title}
            initialThreadChatId={item.threadChatId}
            onClose={closeWork}
            summary={null}
        />
    );
}
