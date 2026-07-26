import { hostedChatSchema, hostedEnsureDmInputSchema } from '@tavern/api';
import { ensureHostedDm } from '../../chats/ensure-dm.ts';
import { chatProcedure } from './procedure.ts';

export const ensureDmProcedure = chatProcedure
    .input(hostedEnsureDmInputSchema)
    .output(hostedChatSchema)
    .mutation(async ({ ctx, input }) => await ensureHostedDm(ctx.grottoDb, ctx.member, input));
