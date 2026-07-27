import { hostedTaskLabelListInputSchema, hostedTaskLabelListSchema } from '@tavern/api';
import { listHostedTaskLabels } from '../../tasks/task-labels.ts';
import { taskProcedure } from '../task/procedure.ts';

export const listTaskLabelsProcedure = taskProcedure
    .input(hostedTaskLabelListInputSchema)
    .output(hostedTaskLabelListSchema)
    .query(
        async ({ ctx, input }) =>
            await listHostedTaskLabels(ctx.grottoDb, ctx.member, input.serverId)
    );
