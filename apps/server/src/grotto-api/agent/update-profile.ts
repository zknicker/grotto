import { hostedAgentSchema, hostedUpdateAgentProfileInputSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { AgentConfigDeniedError } from '../../hosted-agents/agent-config-errors.ts';
import { updateHostedAgentProfile } from '../../hosted-agents/update-agent-profile.ts';
import { memberProcedure } from '../server/procedure.ts';

export const updateAgentProfileProcedure = memberProcedure
    .input(hostedUpdateAgentProfileInputSchema)
    .output(hostedAgentSchema)
    .mutation(async ({ ctx, input }) => {
        try {
            return await updateHostedAgentProfile(ctx.grottoDb, ctx.member, input);
        } catch (cause) {
            if (cause instanceof AgentConfigDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
