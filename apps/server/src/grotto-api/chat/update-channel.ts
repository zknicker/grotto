import { hostedChannelUpdateInputSchema, hostedChatSchema } from '@tavern/api';
import { updateHostedChannel } from '../../chats/update-channel.ts';
import { chatProcedure } from './procedure.ts';

export const updateChannelProcedure = chatProcedure
    .input(hostedChannelUpdateInputSchema)
    .output(hostedChatSchema)
    .mutation(async ({ ctx, input }) => await updateHostedChannel(ctx.grottoDb, ctx.member, input));
