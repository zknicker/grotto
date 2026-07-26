import { hostedThreadContextInputSchema, hostedThreadContextSchema } from '@tavern/api';
import { getHostedThreadContext } from '../../threads/get-thread-context.ts';
import { chatProcedure } from '../chat/procedure.ts';

export const getThreadProcedure = chatProcedure
    .input(hostedThreadContextInputSchema)
    .output(hostedThreadContextSchema)
    .query(async ({ ctx, input }) => await getHostedThreadContext(ctx.grottoDb, ctx.member, input));
