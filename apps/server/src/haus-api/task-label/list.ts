import { taskLabelListInputSchema, taskLabelListSchema } from '@haus/api';
import { listTaskLabels } from '../../tasks/task-labels.ts';
import { taskProcedure } from '../task/procedure.ts';

export const listTaskLabelsProcedure = taskProcedure
    .input(taskLabelListInputSchema)
    .output(taskLabelListSchema)
    .query(async ({ ctx, input }) => await listTaskLabels(ctx.hausDb, ctx.member, input.serverId));
