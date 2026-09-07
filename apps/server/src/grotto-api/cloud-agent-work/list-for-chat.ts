import { cloudAgentWorkListForChatInputSchema, threadCloudAgentWorkListSchema } from '@grotto/api';
import { listChatCloudAgentWork } from '../../cloud-agents/list-chat-cloud-agent-work.ts';
import { chatProcedure } from '../chat/procedure.ts';

export const listChatCloudAgentWorkProcedure = chatProcedure
    .input(cloudAgentWorkListForChatInputSchema)
    .output(threadCloudAgentWorkListSchema)
    .query(({ ctx, input }) => listChatCloudAgentWork(ctx.grottoDb, ctx.member, input));
