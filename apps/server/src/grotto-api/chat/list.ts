import { hostedChatListInputSchema, hostedChatListSchema } from '@tavern/api';
import { listHostedChats } from '../../chats/list-chats.ts';
import { chatProcedure } from './procedure.ts';

export const listChatsProcedure = chatProcedure
    .input(hostedChatListInputSchema)
    .output(hostedChatListSchema)
    .query(
        async ({ ctx, input }) => await listHostedChats(ctx.grottoDb, ctx.member, input.serverId)
    );
