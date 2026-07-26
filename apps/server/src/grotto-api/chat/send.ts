import { hostedChatMessageReceiptSchema, hostedChatSendInputSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { sendHostedChatMessage } from '../../chats/send-message.ts';
import { chatProcedure } from './procedure.ts';

export const sendChatMessageProcedure = chatProcedure
    .input(hostedChatSendInputSchema)
    .output(hostedChatMessageReceiptSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await sendHostedChatMessage(ctx.grottoDb, ctx.member, input);

        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }

        return result.receipt;
    });
