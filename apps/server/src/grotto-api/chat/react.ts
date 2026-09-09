import { chatMessageReactionInputSchema, chatMessageReactionReceiptSchema } from '@grotto/api';
import { changeMessageReaction } from '../../chats/change-message-reaction.ts';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { chatProcedure } from './procedure.ts';

export const reactToChatMessageProcedure = chatProcedure
    .input(chatMessageReactionInputSchema)
    .output(chatMessageReactionReceiptSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await changeMessageReaction(ctx.grottoDb, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return result.receipt;
    });
