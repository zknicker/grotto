import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { serverIdSchema } from '../../servers/contracts.ts';
import { requireServerMembership } from '../../servers/server-access.ts';
import { subscribeToServerUpdates } from '../server-events.ts';
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

            // A generator body runs after the procedure's error mapping, so the
            // refusal is raised as its own coded error. The App reads that code
            // to tell losing access apart from losing the socket, and clears
            // what it has cached only for the former.
            try {
                await requireServerMembership(ctx.grottoDb, ctx.member, input.serverId);
            } catch (cause) {
                throw new TRPCError({
                    cause,
                    code: 'FORBIDDEN',
                    message: 'You are no longer a member of this Grotto server.',
                });
            }

            yield event;
        }
    });
