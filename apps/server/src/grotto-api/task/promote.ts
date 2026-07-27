import { hostedTaskPromoteInputSchema, hostedTaskPromotionSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { promoteHostedMessageTask } from '../../tasks/promote-task.ts';
import { taskProcedure } from './procedure.ts';

export const promoteTaskProcedure = taskProcedure
    .input(hostedTaskPromoteInputSchema)
    .output(hostedTaskPromotionSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await promoteHostedMessageTask(ctx.grottoDb, ctx.member, input);
        if (result.event) {
            emitDurableChatEvent({ audienceUserId: null, event: result.event });
        }
        return { idempotent: result.idempotent, task: result.task };
    });
