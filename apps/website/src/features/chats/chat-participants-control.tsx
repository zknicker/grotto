import { UserMultiple02Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { useChatUpdate } from '../../hooks/chats/use-chat-update.ts';
import { ChannelDialog } from './channel-dialog.tsx';
import type { ChatListItem } from './chat-list-data.ts';

/**
 * Participants as a quiet toolbar control: a people glyph plus the member
 * count. On editable channels it opens the participants dialog; DMs render
 * it as a static count since their membership is fixed.
 */
export function ChatParticipantsControl({ chat }: { chat: ChatListItem }) {
    const editable = canEditChatParticipants(chat);
    const count = countChatParticipants(chat);

    if (count === 0) {
        return null;
    }

    if (!editable) {
        return <ParticipantsCount count={count} />;
    }

    return <ParticipantsEditButton chat={chat} count={count} />;
}

function ParticipantsCount({ count }: { count: number }) {
    return (
        <span
            className="flex h-7 shrink-0 items-center gap-1 px-1.5 text-muted-foreground"
            title={`${count} participants`}
        >
            <Icon className="size-[18px]" icon={UserMultiple02Icon} strokeWidth={1.8} />
            <span className="text-meta tabular-nums">{count}</span>
        </span>
    );
}

function ParticipantsEditButton({ chat, count }: { chat: ChatListItem; count: number }) {
    const agentsQuery = useAgentList();
    const updateChat = useChatUpdate();
    const [open, setOpen] = React.useState(false);

    return (
        <>
            <Button
                aria-label="Edit participants"
                className="gap-1 px-1.5 font-normal text-muted-foreground hover:text-foreground"
                onClick={() => {
                    updateChat.reset();
                    setOpen(true);
                }}
                size="sm"
                title="Edit participants"
                variant="ghost"
            >
                <Icon className="size-[18px]" icon={UserMultiple02Icon} strokeWidth={1.8} />
                <span className="text-meta tabular-nums">{count}</span>
            </Button>
            <ChannelDialog
                agents={agentsQuery.data?.agents ?? []}
                agentsPending={agentsQuery.isPending}
                errorMessage={updateChat.error?.message ?? null}
                initialAgentIds={chat.boundAgentIds}
                initialDisplayName={chat.displayName}
                isPending={updateChat.isPending}
                onClose={() => {
                    updateChat.reset();
                    setOpen(false);
                }}
                onSubmit={async (input) => {
                    await updateChat.mutateAsync({
                        agentIds: input.agentIds,
                        chatId: chat.id,
                        displayName: chat.displayName,
                    });
                    setOpen(false);
                }}
                open={open}
                showDisplayName={false}
                submitLabel="Save"
                title="Channel participants"
            />
        </>
    );
}

export function canEditChatParticipants(chat: Pick<ChatListItem, 'conversationKind' | 'type'>) {
    return chat.type === 'tavern' && chat.conversationKind === 'channel';
}

function countChatParticipants(chat: ChatListItem) {
    if (chat.participants.length > 0) {
        return chat.participants.length;
    }

    return chat.targetParticipant ? 1 : 0;
}
