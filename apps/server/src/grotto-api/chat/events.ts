import { chatEventsInputSchema, chatEventsSchema } from '@grotto/api';
import { listChatEvents } from '../../chats/list-events.ts';
import { chatProcedure } from './procedure.ts';

export const listChatEventsProcedure = chatProcedure
    .input(chatEventsInputSchema)
    .output(chatEventsSchema)
    .query(async ({ ctx, input }) => await listChatEvents(ctx.grottoDb, ctx.member, input));
