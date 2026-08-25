import * as React from 'react';

const SINGLE_LINE_HEIGHT_MULTIPLIER = 1.5;

export function useCompactComposerLayout() {
    const editorSlotRef = React.useRef<HTMLDivElement | null>(null);
    const [isMultiline, setIsMultiline] = React.useState(false);

    React.useEffect(() => {
        let observer: ResizeObserver | null = null;
        const frame = requestAnimationFrame(() => {
            const editor = editorSlotRef.current?.querySelector<HTMLElement>('[role="textbox"]');

            if (!editor || typeof ResizeObserver !== 'function') {
                return;
            }

            const update = () => {
                setIsMultiline(isComposerEditorMultiline(editor));
            };

            observer = new ResizeObserver(update);
            observer.observe(editor);
            update();
        });

        return () => {
            cancelAnimationFrame(frame);
            observer?.disconnect();
        };
    }, []);

    return { editorSlotRef, isMultiline };
}

export function composerEditorHeightIsMultiline({
    height,
    lineHeight,
}: {
    height: number;
    lineHeight: number;
}) {
    // An inline mention chip is slightly taller than the text line. Leave
    // enough headroom for that adornment without mistaking it for a wrap.
    return height > lineHeight * SINGLE_LINE_HEIGHT_MULTIPLIER;
}

function isComposerEditorMultiline(editor: HTMLElement) {
    const lineHeight = Number.parseFloat(getComputedStyle(editor).lineHeight);

    return (
        Number.isFinite(lineHeight) &&
        composerEditorHeightIsMultiline({ height: editor.scrollHeight, lineHeight })
    );
}
