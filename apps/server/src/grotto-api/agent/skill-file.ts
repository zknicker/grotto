import {
    hostedAgentSkillFileDeleteInputSchema,
    hostedAgentSkillFileReadInputSchema,
    hostedAgentSkillFileSchema,
    hostedAgentSkillFileUpdateInputSchema,
} from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
    AgentSkillFileAccessError,
    deleteHostedAgentSkillFile,
    readHostedAgentSkillFile,
    updateHostedAgentSkillFile,
} from '../../hosted-agents/agent-skill-file.ts';
import { memberProcedure } from '../server/procedure.ts';

export const agentSkillFileProcedure = memberProcedure
    .input(hostedAgentSkillFileReadInputSchema)
    .output(hostedAgentSkillFileSchema)
    .query(({ ctx, input }) =>
        withSkillFileError(() =>
            readHostedAgentSkillFile(ctx.grottoDb, ctx.computerConnections, ctx.member, input)
        )
    );

export const updateAgentSkillFileProcedure = memberProcedure
    .input(hostedAgentSkillFileUpdateInputSchema)
    .output(hostedAgentSkillFileSchema)
    .mutation(({ ctx, input }) =>
        withSkillFileError(() =>
            updateHostedAgentSkillFile(ctx.grottoDb, ctx.computerConnections, ctx.member, input)
        )
    );

export const deleteAgentSkillFileProcedure = memberProcedure
    .input(hostedAgentSkillFileDeleteInputSchema)
    .output(z.object({ deleted: z.literal(true) }).strict())
    .mutation(({ ctx, input }) =>
        withSkillFileError(() =>
            deleteHostedAgentSkillFile(ctx.grottoDb, ctx.computerConnections, ctx.member, input)
        )
    );

async function withSkillFileError<T>(operation: () => Promise<T>) {
    try {
        return await operation();
    } catch (cause) {
        if (cause instanceof AgentSkillFileAccessError) {
            throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
        }
        const message = cause instanceof Error ? cause.message : 'The Agent skill is unavailable.';
        throw new TRPCError({
            cause,
            code: message.includes('changed since you opened') ? 'CONFLICT' : 'SERVICE_UNAVAILABLE',
            message,
        });
    }
}
