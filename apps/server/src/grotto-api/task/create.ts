import { taskCreateInputSchema, taskPromotionSchema } from '@grotto/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { createTask } from '../../tasks/create-task.ts';
import { taskProcedure } from './procedure.ts';

export const createTaskProcedure = taskProcedure
    .input(taskCreateInputSchema)
    .output(taskPromotionSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await createTask(ctx.grottoDb, ctx.member, input, ctx.agentDelivery);

        for (const event of result.events) {
            emitDurableChatEvent({ audienceUserId: null, event });
        }
        await Promise.all(
            result.wakes.map((wake) =>
                ctx.agentDelivery.dispatchAgent(wake.agentId, wake.serverId).catch(() => undefined)
            )
        );

        return { idempotent: result.idempotent, task: result.task };
    });
