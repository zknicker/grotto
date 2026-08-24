import type { Chat } from '@grotto/api';
import { threadAnchorShortId } from '../../chats/thread/thread-target.ts';
import type { HumanDirectory } from '../human-identity.ts';

export function threadTitles(chat: Chat, anchorMessageId: string, humans: HumanDirectory) {
    const anchorReference = threadAnchorShortId(anchorMessageId);

    if (chat.kind === 'dm') {
        const peer = chat.peerAgentDisplayName ?? humans.name(chat.peerUserId);
        return {
            context: `@${peer}`,
            header: `Thread — ${peer}`,
            target: `dm:@${peer}:${anchorReference}`,
        };
    }

    return {
        context: `#${chat.name}`,
        header: `Thread — #${chat.name}`,
        target: `#${chat.name}:${anchorReference}`,
    };
}
