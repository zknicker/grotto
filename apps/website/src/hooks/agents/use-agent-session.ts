import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

/** The agent's current global session, as seen from one chat. */
export function useAgentSession({
    agentId,
    chatId,
    enabled = true,
}: {
    agentId: string;
    chatId: string;
    enabled?: boolean;
}) {
    return trpc.agent.session.useQuery(
        { agentId, chatId },
        {
            ...queryPolicy.agentRuntimeSnapshot,
            enabled: enabled && agentId.length > 0 && chatId.length > 0,
        }
    );
}

/**
 * Resets the agent's global session (specs/sessions.md): 'session' starts
 * fresh context, 'full' also wipes the workspace. Chat timelines are
 * untouched; the reset lands as a durable new-session notice row, so chat
 * logs and session snapshots both refetch.
 */
export function useAgentSessionReset() {
    const utils = trpc.useUtils();

    return trpc.agent.resetSession.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.agent.session.invalidate().catch(() => undefined),
                utils.chat.log.list.invalidate().catch(() => undefined),
            ]);
        },
    });
}

/**
 * Restart lifecycle action (specs/sessions.md): resume the current session
 * unchanged — no rotation, no token change, no receipt. Refreshes the
 * read-only session view and activity so the resumed state shows.
 */
export function useAgentRestart() {
    const utils = trpc.useUtils();

    return trpc.agent.restart.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.agent.session.invalidate().catch(() => undefined),
                utils.agent.activity.invalidate().catch(() => undefined),
            ]);
        },
    });
}
