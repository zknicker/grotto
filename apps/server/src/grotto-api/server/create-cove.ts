import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { computerIdSchema } from '../../computers/contracts.ts';
import {
    CoveSetupConflictError,
    CoveSetupError,
    createCove,
    sendPendingCoveApplication,
} from '../../onboarding/create-cove.ts';
import { serverIdSchema } from '../../servers/contracts.ts';
import { emitServerUpdated } from '../server-events.ts';
import { memberProcedure } from './procedure.ts';

const createCoveInputSchema = z
    .object({
        computerId: computerIdSchema,
        modelId: z.string().trim().min(1).max(128),
        runtimeId: z.string().trim().min(1).max(64),
        serverId: serverIdSchema,
    })
    .strict();

export const createCoveProcedure = memberProcedure
    .input(createCoveInputSchema)
    .mutation(async ({ ctx, input }) => {
        try {
            const result = await createCove(ctx.grottoDb, ctx.member, input);
            await sendPendingCoveApplication(
                ctx.grottoDb,
                ctx.computerConnections,
                input.computerId
            );
            emitServerUpdated({ scope: 'agent', serverId: input.serverId });
            return result;
        } catch (cause) {
            if (cause instanceof CoveSetupConflictError) {
                throw new TRPCError({ cause, code: 'CONFLICT', message: cause.message });
            }
            if (cause instanceof CoveSetupError) {
                throw new TRPCError({ cause, code: 'PRECONDITION_FAILED', message: cause.message });
            }
            throw cause;
        }
    });
