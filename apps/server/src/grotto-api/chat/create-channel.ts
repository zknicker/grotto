import { hostedChannelCreateInputSchema, hostedChatSchema } from '@tavern/api';
import { createHostedChannel } from '../../chats/create-channel.ts';
import { chatProcedure } from './procedure.ts';

export const createChannelProcedure = chatProcedure
    .input(hostedChannelCreateInputSchema)
    .output(hostedChatSchema)
    .mutation(async ({ ctx, input }) => await createHostedChannel(ctx.grottoDb, ctx.member, input));
