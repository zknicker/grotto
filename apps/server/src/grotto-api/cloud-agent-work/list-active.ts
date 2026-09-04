import { activeCloudAgentWorkListSchema, cloudAgentWorkListActiveInputSchema } from '@grotto/api';
import { listActiveCloudAgentWork } from '../../cloud-agents/list-active-cloud-agent-work.ts';
import { chatProcedure } from '../chat/procedure.ts';

export const listActiveCloudAgentWorkProcedure = chatProcedure
    .input(cloudAgentWorkListActiveInputSchema)
    .output(activeCloudAgentWorkListSchema)
    .query(
        async ({ ctx, input }) => await listActiveCloudAgentWork(ctx.grottoDb, ctx.member, input)
    );
