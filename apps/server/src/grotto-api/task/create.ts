import { hostedTaskCreateInputSchema, hostedTaskPromotionSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { createHostedTask } from '../../tasks/create-task.ts';
import { taskProcedure } from './procedure.ts';

export const createTaskProcedure = taskProcedure
    .input(hostedTaskCreateInputSchema)
    .output(hostedTaskPromotionSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await createHostedTask(ctx.grottoDb, ctx.member, input);

        for (const event of result.events) {
            emitDurableChatEvent({ audienceUserId: null, event });
        }

        return { idempotent: result.idempotent, task: result.task };
    });
