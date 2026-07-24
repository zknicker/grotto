import type { TavernCreateMessageRequest } from '@tavern/api';

export interface DevelopmentChatDemo {
    // Agent seats in the chat, Otto-first.
    agentIds: string[];
    chatId: string;
    color?: string | null;
    messages: DevelopmentDemoMessage[];
    title: string;
}

export type DevelopmentDemoMessage = TavernCreateMessageRequest & {
    createdAt: string;
};

// Demo agents are stored agents like any other, created through the normal
// runtime create path with generated ids (ADR 0018 — no hardcoded seeded
// ids). Seeding resolves them by these names and threads the resolved ids
// into the demo definitions.
export interface DemoAgentIds {
    otto: string;
    wren: string;
}

export const demoAgentNames = { otto: 'Otto', wren: 'Wren' } as const;
export const demoUserParticipantId = 'usr_demo';
// The seeded human's handle (D2: names ARE the handles). Distinct from the
// operator's "You" seat so grotto CLI reads and the server-info roster never
// collapse the two.
export const demoUserHandle = 'Sam';
// The app owner (local human participant, see the server's
// `localHumanParticipantId`). Messages authored here render as the viewer's own
// right-anchored, avatar-less bubbles instead of the left roster.
export const demoOwnerParticipantId = 'usr_tavern';
export const demoTime = '2026-06-18T15:00:00.000Z';

export function userMessage(input: HumanDemoMessageInput): DevelopmentDemoMessage {
    return humanMessage(input, demoUserParticipantId);
}

export function ownerMessage(input: HumanDemoMessageInput): DevelopmentDemoMessage {
    return humanMessage(input, demoOwnerParticipantId);
}

// Human demo rows ride the receiving agent's session key so session
// previews group them with the reply.
type HumanDemoMessageInput = DemoMessageInput & { agentId: string };

function humanMessage(input: HumanDemoMessageInput, authorId: string): DevelopmentDemoMessage {
    const { agentId, chatId, createdAt = demoTime, ...message } = input;

    return {
        ...message,
        author_id: authorId,
        createdAt,
        metadata: {
            runtime: { source: 'development-demo', sessionKey: sessionKey(chatId, agentId) },
        },
        role: 'user',
    };
}

export function assistantMessage(
    input: DemoMessageInput & { agentId: string }
): DevelopmentDemoMessage {
    const { agentId, chatId, createdAt = demoTime, requestMessageId, runId, ...message } = input;

    return {
        ...message,
        author_id: agentId,
        createdAt,
        metadata: responseRuntimeMetadata({
            agentId,
            chatId,
            requestMessageId: requestMessageId ?? message.id,
            runId: runId ?? `run_${message.id}`,
        }),
        role: 'assistant',
    };
}

type DemoMessageInput = Omit<TavernCreateMessageRequest, 'author_id' | 'metadata' | 'role'> & {
    agentId?: string;
    chatId: string;
    createdAt?: string;
    requestMessageId?: string;
    runId?: string;
};

export function responseRuntimeMetadata(input: {
    agentId: string;
    chatId: string;
    requestMessageId: string;
    runId: string;
}) {
    const agentId = input.agentId;

    return {
        runtime: {
            agentId,
            messageId: input.requestMessageId,
            runId: input.runId,
            sessionKey: sessionKey(input.chatId, agentId),
            source: 'development-demo',
            startedAt: demoTime,
        },
    };
}

export function sessionKey(chatId: string, agentId: string) {
    return `agent:${agentId}:tavern:channel:${chatId}`;
}
