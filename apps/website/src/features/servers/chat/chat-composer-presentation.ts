export function resolveChatComposerPlaceholder(chatName: string, override?: string) {
    return override ?? `Message ${chatName}`;
}

export function hasChatComposerPayload({
    attachmentCount,
    content,
}: {
    attachmentCount: number;
    content: string;
}) {
    return content.trim().length > 0 || attachmentCount > 0;
}
