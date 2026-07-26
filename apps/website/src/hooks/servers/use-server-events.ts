import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { isMembershipLoss } from './membership-loss.ts';

/**
 * Keeps the open Grotto server current while it changes on the Server. This
 * subscription owns every invalidation a Server-level change implies, including
 * membership: a role change or a departure alters the directory, the viewer's
 * own standing, and which Servers they can open.
 *
 * The Server refuses delivery once membership ends, so a removed human's
 * subscription errors instead of quietly going silent, and the surrounding
 * route falls back to its unavailable state.
 */
export function useServerEvents(serverId: string | undefined) {
    const utils = grottoTrpc.useUtils();

    grottoTrpc.server.onUpdate.useSubscription(
        { serverId: serverId ?? '' },
        {
            enabled: serverId !== undefined,
            onData: () => {
                void utils.server.bySlug.invalidate();
                void utils.server.list.invalidate();
                void utils.member.list.invalidate();
                void utils.invitation.list.invalidate();
            },
            onError: (error) => {
                if (!isMembershipLoss(error)) {
                    return;
                }

                // Losing membership arrives as a refusal, never as data, so
                // nothing invalidates on its own. Reset rather than invalidate:
                // this drops the Chats, messages, and directory already in the
                // cache instead of leaving them rendered while a refetch runs,
                // and the refetch that follows fails closed into the route's
                // unavailable state.
                void utils.server.bySlug.reset();
                void utils.server.list.invalidate();
                void utils.member.list.reset();
                void utils.invitation.list.reset();
                void utils.chat.list.reset();
                void utils.chat.messages.reset();
                void utils.chat.search.reset();
            },
        }
    );
}
