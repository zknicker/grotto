import { threadContextInputSchema, threadContextSchema } from '@grotto/api';
import { getThreadContext } from '../../threads/get-thread-context.ts';
import { chatProcedure } from '../chat/procedure.ts';

export const getThreadProcedure = chatProcedure
    .input(threadContextInputSchema)
    .output(threadContextSchema)
    .query(async ({ ctx, input }) => await getThreadContext(ctx.grottoDb, ctx.member, input));
