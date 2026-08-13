import { chatMessageReceiptSchema, chatSendInputSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { sendChatMessage } from '../../chats/send-message.ts';
import { chatProcedure } from './procedure.ts';

export const sendChatMessageProcedure = chatProcedure
    .input(chatSendInputSchema)
    .output(chatMessageReceiptSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await sendChatMessage(ctx.grottoDb, ctx.member, input, ctx.agentDelivery);

        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        // The pending work was enqueued atomically with the message commit; this
        // is only the best-effort wire nudge, so the send never waits on it. If
        // it fails, the retry sweep and reconnect reconciliation still deliver
        // the durably queued work.
        for (const wake of result.wakes) {
            void ctx.agentDelivery
                .dispatchAgent(wake.agentId, wake.serverId)
                .catch((error: unknown) => {
                    console.error('[grotto] chat send could not nudge an Agent', error);
                });
        }

        return result.receipt;
    });
