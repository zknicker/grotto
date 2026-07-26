import { z } from 'zod';
import { serverIdSchema } from '../../servers/contracts.ts';
import { requireServerMembership } from '../../servers/server-access.ts';
import { subscribeToServerUpdates } from '../server-events.ts';
import { memberProcedure } from './procedure.ts';

/**
 * Membership is checked in middleware, so a human without access never reaches
 * event delivery — the subscription is refused at registration.
 */
export const onServerUpdate = memberProcedure
    .input(z.object({ serverId: serverIdSchema }).strict())
    .use(async ({ ctx, input, next }) => {
        await requireServerMembership(ctx.grottoDb, ctx.member, input.serverId);
        return await next();
    })
    .subscription(async function* ({ input, signal }) {
        for await (const event of subscribeToServerUpdates(signal)) {
            if (event.serverId === input.serverId) {
                yield event;
            }
        }
    });
