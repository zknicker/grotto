import { taskPromoteInputSchema, taskPromotionSchema } from '@grotto/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { promoteMessageTask } from '../../tasks/promote-task.ts';
import { taskProcedure } from './procedure.ts';

export const promoteTaskProcedure = taskProcedure
    .input(taskPromoteInputSchema)
    .output(taskPromotionSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await promoteMessageTask(ctx.grottoDb, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return { idempotent: result.idempotent, task: result.task };
    });
