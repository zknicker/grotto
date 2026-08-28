import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { ComputerSetupDeniedError, listComputerSystemEvents } from '../../computers/service.ts';
import { serverIdSchema } from '../../servers/contracts.ts';
import { memberProcedure } from '../server/procedure.ts';

export const computerSystemLogProcedure = memberProcedure
    .input(
        z
            .object({
                computerId: z.string().regex(/^cmp_[A-Za-z0-9_-]{16}$/u),
                serverId: serverIdSchema,
            })
            .strict()
    )
    .query(async ({ ctx, input }) => {
        try {
            return await listComputerSystemEvents(ctx.grottoDb, ctx.member, input);
        } catch (cause) {
            if (cause instanceof ComputerSetupDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
