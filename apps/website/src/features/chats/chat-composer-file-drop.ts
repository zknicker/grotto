import * as React from 'react';

type ComposerFileDropTarget = 'main' | 'self';

interface FileTransferLike {
    types: Iterable<string> | ArrayLike<string>;
}

export function hasFileTransfer(dataTransfer: FileTransferLike) {
    return Array.from(dataTransfer.types).includes('Files');
}

export function useComposerFileDrop({
    disabled,
    onFiles,
    target = 'self',
}: {
    disabled: boolean;
    onFiles: (files: File[]) => Promise<void> | void;
    target?: ComposerFileDropTarget;
}) {
    const onFilesRef = React.useRef(onFiles);
    const dragDepthRef = React.useRef(0);
    const [isFileDropActive, setIsFileDropActive] = React.useState(false);

    React.useEffect(() => {
        onFilesRef.current = onFiles;
    }, [onFiles]);

    const resetDrag = React.useCallback(() => {
        dragDepthRef.current = 0;
        setIsFileDropActive(false);
    }, []);

    React.useEffect(() => {
        if (disabled) {
            resetDrag();
        }
    }, [disabled, resetDrag]);

    React.useEffect(() => {
        if (!isFileDropActive) {
            return;
        }

        window.addEventListener('dragend', resetDrag);
        window.addEventListener('drop', resetDrag);

        return () => {
            window.removeEventListener('dragend', resetDrag);
            window.removeEventListener('drop', resetDrag);
        };
    }, [isFileDropActive, resetDrag]);

    React.useEffect(() => {
        if (target !== 'main') {
            return;
        }

        const element = document.querySelector<HTMLElement>('[data-slot="chat-surface"]');

        if (!element) {
            return;
        }

        const handleDragEnter = (event: DragEvent) => {
            if (!isFileDragEvent(event)) {
                return;
            }

            event.preventDefault();

            if (disabled) {
                return;
            }

            dragDepthRef.current += 1;
            setIsFileDropActive(true);
        };

        const handleDragOver = (event: DragEvent) => {
            if (!isFileDragEvent(event)) {
                return;
            }

            event.preventDefault();

            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
            }

            if (disabled) {
                return;
            }

            if (!isEventInsideElement(event, element)) {
                resetDrag();
                return;
            }

            setIsFileDropActive(true);
        };

        const handleDragLeave = (event: DragEvent) => {
            if (!isFileDragEvent(event) || isEventInsideElement(event, element)) {
                return;
            }

            resetDrag();
        };

        const handleDrop = (event: DragEvent) => {
            if (!isFileDragEvent(event)) {
                return;
            }

            event.preventDefault();
            resetDrag();

            if (disabled || !event.dataTransfer) {
                return;
            }

            const files = Array.from(event.dataTransfer.files);

            if (files.length > 0) {
                void onFilesRef.current(files);
            }
        };

        element.addEventListener('dragenter', handleDragEnter);
        element.addEventListener('dragover', handleDragOver);
        element.addEventListener('dragleave', handleDragLeave);
        element.addEventListener('drop', handleDrop);

        return () => {
            element.removeEventListener('dragenter', handleDragEnter);
            element.removeEventListener('dragover', handleDragOver);
            element.removeEventListener('dragleave', handleDragLeave);
            element.removeEventListener('drop', handleDrop);
        };
    }, [disabled, resetDrag, target]);

    const handleDragEnter = React.useCallback(
        (event: React.DragEvent<HTMLElement>) => {
            if (!hasFileTransfer(event.dataTransfer)) {
                return;
            }

            event.preventDefault();

            if (disabled) {
                return;
            }

            dragDepthRef.current += 1;
            setIsFileDropActive(true);
        },
        [disabled]
    );

    const handleDragOver = React.useCallback(
        (event: React.DragEvent<HTMLElement>) => {
            if (!hasFileTransfer(event.dataTransfer)) {
                return;
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';

            if (disabled) {
                return;
            }

            setIsFileDropActive(true);
        },
        [disabled]
    );

    const handleDragLeave = React.useCallback((event: React.DragEvent<HTMLElement>) => {
        if (!hasFileTransfer(event.dataTransfer)) {
            return;
        }

        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

        if (dragDepthRef.current === 0) {
            setIsFileDropActive(false);
        }
    }, []);

    const handleDrop = React.useCallback(
        (event: React.DragEvent<HTMLElement>) => {
            if (!hasFileTransfer(event.dataTransfer)) {
                return;
            }

            event.preventDefault();
            resetDrag();

            if (disabled) {
                return;
            }

            const files = Array.from(event.dataTransfer.files);

            if (files.length > 0) {
                void onFilesRef.current(files);
            }
        },
        [disabled, resetDrag]
    );

    return {
        isFileDropActive,
        onDragEnter: handleDragEnter,
        onDragLeave: handleDragLeave,
        onDragOver: handleDragOver,
        onDrop: handleDrop,
    };
}

function isFileDragEvent(event: DragEvent) {
    return event.dataTransfer ? hasFileTransfer(event.dataTransfer) : false;
}

function isEventInsideElement(event: DragEvent, element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
    );
}
