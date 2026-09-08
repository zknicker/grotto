import { type Agent, type ChatSendInput, type OpenAsk, openAskThreadAnchor } from '@grotto/api';
import { messagePreviewLine } from '../../chats/message-preview-line.ts';
import { conversationLabel } from '../conversation-label.ts';
import type { HumanDirectory } from '../human-identity.ts';

/** One open Ask as the Inbox reads it: the decision, where it came from. */
export interface NeedsYouAsk {
    agentName: string;
    chatLabel: string;
    /** The Channel or DM the answer is addressed to, never a Thread. */
    conversationChatId: string;
    /** The Ask Message id, which is also the `?ask=` deep link. */
    id: string;
    recommendedStep: string;
    /** The Agent's summary as one flat line, never its raw Markdown. */
    summary: string;
    /** The Message the answer replies to: the answer Thread's anchor. */
    threadAnchorMessageId: string;
    threadChatId: string;
    title: string;
}

/**
 * The Server already returns only the viewer's open Asks, oldest first, so
 * nothing is filtered here. This resolves each row's names the same way the
 * Task rows beside it do: the live Agent list and the shared human directory,
 * with the Message's stored author profile standing in for a retired Agent.
 */
export function toNeedsYouAsks(
    items: readonly OpenAsk[],
    humans: HumanDirectory,
    agents: readonly Agent[] = []
): NeedsYouAsk[] {
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));

    return items.map((item) => ({
        agentName: askAgentName(item, agentsById),
        chatLabel: conversationLabel(item, humans),
        conversationChatId: item.conversationChatId,
        id: item.ask.messageId,
        recommendedStep: item.ask.recommendedStep,
        summary: messagePreviewLine(item.ask.summary),
        threadAnchorMessageId: openAskThreadAnchor(item).id,
        threadChatId: item.threadChatId,
        title: item.ask.title,
    }));
}

/**
 * The answer the recommended-step button sends: the human's own Message,
 * addressed to the conversation and to the Message its Thread hangs off —
 * never to the Thread's own Chat id, which is the shape a Thread reply takes
 * everywhere. The Server settles the Ask as a side effect of this ordinary
 * send.
 */
export function askAnswerMessage(
    ask: NeedsYouAsk,
    input: { nonce: string; serverId: string }
): ChatSendInput {
    return {
        attachmentIds: [],
        chatId: ask.conversationChatId,
        content: ask.recommendedStep,
        nonce: input.nonce,
        serverId: input.serverId,
        thread: { anchorMessageId: ask.threadAnchorMessageId },
    };
}

function askAgentName(item: OpenAsk, agentsById: ReadonlyMap<string, Agent>): string {
    const agent = agentsById.get(item.ask.agentId);
    if (agent) {
        return agent.displayName;
    }
    const author = item.message.author;
    if (author.kind === 'agent' && author.profile) {
        return author.profile.displayName;
    }
    return `Agent ${item.ask.agentId.slice(-6)}`;
}
