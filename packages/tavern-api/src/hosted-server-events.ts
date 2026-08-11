import * as z from 'zod';

const hostedIdSchema = z.string().trim().min(1);

/**
 * Which part of one Server changed. Scope selects the family of reads a
 * listener refreshes; it is deliberately coarse, because a listener that has
 * to guess at record identity should refresh the whole family instead.
 */
export const hostedServerUpdateScopeSchema = z.enum(['agent', 'computer', 'mcp', 'server']);

export type HostedServerUpdateScope = z.infer<typeof hostedServerUpdateScopeSchema>;

/**
 * One Server-scoped realtime notification. `agentId` and `memberId` are present
 * only when the change belongs to exactly one record, and they are what lets a
 * listener invalidate that record's detail read instead of every cached detail
 * read in the scope. Their absence is meaningful: it says the change is broad,
 * so the listener falls back to refreshing the whole scope.
 */
export const hostedServerUpdatedEventSchema = z
    .object({
        agentId: hostedIdSchema.optional(),
        emittedAt: z.iso.datetime({ offset: true }),
        memberId: hostedIdSchema.optional(),
        scope: hostedServerUpdateScopeSchema,
        serverId: hostedIdSchema,
    })
    .strict();

export type HostedServerUpdatedEvent = z.infer<typeof hostedServerUpdatedEventSchema>;
