import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

/**
 * How many executions one read returns. The Server orders newest first, so the
 * cap is a recency window rather than a page: the drawer says it is showing the
 * latest N when the answer fills it, and there is no "older" to ask for —
 * `REMINDER_HISTORY_RETENTION_DAYS` is the real end of the log.
 */
export const REMINDER_HISTORY_LIMIT = 200;

/**
 * Every fire this Agent's reminders have had, newest first. The Automations tab
 * does not pay for this: `enabled` is the drawer's own open state, so the log
 * is fetched the first time someone asks for it and then served from cache.
 */
export function useAgentReminderHistory(serverId: string, agentId: string, enabled: boolean) {
    return grottoTrpc.reminder.history.useQuery(
        { agentId, limit: REMINDER_HISTORY_LIMIT, serverId },
        { ...queryPolicy.syncedSnapshot, enabled }
    );
}
