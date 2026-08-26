import { useServerContext } from '../../features/servers/server-context.ts';
import { AgentsUsageOverview } from '../../features/usage/agents-usage-overview.tsx';
import { useWindowTitle } from '../../hooks/shell/use-window-title.ts';

/**
 * Server-wide token usage.
 *
 * This was the index of `/members`, sharing a two-column browser with the Agent
 * and Human rosters — so a dashboard wore a roster's URL and a roster lived
 * outside Settings. Members are records in Settings now; usage is neither a
 * member nor a setting, so it is its own destination.
 */
export function UsagePage() {
    const { server } = useServerContext();
    useWindowTitle('Usage');

    return <AgentsUsageOverview serverId={server.id} />;
}
