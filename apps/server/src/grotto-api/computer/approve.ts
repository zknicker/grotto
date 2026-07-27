import { TRPCError } from '@trpc/server';
import { approveComputerSetupSchema } from '../../computers/contracts.ts';
import { approveComputerSetup, ComputerSetupDeniedError } from '../../computers/service.ts';
import { memberProcedure } from '../server/procedure.ts';

export const approveComputerSetupProcedure = memberProcedure
    .input(approveComputerSetupSchema)
    .mutation(async ({ ctx, input }) => {
        try {
            return await approveComputerSetup(ctx.grottoDb, ctx.member, input);
        } catch (cause) {
            if (cause instanceof ComputerSetupDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
