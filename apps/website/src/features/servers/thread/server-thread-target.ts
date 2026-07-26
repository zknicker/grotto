import type { HostedChat } from '@tavern/api';
import { threadAnchorShortId } from '../../chats/thread/thread-target.ts';

export function serverThreadTitles(chat: HostedChat, anchorMessageId: string) {
    const anchorReference = threadAnchorShortId(anchorMessageId);

    if (chat.kind === 'dm') {
        const peer = chat.peerUserId ? `Human ${chat.peerUserId.slice(-6)}` : 'Human';
        return {
            header: `Thread — @${peer}`,
            target: `dm:@${peer}:${anchorReference}`,
        };
    }

    return {
        header: `Thread — #${chat.name}`,
        target: `#${chat.name}:${anchorReference}`,
    };
}
