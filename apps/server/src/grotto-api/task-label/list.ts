import { taskLabelListInputSchema, taskLabelListSchema } from '@grotto/api';
import { listTaskLabels } from '../../tasks/task-labels.ts';
import { taskProcedure } from '../task/procedure.ts';

export const listTaskLabelsProcedure = taskProcedure
    .input(taskLabelListInputSchema)
    .output(taskLabelListSchema)
    .query(
        async ({ ctx, input }) => await listTaskLabels(ctx.grottoDb, ctx.member, input.serverId)
    );
