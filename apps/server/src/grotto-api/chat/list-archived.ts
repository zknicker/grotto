import { chatListInputSchema, chatListSchema } from '@tavern/api';
import { listChats } from '../../chats/list-chats.ts';
import { chatProcedure } from './procedure.ts';

export const listArchivedChatsProcedure = chatProcedure
    .input(chatListInputSchema)
    .output(chatListSchema)
    .query(
        async ({ ctx, input }) =>
            await listChats(ctx.grottoDb, ctx.member, input.serverId, 'archived')
    );
