import { hostedChatEventHeadSchema, hostedChatListInputSchema } from '@tavern/api';
import { readHostedChatEventHead } from '../../chats/read-event-head.ts';
import { chatProcedure } from './procedure.ts';

export const readChatEventHeadProcedure = chatProcedure
    .input(hostedChatListInputSchema)
    .output(hostedChatEventHeadSchema)
    .query(
        async ({ ctx, input }) =>
            await readHostedChatEventHead(ctx.grottoDb, ctx.member, input.serverId)
    );
