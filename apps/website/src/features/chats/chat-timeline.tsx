import type * as React from 'react';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { ChatTranscript } from './chat-transcript.tsx';
import type { ConversationMessageLayout } from './chat-transcript-model.ts';

export function ChatTimeline({
    canRequestMention = true,
    chatId,
    conversationLayout,
    defaultOpenWorkGroups = false,
    rows,
    scrollContentRef,
    totalMessages,
}: {
    canRequestMention?: boolean;
    chatId?: string;
    conversationLayout?: ConversationMessageLayout;
    defaultOpenWorkGroups?: boolean;
    rows: NonNullable<ChatLogOutput>['rows'];
    scrollContentRef?: React.RefObject<HTMLDivElement | null>;
    totalMessages: number;
}) {
    const hiddenCount = Math.max(totalMessages - countDurableMessageRows(rows), 0);

    return (
        <ChatTranscript
            canRequestMention={canRequestMention}
            chatId={chatId}
            conversationLayout={conversationLayout}
            defaultOpenWorkGroups={defaultOpenWorkGroups}
            hiddenCount={hiddenCount}
            rows={rows}
            scrollContentRef={scrollContentRef}
        />
    );
}

// Activity-backed narration rows reuse the message row kind but are not
// durable chat messages, so they stay out of the hidden-history math.
function countDurableMessageRows(rows: NonNullable<ChatLogOutput>['rows']) {
    return rows.filter((row) => row.kind === 'message' && !row.id.startsWith('act_')).length;
}
