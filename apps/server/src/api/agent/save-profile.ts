import { z } from 'zod';
import {
    agentPrimaryColorSchema,
    agentUserInstructionsSchema,
    saveCatalogAgentProfile,
} from '../../agents/catalog.ts';
import { emitAgentInvalidationCascade } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

const saveAgentProfileInputSchema = z
    .object({
        agentId: z.string().trim().min(1),
        primaryColor: agentPrimaryColorSchema.optional(),
        userInstructions: agentUserInstructionsSchema.optional(),
    })
    .refine((input) => input.primaryColor !== undefined || input.userInstructions !== undefined, {
        message: 'Choose a profile field to update.',
    });

export const saveAgentProfile = publicProcedure
    .input(saveAgentProfileInputSchema)
    .mutation(async ({ input }) => {
        const agent = await saveCatalogAgentProfile(input);
        emitAgentInvalidationCascade();
        return {
            agent,
        };
    });
