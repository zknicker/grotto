export function resolveChatComposerPlaceholder(chatName: string, override?: string) {
    return override ?? `Message ${chatName}`;
}
