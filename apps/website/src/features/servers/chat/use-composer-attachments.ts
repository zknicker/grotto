import * as React from 'react';
import { attachmentMaxSizeBytes } from '../../../hooks/servers/use-upload-server-attachment.ts';

export interface ComposerAttachment {
    file: File;
    nonce: string;
    previewUrl?: string;
}

export function useComposerAttachments() {
    const [attachments, setAttachments] = React.useState<ComposerAttachment[]>([]);
    const [error, setError] = React.useState<string | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const attachmentsRef = React.useRef(attachments);
    attachmentsRef.current = attachments;

    React.useEffect(
        () => () => {
            for (const attachment of attachmentsRef.current) {
                revokePreview(attachment);
            }
        },
        []
    );

    const add = React.useCallback((files: File[]) => {
        const oversized = files.find((file) => file.size > attachmentMaxSizeBytes);
        if (oversized) {
            setError(`${oversized.name} exceeds the 50 MiB attachment limit.`);
            if (inputRef.current) {
                inputRef.current.value = '';
            }
            return;
        }
        setError(null);
        setAttachments((current) => [...current, ...files.map(createAttachment)]);
    }, []);

    const remove = React.useCallback((nonce: string) => {
        setAttachments((current) => {
            const removed = current.find((item) => item.nonce === nonce);
            if (removed) {
                revokePreview(removed);
            }
            return current.filter((item) => item.nonce !== nonce);
        });
    }, []);

    const clear = React.useCallback(() => {
        setAttachments((current) => {
            for (const attachment of current) {
                revokePreview(attachment);
            }
            return [];
        });
        setError(null);
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    }, []);

    return { add, attachments, clear, error, inputRef, remove };
}

function createAttachment(file: File): ComposerAttachment {
    return {
        file,
        nonce: crypto.randomUUID(),
        ...(file.type.startsWith('image/') ? { previewUrl: URL.createObjectURL(file) } : {}),
    };
}

function revokePreview(attachment: ComposerAttachment) {
    if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
    }
}
