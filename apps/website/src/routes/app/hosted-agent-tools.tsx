import type { HostedAgent, HostedMcpConnection } from '@tavern/api';
import { Switch } from '../../components/ui/switch.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function HostedAgentTools({
    agent,
    connections,
    serverId,
}: {
    agent: HostedAgent;
    connections: HostedMcpConnection[];
    serverId: string;
}) {
    const utils = grottoTrpc.useUtils();
    const setGrant = grottoTrpc.mcp.setGrant.useMutation({
        onSuccess: () => utils.mcp.list.invalidate({ serverId }),
    });
    const available = connections.filter(
        (connection) =>
            connection.computerId === agent.computerId &&
            connection.connected &&
            connection.tools.length > 0
    );

    if (available.length === 0) {
        return null;
    }

    return (
        <div className="mt-2 grid gap-2 border-border/60 border-t pt-3">
            <p className="font-medium text-xs">Tools</p>
            {available.flatMap((connection) =>
                connection.tools.map((toolName) => {
                    const checked = connection.grants.some(
                        (grant) => grant.agentId === agent.id && grant.toolName === toolName
                    );
                    return (
                        <label
                            className="flex items-center justify-between gap-3 text-xs"
                            key={`${connection.id}:${toolName}`}
                        >
                            <span>
                                {connection.name} · {toolName}
                            </span>
                            <Switch
                                aria-label={`Grant ${toolName} to ${agent.displayName}`}
                                checked={checked}
                                disabled={setGrant.isPending}
                                onCheckedChange={(enabled) =>
                                    setGrant.mutate({
                                        agentId: agent.id,
                                        connectionId: connection.id,
                                        enabled,
                                        serverId,
                                        toolName,
                                    })
                                }
                            />
                        </label>
                    );
                })
            )}
        </div>
    );
}
