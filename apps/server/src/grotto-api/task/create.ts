import { hostedTaskCreateInputSchema, hostedTaskPromotionSchema } from '@tavern/api';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { createHostedTask } from '../../tasks/create-task.ts';
import { taskProcedure } from './procedure.ts';

export const createTaskProcedure = taskProcedure
    .input(hostedTaskCreateInputSchema)
    .output(hostedTaskPromotionSchema)
    .mutation(async ({ ctx, input }) => {
        const result = await createHostedTask(ctx.grottoDb, ctx.member, input, ctx.agentDelivery);

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
