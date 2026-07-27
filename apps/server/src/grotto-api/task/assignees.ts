import { hostedTaskAssigneesInputSchema, hostedTaskAssigneesSchema } from '@tavern/api';
import { listHostedTaskAssignees } from '../../tasks/list-task-assignees.ts';
import { taskProcedure } from './procedure.ts';

export const taskAssigneesProcedure = taskProcedure
    .input(hostedTaskAssigneesInputSchema)
    .output(hostedTaskAssigneesSchema)
    .query(
        async ({ ctx, input }) => await listHostedTaskAssignees(ctx.grottoDb, ctx.member, input)
    );
