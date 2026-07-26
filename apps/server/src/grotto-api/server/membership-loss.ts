import { TRPCError } from '@trpc/server';
import { ServerAccessDeniedError, ServerNotFoundError } from '../../servers/server-access.ts';

/**
 * Translates a membership recheck that failed during subscription delivery.
 *
 * A subscription generator runs after the procedure's error mapping, so a
 * refusal raised there has to carry its own code. The App treats these codes as
 * proof the human lost access and drops everything it has cached about the
 * Server, which makes the translation deliberately narrow: only the two
 * membership refusals qualify. A database or transport failure returns null so
 * the caller rethrows it as the internal failure it is — misreporting one as a
 * refusal would purge a still-valid member's Chats on a transient hiccup.
 */
export function toMembershipLossError(cause: unknown): TRPCError | null {
    if (cause instanceof ServerAccessDeniedError) {
        return new TRPCError({
            cause,
            code: 'FORBIDDEN',
            message: 'You are no longer a member of this Grotto server.',
        });
    }

    if (cause instanceof ServerNotFoundError) {
        return new TRPCError({
            cause,
            code: 'NOT_FOUND',
            message: 'This Grotto server is no longer available.',
        });
    }

    return null;
}
