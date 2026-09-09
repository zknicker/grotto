import * as React from 'react';

export function useVisibleChatSequence(chatId: string) {
    const [state, setState] = React.useState<{ chatId: string; sequence: number | undefined }>({
        chatId,
        sequence: undefined,
    });
    const onSequenceChange = React.useCallback(
        (sequence: number | undefined) => {
            setState((current) =>
                current.chatId === chatId && current.sequence === sequence
                    ? current
                    : { chatId, sequence }
            );
        },
        [chatId]
    );

    return {
        onSequenceChange,
        sequence: state.chatId === chatId ? state.sequence : undefined,
    };
}
