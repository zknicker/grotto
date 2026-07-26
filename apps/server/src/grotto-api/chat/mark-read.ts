import { hostedChatMarkReadInputSchema, hostedChatReadReceiptSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { markHostedChatRead } from '../../chats/mark-read.ts';
import { chatProcedure } from './procedure.ts';

export const markChatReadProcedure = chatProcedure
    .input(hostedChatMarkReadInputSchema)
    .output(hostedChatReadReceiptSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await markHostedChatRead(ctx.grottoDb, ctx.member, input);

        if (result.event && ctx.member) {
            emitDurableChatEvent({ audienceUserId: ctx.member.id, event: result.event });
        }

        return result.receipt;
    });
