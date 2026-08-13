import { taskAssigneesInputSchema, taskAssigneesSchema } from '@tavern/api';
import { listTaskAssignees } from '../../tasks/list-task-assignees.ts';
import { taskProcedure } from './procedure.ts';

export const taskAssigneesProcedure = taskProcedure
    .input(taskAssigneesInputSchema)
    .output(taskAssigneesSchema)
    .query(async ({ ctx, input }) => await listTaskAssignees(ctx.grottoDb, ctx.member, input));
