import { chatSchema, ensureDmInputSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { ensureDm } from '../../chats/ensure-dm.ts';
import { chatProcedure } from './procedure.ts';

export const ensureDmProcedure = chatProcedure
    .input(ensureDmInputSchema)
    .output(chatSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await ensureDm(ctx.grottoDb, ctx.member, input);
        // Server-wide audience: `chat.onEvent` rechecks Chat access per delivery, which
        // narrows a DM's lifecycle event to its two members and reaches the peer too.
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return result.chat;
    });
