import { taskListInputSchema, taskListSchema } from '@haus/api';
import { listTasks } from '../../tasks/list-tasks.ts';
import { taskProcedure } from './procedure.ts';

export const listTasksProcedure = taskProcedure
    .input(taskListInputSchema)
    .output(taskListSchema)
    .query(async ({ ctx, input }) => await listTasks(ctx.hausDb, ctx.member, input));
