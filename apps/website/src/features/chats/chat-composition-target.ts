import {
    getChannelName,
    getDmPeerName,
    type ThreadTargetChat,
    threadPaneTitles,
} from './thread/thread-target.ts';

/**
 * The `haus message send --target <t>` grammar for a chat. Used to
 * scope an ephemeral `agent.composition` event to the chat it belongs to.
 * Null for chats the CLI target grammar cannot address (tasks).
 */
export function resolveChatCompositionTarget(
    chat: ThreadTargetChat & { id: string }
): string | null {
    if (chat.id.startsWith('cht_thr_')) {
        return threadPaneTitles(chat, `msg_${chat.id.slice('cht_thr_'.length)}`).target;
    }

    if (chat.conversationKind === 'direct' || chat.scope === 'dm') {
        return `dm:@${getDmPeerName(chat)}`;
    }

    if (chat.conversationKind === 'task' || chat.scope === 'task') {
        return null;
    }

    return `#${getChannelName(chat)}`;
}
