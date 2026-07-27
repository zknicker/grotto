import { hostedChatMessageReceiptSchema, hostedChatSendInputSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { sendHostedChatMessage } from '../../chats/send-message.ts';
import { wakeDmAgent } from '../../chats/wake-dm-agent.ts';
import { chatProcedure } from './procedure.ts';

export const sendChatMessageProcedure = chatProcedure
    .input(hostedChatSendInputSchema)
    .output(hostedChatMessageReceiptSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await sendHostedChatMessage(ctx.grottoDb, ctx.member, input);

        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        // A new top-level human DM message wakes the seated Agent's Computer if
        // it is online; hosted collaboration itself never waits on a Computer.
        if (result.event && !input.thread) {
            await wakeDmAgent(ctx.computerConnections, ctx.grottoDb, {
                chatId: input.chatId,
                content: input.content,
                serverId: input.serverId,
            }).catch(() => undefined);
        }

        return result.receipt;
    });
