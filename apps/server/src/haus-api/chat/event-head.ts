import { chatEventHeadSchema, chatListInputSchema } from '@haus/api';
import { readChatEventHead } from '../../chats/read-event-head.ts';
import { chatProcedure } from './procedure.ts';

export const readChatEventHeadProcedure = chatProcedure
    .input(chatListInputSchema)
    .output(chatEventHeadSchema)
    .query(
        async ({ ctx, input }) => await readChatEventHead(ctx.hausDb, ctx.member, input.serverId)
    );
