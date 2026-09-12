import * as z from 'zod';

const askIdSchema = z.string().trim().min(1);
const askTimestampSchema = z.iso.datetime({ offset: true });

export const askTitleMaxLength = 120;
export const askSummaryMaxLength = 500;
export const askRecommendedStepMaxLength = 200;

export const askStatuses = ['open', 'answered'] as const;

export const askStatusSchema = z.enum(askStatuses);

/** Who settled an Ask. Humans and Agents may both answer; only one ever does. */
export const askAnsweredBySchema = z.discriminatedUnion('kind', [
    z.object({ id: askIdSchema, kind: z.literal('agent') }).strict(),
    z.object({ id: askIdSchema, kind: z.literal('user') }).strict(),
]);

export const askTitleSchema = z.string().trim().min(1).max(askTitleMaxLength);
export const askSummarySchema = z.string().trim().min(1).max(askSummaryMaxLength);
export const askRecommendedStepSchema = z.string().trim().min(1).max(askRecommendedStepMaxLength);

/**
 * One Agent-authored request for a named human's decision. The Message owns
 * authorship and Chat placement; this record owns the request and settlement.
 */
export const askSchema = z
    .object({
        addresseeUserId: askIdSchema,
        agentId: askIdSchema,
        answerMessageId: askIdSchema.nullable(),
        answeredAt: askTimestampSchema.nullable(),
        answeredBy: askAnsweredBySchema.nullable(),
        chatId: askIdSchema,
        createdAt: askTimestampSchema,
        id: askIdSchema,
        messageId: askIdSchema,
        recommendedStep: askRecommendedStepSchema,
        status: askStatusSchema,
        summary: askSummarySchema,
        title: askTitleSchema,
    })
    .strict();

export type Ask = z.infer<typeof askSchema>;
export type AskAnsweredBy = z.infer<typeof askAnsweredBySchema>;
export type AskStatus = z.infer<typeof askStatusSchema>;
