import { z } from 'zod';
import { serverIdSchema } from '../../servers/contracts.ts';
import { requireServerMembership } from '../../servers/server-access.ts';
import { subscribeToServerUpdates } from '../server-events.ts';
import { toMembershipLossError } from './membership-loss.ts';
import { memberProcedure } from './procedure.ts';

/**
 * Membership is checked in middleware, so a human without access never reaches
 * event delivery — the subscription is refused at registration. It is rechecked
 * before every delivery too, matching the durable Chat feed: membership can end
 * while a socket stays open, and removal is exactly when this feed would
 * otherwise keep talking to someone who just lost access.
 */
export const onServerUpdate = memberProcedure
    .input(z.object({ serverId: serverIdSchema }).strict())
    .use(async ({ ctx, input, next }) => {
        await requireServerMembership(ctx.grottoDb, ctx.member, input.serverId);
        return await next();
    })
    .subscription(async function* ({ ctx, input, signal }) {
        for await (const event of subscribeToServerUpdates(signal)) {
            if (event.serverId !== input.serverId) {
                continue;
            }

            // A generator body runs after the procedure's error mapping, so a
            // refusal is raised as its own coded error. Only the membership
            // refusals are translated; anything else stays the internal failure
            // it is, because the App purges its cached Server state on that code.
            try {
                await requireServerMembership(ctx.grottoDb, ctx.member, input.serverId);
            } catch (cause) {
                const refusal = toMembershipLossError(cause);

                if (!refusal) {
                    throw cause;
                }

                throw refusal;
            }

            yield event;
        }
    });
