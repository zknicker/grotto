import type { HostedChat } from '@tavern/api';
import { useEnsureServerDm } from '../../hooks/servers/use-ensure-server-dm.ts';
import { useMarkServerChatReadOnView } from '../../hooks/servers/use-mark-server-chat-read.ts';
import { useServerChatMessages } from '../../hooks/servers/use-server-chat-messages.ts';
import { ServerChatComposer } from './server-chat-composer.tsx';
import { ServerChatTranscript } from './server-chat-transcript.tsx';

export function ServerChat({
    chat,
    onOpenChat,
}: {
    chat: HostedChat;
    onOpenChat: (chatId: string) => void;
}) {
    const messages = useServerChatMessages(chat.serverId, chat.id);
    const lastSequence = messages.data?.messages.at(-1)?.sequence ?? 0;
    const read = useMarkServerChatReadOnView({
        chatId: messages.data ? chat.id : undefined,
        sequence: messages.data ? lastSequence : undefined,
        serverId: messages.data ? chat.serverId : undefined,
    });
    const ensureDm = useEnsureServerDm(onOpenChat);
    const chatName =
        chat.kind === 'channel' ? `#${chat.name}` : `Direct · ${shortUserId(chat.peerUserId)}`;

    return (
        <section aria-label={chatName} className="flex min-h-0 flex-1 flex-col">
            <h2 className="border-border border-b px-6 py-3 text-foreground text-sm">{chatName}</h2>
            <div className="min-h-0 flex-1">
                <ServerChatTranscript
                    messages={messages.data?.messages}
                    onStartDm={(peerUserId) =>
                        ensureDm.mutate({ peerUserId, serverId: chat.serverId })
                    }
                />
            </div>
            {ensureDm.error ? (
                <p className="px-9 text-destructive text-xs">{ensureDm.error.message}</p>
            ) : null}
            <p
                className="mx-auto w-full max-w-[60rem] px-9 text-muted-foreground text-xs"
                data-testid="read-state"
            >
                {read.data ? `Read through ${read.data.sequence}` : ''}
            </p>
            <ServerChatComposer chatId={chat.id} chatName={chatName} serverId={chat.serverId} />
        </section>
    );
}

function shortUserId(userId: string | null) {
    return userId ? `Human ${userId.slice(-6)}` : 'Human';
}
