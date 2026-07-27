import { hostedTaskListInputSchema, hostedTaskListSchema } from '@tavern/api';
import { listHostedTasks } from '../../tasks/list-tasks.ts';
import { taskProcedure } from './procedure.ts';

export const listTasksProcedure = taskProcedure
    .input(hostedTaskListInputSchema)
    .output(hostedTaskListSchema)
    .query(async ({ ctx, input }) => await listHostedTasks(ctx.grottoDb, ctx.member, input));
