import * as z from 'zod';
import {
    askRecommendedStepSchema,
    askSchema,
    askSummarySchema,
    askTitleSchema,
} from './ask-shared.ts';
import { type ChatMessage, chatMessageSchema, idSchema } from './chat.ts';
import { participantHandleSchema } from './participant-handle.ts';

export const askListOpenInputSchema = z.object({ serverId: idSchema }).strict();

/**
 * One open Ask addressed to the viewer, with everything a reader needs to
 * answer it and to open the conversation it came from.
 *
 * `conversationChatId` and the Chat facts beside it always name the Channel or
 * DM the conversation belongs to — the Ask's own Chat when it is top-level,
 * and the Thread's parent when the Ask was posted inside a Thread. A reply is
 * addressed to that conversation and to `threadAnchorMessage`, never to the
 * Thread's own Chat id, so the row carries the same pair the Thread composer
 * sends.
 */
export const openAskSchema = z
    .object({
        ask: askSchema,
        chatKind: z.enum(['channel', 'dm']),
        chatName: z.string().nullable(),
        chatPeerUserId: idSchema.nullable(),
        conversationChatId: idSchema,
        message: chatMessageSchema,
        /**
         * The Message the answer Thread hangs off, when that is not the Ask's
         * own Message. Null for every top-level Ask, which anchors its own
         * Thread — read it through `openAskThreadAnchor`.
         */
        threadAnchorMessage: chatMessageSchema.nullable(),
        threadChatId: idSchema,
    })
    .strict();

export const openAskListSchema = z.array(openAskSchema);

export type OpenAsk = z.infer<typeof openAskSchema>;

/** The Message this Ask's answer replies to: the answer Thread's anchor. */
export function openAskThreadAnchor(row: OpenAsk): ChatMessage {
    return row.threadAnchorMessage ?? row.message;
}

/** `grotto ask` — the Agent-scoped creation request. */
export const agentAskInputSchema = z
    .object({
        addresseeHandle: participantHandleSchema,
        content: z.string().trim().min(1).max(32_000),
        nonce: z.string().trim().min(1).max(128),
        recommendedStep: askRecommendedStepSchema,
        summary: askSummarySchema,
        target: z.string().trim().min(1).max(200),
        title: askTitleSchema,
    })
    .strict();

export type AgentAskInput = z.infer<typeof agentAskInputSchema>;

export const agentAskReceiptSchema = z
    .object({
        ask: askSchema,
        chatId: idSchema,
        idempotent: z.boolean(),
        messageId: idSchema,
        sequence: z.number().int().positive(),
        target: z.string().trim().min(1),
    })
    .strict();

export type AgentAskReceipt = z.infer<typeof agentAskReceiptSchema>;
