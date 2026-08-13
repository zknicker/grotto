import type { Chat } from '@tavern/api';

export function resolveChatPageChat(input: {
    detail: Chat | undefined;
    isPending: boolean;
    listed: Chat | undefined;
}) {
    return input.detail ?? (input.isPending ? input.listed : undefined);
}
