import type { HostedAgent, HostedMcpConnection } from '@tavern/api';
import { Badge } from '../../components/ui/badge.tsx';
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
        (connection) => connection.connected && connection.tools.length > 0
    );

    return (
        <section className="grid gap-3">
            <header>
                <h2 className="font-semibold text-base">
                    Agent MCP access
                    <span className="ml-2 text-muted-foreground">{available.length}</span>
                </h2>
                <p className="text-muted-foreground text-sm">
                    Choose which Server-managed MCP connections this Agent can use.
                </p>
            </header>
            {available.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-muted-foreground text-sm">
                    Connect an MCP server in Settings → Connections.
                </p>
            ) : (
                available.map((connection) => {
                    const checked = connection.grants.some((grant) => grant.agentId === agent.id);
                    return (
                        <label
                            className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] gap-3 rounded-xl border border-border bg-card p-4"
                            key={connection.id}
                        >
                            <Switch
                                aria-label={`Enable ${connection.name} for ${agent.displayName}`}
                                checked={checked}
                                disabled={setGrant.isPending}
                                onCheckedChange={(enabled) =>
                                    setGrant.mutate({
                                        agentId: agent.id,
                                        connectionId: connection.id,
                                        enabled,
                                        serverId,
                                    })
                                }
                            />
                            <span className="min-w-0">
                                <span className="flex items-center gap-2 font-semibold text-sm">
                                    {connection.name}
                                    <Badge variant="subtle">MCP</Badge>
                                </span>
                                <span className="mt-1 block text-muted-foreground text-sm">
                                    {connection.url}
                                </span>
                            </span>
                            <span className="text-muted-foreground text-xs">
                                {connection.tools.length} tools
                            </span>
                        </label>
                    );
                })
            )}
        </section>
    );
}
