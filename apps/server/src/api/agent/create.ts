import { agentArchetypeIdSchema } from '@tavern/api';
import { z } from 'zod';
import { createAgent } from '../../agent-settings/service.ts';
import { agentPrimaryColorSchema } from '../../agents/catalog.ts';
import {
    emitAgentInvalidationCascade,
    emitChatUpdated,
    emitModelUpdated,
} from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

const createAgentInputSchema = z.object({
    // Archetype proposals seed the new agent's workspace starter kit; the
    // archetype itself is not stored on the agent (identity lives in memory).
    archetype: agentArchetypeIdSchema.optional(),
    bio: z.string().trim().min(1).optional(),
    // Agent names are handles: single tokens, validated here so the client
    // gets a clear error instead of a runtime contract failure.
    name: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/u, {
            message: 'Agent name must be a single token (letters, numbers, - or _), 1-32 chars.',
        }),
    primaryColor: agentPrimaryColorSchema.optional(),
});

export const createAgentProcedure = publicProcedure
    .input(createAgentInputSchema)
    .mutation(async ({ input }) => {
        const agent = await createAgent(input);
        emitAgentInvalidationCascade();
        emitChatUpdated();
        emitModelUpdated();
        return { agent };
    });
