import { cloudAgentWorkListForChatInputSchema, threadCloudAgentWorkListSchema } from '@haus/api';
import { listChatCloudAgentWork } from '../../cloud-agents/list-chat-cloud-agent-work.ts';
import { chatProcedure } from '../chat/procedure.ts';

export const listChatCloudAgentWorkProcedure = chatProcedure
    .input(cloudAgentWorkListForChatInputSchema)
    .output(threadCloudAgentWorkListSchema)
    .query(({ ctx, input }) => listChatCloudAgentWork(ctx.hausDb, ctx.member, input));
