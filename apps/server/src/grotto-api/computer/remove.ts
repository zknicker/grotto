import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { ComputerSetupDeniedError, removeServerComputer } from '../../computers/service.ts';
import { serverIdSchema } from '../../servers/contracts.ts';
import { memberProcedure } from '../server/procedure.ts';

export const removeComputerProcedure = memberProcedure
    .input(
        z
            .object({ computerId: z.string().min(1), confirmation: z.string().trim(), serverId: serverIdSchema })
            .strict()
    )
    .mutation(async ({ ctx, input }) => {
        try {
            return await removeServerComputer(ctx.grottoDb, ctx.member, input);
        } catch (cause) {
            if (cause instanceof ComputerSetupDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
