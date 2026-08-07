import * as z from 'zod';
import { hostedIdSchema } from './hosted-chat.ts';

const manualTopicIdPattern = /^[A-Za-z0-9][A-Za-z0-9_/-]{0,127}$/u;

export const hostedAgentManualTopicIdSchema = hostedIdSchema
    .max(128)
    .regex(manualTopicIdPattern, 'Manual topic ids must be stable path-safe ids.');

export const hostedAgentManualIntentSchema = z.string().trim().min(12).max(500);
export const hostedAgentManualReasonSchema = z.string().trim().min(12).max(500);

export const hostedAgentManualTopicKindSchema = z.enum([
    'index',
    'overview',
    'recipe-index',
    'recipe',
]);

export const hostedAgentManualRecipeClassSchema = z.enum([
    'archetype',
    'decision',
    'pattern',
    'playbook',
    'technique',
]);
export const hostedAgentManualDeliveryTierSchema = z.enum(['seeded', 'query']);

const manualTopicCommonFields = {
    body: z.string().min(1),
    id: hostedAgentManualTopicIdSchema,
    related: z.array(hostedAgentManualTopicIdSchema),
    summary: z.string().min(1).max(500),
    title: z.string().min(1).max(300),
};

const hostedAgentManualIndexTopicSchema = z
    .object({ ...manualTopicCommonFields, kind: z.literal('index') })
    .strict();
const hostedAgentManualOverviewTopicSchema = z
    .object({ ...manualTopicCommonFields, kind: z.literal('overview') })
    .strict();
const hostedAgentManualRecipeIndexTopicSchema = z
    .object({ ...manualTopicCommonFields, kind: z.literal('recipe-index') })
    .strict();
const hostedAgentManualRecipeTopicSchema = z
    .object({
        ...manualTopicCommonFields,
        class: hostedAgentManualRecipeClassSchema,
        evidence: z.literal('verified'),
        industries: z.array(z.string().min(1)),
        kind: z.literal('recipe'),
        prereqs: z.array(z.string().min(1)),
        tier: hostedAgentManualDeliveryTierSchema,
        triggers: z.array(z.string().min(1)),
    })
    .strict();

export const hostedAgentManualTopicSchema = z.discriminatedUnion('kind', [
    hostedAgentManualIndexTopicSchema,
    hostedAgentManualOverviewTopicSchema,
    hostedAgentManualRecipeIndexTopicSchema,
    hostedAgentManualRecipeTopicSchema,
]);

export const hostedAgentManualGetResponseSchema = z
    .object({ topic: hostedAgentManualTopicSchema })
    .strict();

export const hostedAgentManualSearchScopeSchema = z.enum(['all', 'recipes']);

const hostedAgentManualIndexSearchResultSchema = hostedAgentManualIndexTopicSchema
    .omit({ body: true, related: true })
    .strict();
const hostedAgentManualOverviewSearchResultSchema = hostedAgentManualOverviewTopicSchema
    .omit({ body: true, related: true })
    .strict();
const hostedAgentManualRecipeIndexSearchResultSchema = hostedAgentManualRecipeIndexTopicSchema
    .omit({ body: true, related: true })
    .strict();
const hostedAgentManualRecipeSearchResultSchema = hostedAgentManualRecipeTopicSchema
    .omit({ body: true, related: true })
    .strict();

export const hostedAgentManualSearchResultSchema = z.discriminatedUnion('kind', [
    hostedAgentManualIndexSearchResultSchema,
    hostedAgentManualOverviewSearchResultSchema,
    hostedAgentManualRecipeIndexSearchResultSchema,
    hostedAgentManualRecipeSearchResultSchema,
]);

export const hostedAgentManualSearchResponseSchema = z
    .object({
        query: z.string().min(1).max(500),
        results: z.array(hostedAgentManualSearchResultSchema).max(20),
        scope: hostedAgentManualSearchScopeSchema,
    })
    .strict();

export type HostedAgentManualTopic = z.infer<typeof hostedAgentManualTopicSchema>;
export type HostedAgentManualSearchResult = z.infer<typeof hostedAgentManualSearchResultSchema>;

export const hostedAgentManualGetQuerySchema = z
    .object({
        intent: hostedAgentManualIntentSchema,
        reason: hostedAgentManualReasonSchema,
        topic: hostedAgentManualTopicIdSchema,
    })
    .strict();

export const hostedAgentManualSearchQuerySchema = z
    .object({
        intent: hostedAgentManualIntentSchema,
        limit: z.coerce.number().int().min(1).max(20).default(20),
        q: z.string().trim().min(1).max(500),
        reason: hostedAgentManualReasonSchema,
        scope: hostedAgentManualSearchScopeSchema.default('all'),
    })
    .strict();

export const manualRunnerCapability = 'manual' as const;
