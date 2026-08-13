import * as z from 'zod';
import { hostedIdSchema } from './hosted-chat.ts';

const hostedTimestampSchema = z.iso.datetime({ offset: true });
const positiveSequenceSchema = z.number().int().positive().safe();
const producerIdSchema = z.string().trim().min(1).max(128);
const safeToolRefSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9][a-z0-9._:-]*$/u);

export const agentActivityCategorySchema = z.enum([
    'starting_work',
    'checking_messages',
    'thinking',
    'browsing',
    'searching_web',
    'reading_files',
    'editing_files',
    'running_command',
    'using_tool',
    'sending_message',
    'working',
]);

export type AgentActivityCategory = z.infer<typeof agentActivityCategorySchema>;

export const agentActivityPhaseSchema = z.enum(['started', 'completed', 'failed']);
export type AgentActivityPhase = z.infer<typeof agentActivityPhaseSchema>;

export const agentActivityProducerSchema = z.enum(['server', 'computer']);
export type AgentActivityProducer = z.infer<typeof agentActivityProducerSchema>;

/** The only activity frame a Computer may submit to the Server. */
export const hostedAgentActivityFrameSchema = z
    .object({
        agentId: hostedIdSchema,
        category: agentActivityCategorySchema,
        occurredAt: hostedTimestampSchema,
        phase: agentActivityPhaseSchema,
        producerSequence: positiveSequenceSchema,
        runId: hostedIdSchema,
        toolRef: safeToolRefSchema.optional(),
        type: z.literal('agent-activity'),
    })
    .strict();

export type HostedAgentActivityFrame = z.infer<typeof hostedAgentActivityFrameSchema>;

/** A committed semantic activity row, enriched by the Server. */
export const hostedAgentActivityEventSchema = z
    .object({
        agentId: hostedIdSchema,
        category: agentActivityCategorySchema,
        id: hostedIdSchema,
        occurredAt: hostedTimestampSchema,
        phase: agentActivityPhaseSchema,
        position: positiveSequenceSchema,
        producer: agentActivityProducerSchema,
        producerId: producerIdSchema,
        producerSequence: positiveSequenceSchema,
        runId: hostedIdSchema,
        serverId: hostedIdSchema,
        toolRef: safeToolRefSchema.optional(),
    })
    .strict();

export type HostedAgentActivityEvent = z.infer<typeof hostedAgentActivityEventSchema>;

export const hostedAgentActivityCursorSchema = z
    .object({
        position: positiveSequenceSchema,
        runId: hostedIdSchema,
    })
    .strict();

export type HostedAgentActivityCursor = z.infer<typeof hostedAgentActivityCursorSchema>;

export const hostedAgentActivityHistoryInputSchema = z
    .object({
        agentId: hostedIdSchema,
        before: hostedAgentActivityCursorSchema.optional(),
        limit: z.number().int().positive().max(100).default(50),
        runId: hostedIdSchema.optional(),
        serverId: hostedIdSchema,
    })
    .strict()
    .superRefine((input, context) => {
        if (input.before && input.runId && input.before.runId !== input.runId) {
            context.addIssue({
                code: 'custom',
                message: 'The activity cursor must belong to the requested run.',
                path: ['before', 'runId'],
            });
        }
    });

export type HostedAgentActivityHistoryInput = z.infer<typeof hostedAgentActivityHistoryInputSchema>;

export const hostedAgentActivityHistoryPageSchema = z
    .object({
        events: z.array(hostedAgentActivityEventSchema),
        nextBefore: hostedAgentActivityCursorSchema.nullable(),
    })
    .strict();

export type HostedAgentActivityHistoryPage = z.infer<typeof hostedAgentActivityHistoryPageSchema>;

export const hostedAgentActiveActivityInputSchema = z.object({ serverId: hostedIdSchema }).strict();

export const hostedAgentActiveActivitySnapshotSchema = z
    .object({ activities: z.array(hostedAgentActivityEventSchema) })
    .strict();

export type HostedAgentActiveActivitySnapshot = z.infer<
    typeof hostedAgentActiveActivitySnapshotSchema
>;

export const hostedAgentActivitySubscriptionInputSchema = z
    .object({ serverId: hostedIdSchema })
    .strict();

// Short aliases keep the domain contract usable outside the hosted API naming surface.
export const agentActivityFrameSchema = hostedAgentActivityFrameSchema;
export const agentActivityEventSchema = hostedAgentActivityEventSchema;
export type AgentActivityFrame = HostedAgentActivityFrame;
export type AgentActivityEvent = HostedAgentActivityEvent;
