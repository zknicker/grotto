import type { Chat } from '@tavern/api';
import { threadAnchorShortId } from '../../chats/thread/thread-target.ts';
import type { HumanDirectory } from '../human-identity.ts';

export function threadTitles(chat: Chat, anchorMessageId: string, humans: HumanDirectory) {
    const anchorReference = threadAnchorShortId(anchorMessageId);

    if (chat.kind === 'dm') {
        const peer = chat.peerAgentDisplayName ?? humans.name(chat.peerUserId);
        return {
            header: `Thread — ${peer}`,
            target: `dm:@${peer}:${anchorReference}`,
        };
    }

    return {
        header: `Thread — #${chat.name}`,
        target: `#${chat.name}:${anchorReference}`,
    };
}
