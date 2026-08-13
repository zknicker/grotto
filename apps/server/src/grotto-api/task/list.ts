import { taskListInputSchema, taskListSchema } from '@tavern/api';
import { listTasks } from '../../tasks/list-tasks.ts';
import { taskProcedure } from './procedure.ts';

export const listTasksProcedure = taskProcedure
    .input(taskListInputSchema)
    .output(taskListSchema)
    .query(async ({ ctx, input }) => await listTasks(ctx.grottoDb, ctx.member, input));
