import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import {
    assistantMessage,
    type DevelopmentChatDemo,
    type DevelopmentDemoMessage,
    demoTime,
    userMessage,
} from './development-chat-demo-types';
import { type VisualDemoTurn, visualDemoTurns } from './development-chat-demo-visuals-definition';

/**
 * Visuals gallery channel: one turn per rendered visual, each an assistant
 * message whose body carries a ```visual fence inline — the same fence
 * syntax the app parses from live message content. A focused surface for
 * eyeballing generative output without the mixed demo content in the main
 * demo channel.
 */
export function visualsChannelDemo(ottoId: string): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.visuals;
    const messages = visualDemoTurns().flatMap((turn) => visualTurnMessages(chatId, ottoId, turn));

    return {
        agentIds: [ottoId],
        chatId,
        color: '#8b5cf6',
        messages: messages.map((message, index) => ({
            ...message,
            createdAt: new Date(Date.parse(demoTime) + index * 45_000).toISOString(),
        })),
        title: 'visuals',
    };
}

function visualTurnMessages(
    chatId: string,
    ottoId: string,
    turn: VisualDemoTurn
): DevelopmentDemoMessage[] {
    const runId = `run_demo_visuals_${turn.slug}`;
    const requestMessageId = `msg_demo_visuals_${turn.slug}_request`;
    const responseMessageId = `msg_demo_visuals_${turn.slug}_response`;

    return [
        userMessage({
            agentId: ottoId,
            chatId,
            content: turn.request,
            id: requestMessageId,
            nonce: `demo-visuals-${turn.slug}-request`,
        }),
        assistantMessage({
            agentId: ottoId,
            chatId,
            content: visualFence(turn.title, turn.html),
            id: responseMessageId,
            nonce: `demo-visuals-${turn.slug}-response`,
            requestMessageId,
            runId,
        }),
    ];
}

function visualFence(title: string, html: string): string {
    return `\`\`\`visual ${title}\n${html}\n\`\`\``;
}
