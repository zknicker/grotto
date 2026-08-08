import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { cachesClearedOnMembershipLoss } from './hosted-membership-caches.ts';
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
            onData: createServerUpdateHandler(utils, serverId),
            onError: (error) => {
                if (!isMembershipLoss(error)) {
                    return;
                }

                // Losing membership arrives as a refusal, never as data, so
                // nothing invalidates on its own. Every hosted cache naming this
                // Server is cleared rather than invalidated: dropping the data
                // outright is what stops a removed human seeing Chats, the
                // directory, or the Server in their list while a refetch runs or
                // the connection is gone. The refetch that follows fails closed
                // into the route's unavailable state.
                for (const cache of cachesClearedOnMembershipLoss(utils)) {
                    void cache.reset();
                }
            },
        }
    );
}

type ServerEventUtils = ReturnType<typeof grottoTrpc.useUtils>;

export function createServerUpdateHandler(utils: ServerEventUtils, serverId: string | undefined) {
    return (event: { scope: string }) => {
        if (event.scope === 'agent') {
            void utils.agent.get.invalidate(undefined, { exact: false });
            void utils.agent.list.invalidate({ serverId });
            void utils.chat.list.invalidate({ serverId });
            return;
        }
        if (event.scope === 'computer') {
            void utils.server.bySlug.invalidate();
            void utils.computer.list.invalidate({ serverId });
            void utils.agent.get.invalidate(undefined, { exact: false });
            void utils.agent.list.invalidate({ serverId });
            void utils.agent.skillFile.invalidate();
            void utils.agent.workspaceFile.invalidate();
            void utils.agent.workspaceFiles.invalidate();
            void utils.stats.live.invalidate({ serverId });
            return;
        }
        if (event.scope === 'mcp') {
            void utils.mcp.list.invalidate({ serverId });
            return;
        }

        void utils.server.bySlug.invalidate();
        void utils.server.list.invalidate();
        void utils.member.get.invalidate(undefined, { exact: false });
        void utils.member.list.invalidate({ serverId });
        void utils.invitation.list.invalidate({ serverId });
    };
}
