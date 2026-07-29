import { getChatDisplayTitle } from '../../components/chats/chat-display.ts';
import { ChatTitle } from '../../components/chats/chat-title.tsx';
import { ChatTypeBadge } from '../../components/chats/chat-type-badge.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import type { ChatListItem } from './chat-list-data.ts';

export function ChatCardHeader({
    chat,
    onArchive,
    onEdit,
}: {
    chat: ChatListItem;
    onArchive?: (() => void) | null;
    onEdit?: (() => void) | null;
}) {
    const title = getChatDisplayTitle(chat);

    return (
        <div className="border-border border-b bg-chrome">
            <div className="flex items-center gap-3 px-3 py-4">
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2.5">
                            <h2
                                className="min-w-0 truncate font-semibold text-foreground text-lg leading-none tracking-tight"
                                title={title}
                            >
                                <ChatTitle chat={chat} />
                            </h2>
                            <ChatTypeBadge
                                chat={chat}
                                className="shrink-0 self-center"
                                showDetail={false}
                            />
                        </div>
                        {chat.latestSession?.sessionKey ? (
                            <p
                                className="mt-1 truncate font-mono text-foreground-tertiary text-meta"
                                title={chat.latestSession.sessionKey}
                            >
                                {chat.latestSession.sessionKey}
                            </p>
                        ) : null}
                    </div>
                    {chat.isDisabled ? <Badge variant="secondary">Disabled</Badge> : null}
                </div>
                {onEdit || onArchive ? (
                    <div className="ml-2 flex shrink-0 items-center gap-1">
                        {onEdit ? (
                            <Button onClick={onEdit} size="sm" type="button" variant="ghost">
                                Edit
                            </Button>
                        ) : null}
                        {onArchive ? (
                            <Button onClick={onArchive} size="sm" type="button" variant="ghost">
                                Archive
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </div>
            {chat.agentRuntimeSyncLabel ? (
                <div className="border-border-subtle border-t px-3 py-2 text-meta text-muted-foreground">
                    {chat.agentRuntimeSyncLabel}
                </div>
            ) : null}
        </div>
    );
}
