import { threadContextInputSchema, threadContextSchema } from '@haus/api';
import { getThreadContext } from '../../threads/get-thread-context.ts';
import { chatProcedure } from '../chat/procedure.ts';

export const getThreadProcedure = chatProcedure
    .input(threadContextInputSchema)
    .output(threadContextSchema)
    .query(async ({ ctx, input }) => await getThreadContext(ctx.hausDb, ctx.member, input));
