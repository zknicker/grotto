import { hostedChannelUpdateInputSchema, hostedChatSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { updateHostedChannel } from '../../chats/update-channel.ts';
import { chatProcedure } from './procedure.ts';

export const updateChannelProcedure = chatProcedure
    .input(hostedChannelUpdateInputSchema)
    .output(hostedChatSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await updateHostedChannel(ctx.grottoDb, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return result.chat;
    });
