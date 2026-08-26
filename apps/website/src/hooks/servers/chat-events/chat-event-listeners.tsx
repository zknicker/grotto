import { ChatEventStreamProvider } from './use-chat-event-stream.tsx';
import { useChatLifecycleEvents } from './use-chat-lifecycle-events.ts';
import { useChatReadEvents } from './use-chat-read-events.ts';
import { useMessageCreatedEvents } from './use-message-created-events.ts';
import { usePreparedActionEvents } from './use-prepared-action-events.ts';
import { useTaskChangeEvents } from './use-task-change-events.ts';
import { useTaskLabelEvents } from './use-task-label-events.ts';
import { useThreadFollowEvents } from './use-thread-follow-events.ts';

/**
 * Every Chat event listener on one Server, over one durable stream. Each hook
 * below owns exactly what its own event type refetches.
 */
export function ChatEventListeners({ serverId }: { serverId: string | undefined }) {
    return (
        <ChatEventStreamProvider serverId={serverId}>
            <ChatEventInvalidations />
        </ChatEventStreamProvider>
    );
}

function ChatEventInvalidations() {
    useMessageCreatedEvents();
    usePreparedActionEvents();
    useChatReadEvents();
    useChatLifecycleEvents();
    useThreadFollowEvents();
    useTaskChangeEvents();
    useTaskLabelEvents();

    // `reminder.changed` deliberately has no listener. This participant-gated
    // lane cannot see every reminder shown on an Agent profile.

    return null;
}
