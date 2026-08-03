import { z } from 'zod';
import { actorRefSchema } from '../actors/contracts.ts';
import { sessionRelationshipSchema } from '../sessions/contracts/core.ts';
import {
    sessionAccessEventSchema,
    sessionArtifactSchema,
    sessionDeliverySchema,
} from '../sessions/contracts/log.ts';
import { sessionMessageSchema, sessionThinkingSchema } from '../sessions/contracts/messages.ts';
import { toolCallSchema, toolFactSchema } from '../tools/contracts.ts';
import { workerSchema } from '../workers/contracts.ts';

export const toolFactRowSchema = toolFactSchema;
export const toolCallRowSchema = toolCallSchema;

export const clarificationRowSchema = z.object({
    answer: z.string().nullable(),
    choices: z.array(z.string()),
    deadlineAt: z.string().nullable(),
    disposition: z.enum(['answered', 'skipped', 'timeout']).nullable(),
    question: z.string(),
    requestId: z.string(),
});

export const messageRowMessageSchema = sessionMessageSchema.extend({
    sourceSessionId: z.string().nullable(),
    sourceSessionKey: z.string(),
});

export const threadReplyPreviewRowSchema = z.object({
    authorAgentId: z.string().nullable(),
    authorUserId: z.string().nullable(),
    content: z.string(),
    createdAt: z.string(),
    id: z.string(),
});

export const threadSummaryRowSchema = z.object({
    anchorMessageId: z.string(),
    followed: z.boolean(),
    latestReplyAt: z.string().nullable(),
    // The newest replies, oldest first. Absent on surfaces that only know a
    // Thread's shape, so the preview falls back to its header alone.
    recentReplies: z.array(threadReplyPreviewRowSchema).optional(),
    replyCount: z.number().int().nonnegative(),
    threadChatId: z.string(),
    unreadCount: z.number().int().nonnegative(),
});

export const messageRowSchema = z.object({
    actor: actorRefSchema.nullable(),
    connectsToNext: z.boolean(),
    connectsToPrevious: z.boolean(),
    id: z.string(),
    isFirstInGroup: z.boolean(),
    kind: z.literal('message'),
    message: messageRowMessageSchema,
    responseId: z.string().optional(),
    // Turn identity for agent replies: the message is the turn's output, and
    // consumers associate the two by this field, never by parsing ids.
    runId: z.string().nullable().optional(),
    thread: threadSummaryRowSchema.nullable().optional(),
});

export const toolRowSchema = z.object({
    actor: actorRefSchema.nullable(),
    completedAt: z.string().nullable(),
    clarification: clarificationRowSchema.nullable().optional(),
    connectsToNext: z.boolean(),
    connectsToPrevious: z.boolean(),
    id: z.string(),
    isFirstInGroup: z.boolean(),
    kind: z.literal('tool'),
    responseId: z.string().optional(),
    // Run identity from the owning activity's runtime metadata. Transcript
    // turn grouping keys on this; deriving it from row ids breaks once run
    // ids carry an agent suffix.
    runId: z.string().nullable().optional(),
    sessionKey: z.string().nullable(),
    startedAt: z.string().nullable(),
    spawnedRelationships: z.array(sessionRelationshipSchema).default([]),
    toolCall: toolCallRowSchema,
});

export const workerRowSchema = z.object({
    actor: actorRefSchema.nullable(),
    completedAt: z.string().nullable(),
    connectsToNext: z.boolean(),
    connectsToPrevious: z.boolean(),
    id: z.string(),
    isFirstInGroup: z.boolean(),
    kind: z.literal('worker'),
    responseId: z.string().optional(),
    sessionKey: z.string().nullable(),
    startedAt: z.string().nullable(),
    worker: workerSchema,
});

export const widgetSchema = z.object({
    component: z.string().nullable(),
    fallbackText: z.string(),
    id: z.string(),
    props: z.unknown().nullable(),
    target: z.string().nullable(),
    validationError: z.string().nullable(),
});

export const widgetRowSchema = z.object({
    actor: actorRefSchema.nullable(),
    completedAt: z.string().nullable(),
    connectsToNext: z.boolean(),
    connectsToPrevious: z.boolean(),
    id: z.string(),
    isFirstInGroup: z.boolean(),
    kind: z.literal('widget'),
    responseId: z.string().optional(),
    // Turn identity: the widget is part of its turn's contribution.
    runId: z.string().nullable().optional(),
    sessionKey: z.string().nullable(),
    startedAt: z.string().nullable(),
    widget: widgetSchema,
});

export const runtimeNoticeSchema = z.object({
    // The agent seat the notice belongs to; the app attaches new-session
    // notices to that agent's next turn instead of a standalone row.
    agentId: z.string().nullable(),
    compactionCount: z.number().int().nonnegative().nullable().optional(),
    detail: z.string().nullable(),
    kind: z.enum(['new_session', 'auto_compaction', 'status']),
    sessionId: z.string().nullable(),
    text: z.string(),
    title: z.string(),
});

export const turnStatusSchema = z.object({
    agentId: z.string(),
    runId: z.string(),
    sessionKey: z.string(),
    status: z.enum(['stopped']),
    text: z.string(),
});

export const systemRowSchema = z.discriminatedUnion('systemKind', [
    z.object({
        accessEvent: sessionAccessEventSchema,
        id: z.string(),
        kind: z.literal('system'),
        systemKind: z.literal('accessEvent'),
        timestamp: z.string(),
    }),
    z.object({
        artifact: sessionArtifactSchema,
        id: z.string(),
        kind: z.literal('system'),
        responseId: z.string().optional(),
        systemKind: z.literal('artifact'),
        timestamp: z.string(),
    }),
    z.object({
        delivery: sessionDeliverySchema,
        id: z.string(),
        kind: z.literal('system'),
        systemKind: z.literal('delivery'),
        timestamp: z.string().nullable(),
    }),
    z.object({
        id: z.string(),
        kind: z.literal('system'),
        responseId: z.string().optional(),
        runtimeNotice: runtimeNoticeSchema,
        systemKind: z.literal('runtimeNotice'),
        timestamp: z.string(),
    }),
    z.object({
        id: z.string(),
        kind: z.literal('system'),
        responseId: z.string(),
        systemKind: z.literal('turnStatus'),
        timestamp: z.string(),
        turnStatus: turnStatusSchema,
    }),
    z.object({
        id: z.string(),
        kind: z.literal('system'),
        responseId: z.string().optional(),
        systemKind: z.literal('thinking'),
        thinking: sessionThinkingSchema,
        timestamp: z.string(),
    }),
]);

export const historyRowSchema = z.discriminatedUnion('kind', [
    messageRowSchema,
    toolRowSchema,
    widgetRowSchema,
    workerRowSchema,
    systemRowSchema,
]);

export type MessageRowMessage = z.infer<typeof messageRowMessageSchema>;
export type HistoryRow = z.infer<typeof historyRowSchema>;
