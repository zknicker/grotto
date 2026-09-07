import type * as React from 'react';
import { ChatTranscriptPresentation } from '../../chats/chat-transcript.tsx';
import { type ChatTranscriptInput, useChatTranscript } from './use-chat-transcript.tsx';

export { useChatTranscript } from './use-chat-transcript.tsx';

export function ChatTranscript({
    composition,
    scrollContentRef,
    ...input
}: ChatTranscriptInput & {
    composition?: React.ReactNode;
    scrollContentRef?: React.RefObject<HTMLDivElement | null>;
}) {
    const { downloadError, renderContext, rows } = useChatTranscript(input);

    if (!input.messages) {
        return null;
    }

    return (
        <ChatTranscriptPresentation
            composition={composition}
            leadingContent={
                downloadError ? (
                    <p className="px-2 text-danger text-sm">{downloadError}</p>
                ) : undefined
            }
            renderContext={renderContext}
            rows={rows}
            scrollContentRef={scrollContentRef}
        />
    );
}
