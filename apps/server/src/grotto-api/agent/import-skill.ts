import { agentImportSkillInputSchema, agentImportSkillResultSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { AgentConfigDeniedError } from '../../server-agents/agent-config-errors.ts';
import { importAgentSkill } from '../../server-agents/import-agent-skill.ts';
import { memberProcedure } from '../server/procedure.ts';
import { emitServerUpdated } from '../server-events.ts';

export const importAgentSkillProcedure = memberProcedure
    .input(agentImportSkillInputSchema)
    .output(agentImportSkillResultSchema)
    .mutation(async ({ ctx, input }) => {
        try {
            const accepted = await importAgentSkill(
                ctx.grottoDb,
                ctx.computerConnections,
                ctx.member,
                input
            );
            // The Computer has written the skill by the time it answers, and
            // what changed is workspace state the Computer reports — so this is
            // the Computer scope, carrying the one Agent it belongs to.
            emitServerUpdated({
                agentId: input.agentId,
                scope: 'computer',
                serverId: input.serverId,
            });
            return accepted;
        } catch (cause) {
            if (cause instanceof AgentConfigDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
