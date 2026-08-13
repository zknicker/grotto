import { channelUpdateInputSchema, chatSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { updateChannel } from '../../chats/update-channel.ts';
import { chatProcedure } from './procedure.ts';

export const updateChannelProcedure = chatProcedure
    .input(channelUpdateInputSchema)
    .output(chatSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await updateChannel(ctx.grottoDb, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return result.chat;
    });
