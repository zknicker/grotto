import type * as React from 'react';

interface ChatComposerKeyInput {
    ctrlKey?: boolean;
    key: string;
    metaKey?: boolean;
    nativeEvent?: {
        isComposing?: boolean;
    };
    shiftKey?: boolean;
}

interface LineBreakInput {
    selectionEnd: number;
    selectionStart: number;
    value: string;
}

interface LineBreakUpdate {
    selection: number;
    value: string;
}

export function shouldSubmitChatComposerKey(event: ChatComposerKeyInput) {
    return (
        event.key === 'Enter' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.nativeEvent?.isComposing
    );
}

export function shouldInsertChatComposerLineBreak(event: ChatComposerKeyInput) {
    return event.key === 'Enter' && Boolean(event.shiftKey) && !event.nativeEvent?.isComposing;
}

export function getChatComposerLineBreakUpdate({
    selectionEnd,
    selectionStart,
    value,
}: LineBreakInput): LineBreakUpdate {
    const start = clampSelection(selectionStart, value);
    const end = clampSelection(selectionEnd, value);
    const rangeStart = Math.min(start, end);
    const rangeEnd = Math.max(start, end);
    const nextSelection = rangeStart + 1;

    return {
        selection: nextSelection,
        value: `${value.slice(0, rangeStart)}\n${value.slice(rangeEnd)}`,
    };
}

export function handleChatComposerKeyDown({
    event,
    onSubmit,
    onValueChange,
    value,
}: {
    event: React.KeyboardEvent<HTMLTextAreaElement>;
    onSubmit: () => void;
    onValueChange: (value: string) => void;
    value: string;
}) {
    if (shouldInsertChatComposerLineBreak(event)) {
        event.preventDefault();

        const textarea = event.currentTarget;
        const update = getChatComposerLineBreakUpdate({
            selectionEnd: textarea.selectionEnd,
            selectionStart: textarea.selectionStart,
            value,
        });

        onValueChange(update.value);
        requestAnimationFrame(() => {
            textarea.setSelectionRange(update.selection, update.selection);
        });
        return;
    }

    if (!shouldSubmitChatComposerKey(event)) {
        return;
    }

    event.preventDefault();
    onSubmit();
}

function clampSelection(selection: number, value: string) {
    return Math.min(Math.max(selection, 0), value.length);
}
