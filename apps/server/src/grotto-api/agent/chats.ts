import { hostedAgentDetailInputSchema, hostedChatListSchema } from '@tavern/api';
import { listHostedAgentChats } from '../../hosted-agents/list-agent-chats.ts';
import { memberProcedure } from '../server/procedure.ts';

export const agentChatsProcedure = memberProcedure
    .input(hostedAgentDetailInputSchema)
    .output(hostedChatListSchema)
    .query(({ ctx, input }) => listHostedAgentChats(ctx.grottoDb, ctx.member, input));
