import { useAgents } from '../../hooks/members/use-agents.ts';
import { useGrottoServerConnectionState } from '../../lib/grotto-server.tsx';

export function ConnectionNotice({
    serverError,
    serverId,
}: {
    serverError: boolean;
    serverId: string;
}) {
    const agents = useAgents(serverId);
    const connection = useGrottoServerConnectionState();

    if (!(serverError || agents.error || connection !== 'connected')) {
        return null;
    }

    return (
        <div className="card-shell absolute top-2 right-3 z-20 bg-surface-secondary px-2 py-1 text-muted text-sm shadow-surface">
            {agents.error && !agents.data
                ? 'Agent directory unavailable'
                : 'Server reconnecting · showing the latest data'}
        </div>
    );
}
