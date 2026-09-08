import { chatMessageReceiptSchema, chatSendInputSchema } from '@grotto/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { sendChatMessage } from '../../chats/send-message.ts';
import { chatProcedure } from './procedure.ts';

export const sendChatMessageProcedure = chatProcedure
    .input(chatSendInputSchema)
    .output(chatMessageReceiptSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await sendChatMessage(ctx.grottoDb, ctx.member, input, ctx.agentDelivery);

        for (const event of result.events) {
            emitDurableChatEvent({ audienceUserId: null, event });
        }
        // Durable pending work is authoritative; the response never waits on its wire nudge.
        void ctx.postCommitWork.wakeAgents(ctx.agentDelivery, result.wakes);

        return result.receipt;
    });
