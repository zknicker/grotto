import * as React from 'react';

const chatComposerMentionEventName = 'grotto:chat-composer-mention-request';

export interface ChatComposerMentionRequest {
    agentId: string;
    composerId: string;
}

export function requestChatComposerMention(request: ChatComposerMentionRequest) {
    window.dispatchEvent(new CustomEvent(chatComposerMentionEventName, { detail: request }));
}

export function useChatComposerMentionRequest(
    composerId: null | string,
    mention: (request: ChatComposerMentionRequest) => void
) {
    React.useEffect(() => {
        if (!composerId) {
            return;
        }

        const listener = (event: Event) => {
            const request = matchChatComposerMentionRequest(
                (event as CustomEvent<unknown>).detail,
                composerId
            );
            if (request) {
                mention(request);
            }
        };

        window.addEventListener(chatComposerMentionEventName, listener);
        return () => window.removeEventListener(chatComposerMentionEventName, listener);
    }, [composerId, mention]);
}

export function matchChatComposerMentionRequest(
    detail: unknown,
    composerId: string
): ChatComposerMentionRequest | null {
    if (!(detail && typeof detail === 'object')) {
        return null;
    }

    const request = detail as Partial<ChatComposerMentionRequest>;
    return request.composerId === composerId &&
        typeof request.agentId === 'string' &&
        request.agentId.length > 0
        ? { agentId: request.agentId, composerId }
        : null;
}
