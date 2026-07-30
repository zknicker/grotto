import { hostedAgentImportSkillInputSchema, hostedAgentImportSkillResultSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { AgentConfigDeniedError } from '../../hosted-agents/agent-config-errors.ts';
import { importHostedAgentSkill } from '../../hosted-agents/import-agent-skill.ts';
import { memberProcedure } from '../server/procedure.ts';

export const importAgentSkillProcedure = memberProcedure
    .input(hostedAgentImportSkillInputSchema)
    .output(hostedAgentImportSkillResultSchema)
    .mutation(async ({ ctx, input }) => {
        try {
            return await importHostedAgentSkill(
                ctx.grottoDb,
                ctx.computerConnections,
                ctx.member,
                input
            );
        } catch (cause) {
            if (cause instanceof AgentConfigDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
