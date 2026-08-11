import type { HostedChat } from '@tavern/api';

export function resolveChatPageChat(input: {
    detail: HostedChat | undefined;
    isPending: boolean;
    listed: HostedChat | undefined;
}) {
    return input.detail ?? (input.isPending ? input.listed : undefined);
}
