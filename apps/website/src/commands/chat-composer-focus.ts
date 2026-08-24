import * as React from 'react';

const chatComposerFocusEventName = 'grotto:chat-composer-focus-request';

export function requestChatComposerFocus() {
    window.dispatchEvent(new Event(chatComposerFocusEventName));
}

export function useChatComposerFocusRequest(enabled: boolean, focusTextEditor: () => void) {
    React.useEffect(() => {
        if (!enabled) {
            return;
        }

        const listener = () => {
            requestAnimationFrame(focusTextEditor);
        };

        window.addEventListener(chatComposerFocusEventName, listener);
        return () => window.removeEventListener(chatComposerFocusEventName, listener);
    }, [enabled, focusTextEditor]);
}
