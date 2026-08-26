import * as React from 'react';

const SINGLE_LINE_HEIGHT_MULTIPLIER = 1.5;
const COMPOSER_LAYOUT_MOTION_DURATION_MS = 100;

export function useCompactComposerLayout({
    content,
    isForcedExpanded,
}: {
    content: string;
    isForcedExpanded: boolean;
}) {
    const editorSlotRef = React.useRef<HTMLDivElement | null>(null);
    const compactEditorWidthRef = React.useRef<number | null>(null);
    const contentRef = React.useRef(content);
    const isForcedExpandedRef = React.useRef(isForcedExpanded);
    const isExpandedRef = React.useRef(isForcedExpanded);
    const editorMotionOriginRef = React.useRef<DOMRect | null>(null);
    const editorMotionRef = React.useRef<Animation | null>(null);
    const updateRef = React.useRef<
        ((nextContent: string, nextIsForcedExpanded: boolean) => void) | null
    >(null);
    const [isExpanded, setIsExpanded] = React.useState(isForcedExpanded);

    contentRef.current = content;
    isForcedExpandedRef.current = isForcedExpanded;

    React.useEffect(() => {
        let observer: ResizeObserver | null = null;
        const frame = requestAnimationFrame(() => {
            const editor = editorSlotRef.current?.querySelector<HTMLElement>('[role="textbox"]');

            if (!editor || typeof ResizeObserver !== 'function') {
                return;
            }

            const update = (nextContent: string, nextIsForcedExpanded: boolean) => {
                const current = isExpandedRef.current;

                if (!(current || nextIsForcedExpanded)) {
                    const width = editor.getBoundingClientRect().width;

                    if (width > 0) {
                        compactEditorWidthRef.current = width;
                    }
                }

                const compactWidth = compactEditorWidthRef.current;
                const isMultiline =
                    current && compactWidth
                        ? isComposerEditorMultilineAtWidth(editor, compactWidth)
                        : isComposerEditorMultiline(editor);
                const next = resolveCompactComposerExpansion({
                    hasText: nextContent.length > 0,
                    isForcedExpanded: nextIsForcedExpanded,
                    isMultiline,
                });

                if (next === current) {
                    return;
                }

                editorMotionOriginRef.current =
                    editorSlotRef.current?.getBoundingClientRect() ?? null;
                isExpandedRef.current = next;
                setIsExpanded(next);
            };

            updateRef.current = update;
            observer = new ResizeObserver(() =>
                update(contentRef.current, isForcedExpandedRef.current)
            );
            observer.observe(editor);
            update(contentRef.current, isForcedExpandedRef.current);
        });

        return () => {
            cancelAnimationFrame(frame);
            observer?.disconnect();
            updateRef.current = null;
        };
    }, []);

    React.useEffect(() => {
        const frame = requestAnimationFrame(() => updateRef.current?.(content, isForcedExpanded));

        return () => cancelAnimationFrame(frame);
    }, [content, isForcedExpanded]);

    React.useLayoutEffect(() => {
        const editorSlot = editorSlotRef.current;
        const origin = editorMotionOriginRef.current;
        editorMotionOriginRef.current = null;

        if (
            !(editorSlot && origin) ||
            isExpanded !== isExpandedRef.current ||
            prefersReducedMotion()
        ) {
            return;
        }

        editorMotionRef.current?.cancel();
        const destination = editorSlot.getBoundingClientRect();
        const delta = composerEditorMotionDelta({ destination, origin });

        if (delta.x === 0 && delta.y === 0) {
            return;
        }

        const easing =
            getComputedStyle(editorSlot).getPropertyValue('--ease-out').trim() ||
            'cubic-bezier(0, 0, 0.2, 1)';
        const motion = editorSlot.animate(
            [
                { transform: `translate3d(${delta.x}px, ${delta.y}px, 0)` },
                { transform: 'translate3d(0, 0, 0)' },
            ],
            {
                duration: COMPOSER_LAYOUT_MOTION_DURATION_MS,
                easing,
            }
        );

        editorMotionRef.current = motion;
        motion.addEventListener('finish', () => {
            if (editorMotionRef.current === motion) {
                editorMotionRef.current = null;
            }
        });

        return () => motion.cancel();
    }, [isExpanded]);

    return {
        editorSlotRef,
        isExpanded,
    };
}

export function composerEditorMotionDelta({
    destination,
    origin,
}: {
    destination: Pick<DOMRect, 'left' | 'top'>;
    origin: Pick<DOMRect, 'left' | 'top'>;
}) {
    return {
        x: origin.left - destination.left,
        y: origin.top - destination.top,
    };
}

export function resolveCompactComposerExpansion({
    hasText,
    isForcedExpanded,
    isMultiline,
}: {
    hasText: boolean;
    isForcedExpanded: boolean;
    isMultiline: boolean;
}) {
    return isForcedExpanded || (hasText && isMultiline);
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

function isComposerEditorMultilineAtWidth(editor: HTMLElement, width: number) {
    const previousMaxWidth = editor.style.maxWidth;
    const previousMinWidth = editor.style.minWidth;
    const previousWidth = editor.style.width;

    editor.style.width = `${width}px`;
    editor.style.minWidth = `${width}px`;
    editor.style.maxWidth = `${width}px`;

    try {
        return isComposerEditorMultiline(editor);
    } finally {
        editor.style.width = previousWidth;
        editor.style.minWidth = previousMinWidth;
        editor.style.maxWidth = previousMaxWidth;
    }
}

function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
