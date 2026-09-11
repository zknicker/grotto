import { type Agent, type ChatSendInput, type OpenAsk, openAskThreadAnchor } from '@grotto/api';
import { messagePreviewLine } from '../../chats/message-preview-line.ts';
import { conversationLabel } from '../conversation-label.ts';
import type { HumanDirectory } from '../human-identity.ts';

/**
 * One open Ask as the Inbox row reads it: the decision, and where it came from.
 *
 * A row states the Ask and opens it; it does not answer it. Everything the
 * answer needs — the conversation, the Thread anchor, the recommended step —
 * is read off the Server's own `OpenAsk` in the peek, so none of it is
 * projected here.
 */
export interface NeedsYouAsk {
    /** The Agent that asked, whose face leads the row. */
    agentId: string;
    agentName: string;
    chatLabel: string;
    /** The Ask Message id, which is also the `?ask=` deep link. */
    id: string;
    /** The Agent's summary as one flat line, never its raw Markdown. */
    summary: string;
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
        agentId: item.ask.agentId,
        agentName: askAgentName(item, agentsById),
        chatLabel: conversationLabel(item, humans),
        id: item.ask.messageId,
        summary: messagePreviewLine(item.ask.summary),
        title: item.ask.title,
    }));
}

/**
 * The answer the recommended-step button sends: the human's own Message,
 * addressed to the conversation and to the Message its Thread hangs off —
 * never to the Thread's own Chat id, which is the shape a Thread reply takes
 * everywhere. The Server settles the Ask as a side effect of this ordinary
 * send.
 *
 * It reads the Server record rather than the row projection: the button lives
 * in the Ask's own Thread peek now, and that is the record the peek already
 * holds.
 */
export function askAnswerMessage(
    item: OpenAsk,
    input: { nonce: string; serverId: string }
): ChatSendInput {
    return {
        attachmentIds: [],
        chatId: item.conversationChatId,
        content: item.ask.recommendedStep,
        nonce: input.nonce,
        serverId: input.serverId,
        thread: { anchorMessageId: openAskThreadAnchor(item).id },
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
