import { hostedChatEventsInputSchema, hostedChatEventsSchema } from '@tavern/api';
import { listHostedChatEvents } from '../../chats/list-events.ts';
import { chatProcedure } from './procedure.ts';

export const listChatEventsProcedure = chatProcedure
    .input(hostedChatEventsInputSchema)
    .output(hostedChatEventsSchema)
    .query(async ({ ctx, input }) => await listHostedChatEvents(ctx.grottoDb, ctx.member, input));
