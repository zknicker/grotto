import { hostedChannelCreateInputSchema, hostedChatSchema } from '@tavern/api';
import { createHostedChannel } from '../../chats/create-channel.ts';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { chatProcedure } from './procedure.ts';

export const createChannelProcedure = chatProcedure
    .input(hostedChannelCreateInputSchema)
    .output(hostedChatSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await createHostedChannel(ctx.grottoDb, ctx.member, input);
        emitDurableChatEvent({ audienceUserId: null, event: result.event });
        return result.chat;
    });
