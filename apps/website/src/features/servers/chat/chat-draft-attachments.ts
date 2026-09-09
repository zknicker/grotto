export interface ComposerAttachment {
    file: File;
    nonce: string;
    previewUrl?: string;
}

export function createComposerAttachment(file: File): ComposerAttachment {
    return {
        file,
        nonce: crypto.randomUUID(),
        ...(file.type.startsWith('image/') && typeof URL.createObjectURL === 'function'
            ? { previewUrl: URL.createObjectURL(file) }
            : {}),
    };
}

export function revokeComposerAttachment(attachment: ComposerAttachment) {
    if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
    }
}
