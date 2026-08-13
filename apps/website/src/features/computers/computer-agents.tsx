import { Chip } from '@heroui/react';
import { Link } from 'react-router-dom';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { useAgents } from '../../hooks/members/use-agents.ts';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import type { GrottoOutputs } from '../../lib/grotto-server.tsx';
import { availabilityBadgeColor } from '../members/agent-avatar.tsx';
import { agentRoute } from '../servers/server-routes.ts';
import { agentExecutionLabels, availabilityLabel } from './presentation.ts';

type Computer = GrottoOutputs['computer']['list'][number];

export function ComputerAgents({
    computerId,
    serverId,
    serverSlug,
}: {
    computerId: string;
    serverId: string;
    serverSlug: string;
}) {
    const agents = useAgents(serverId);
    const computers = useComputers(serverId);
    const computer = computers.data?.find((candidate) => candidate.id === computerId);
    const items = (agents.data ?? []).filter((agent) => agent.computerId === computerId);

    if (!computer) {
        return null;
    }

    return (
        <section className="grid gap-4 py-5">
            <h2 className="font-medium text-muted text-sm">
                Agents on This Computer
                {agents.data ? <span className="ms-2 tabular-nums">{items.length}</span> : null}
            </h2>
            {!agents.data && agents.isPending ? (
                <div aria-busy="true" className="min-h-14">
                    <span className="sr-only">Loading Agents on this Computer</span>
                </div>
            ) : items.length > 0 ? (
                <div className="grid">
                    {items.map((agent) => (
                        <AgentRow
                            agent={agent}
                            inventory={computer.reportedInventory}
                            key={agent.id}
                            serverSlug={serverSlug}
                        />
                    ))}
                </div>
            ) : (
                <p className="text-muted text-sm">No Agents on this Computer.</p>
            )}
        </section>
    );
}

function AgentRow({
    agent,
    inventory,
    serverSlug,
}: {
    agent: GrottoOutputs['agent']['list'][number];
    inventory: Computer['reportedInventory'];
    serverSlug: string;
}) {
    const execution = agentExecutionLabels(agent, inventory);

    return (
        <Link
            className="flex min-w-0 items-center gap-3 border-separator border-b py-3 outline-none last:border-b-0 hover:bg-background-hover focus-visible:bg-background-hover"
            to={agentRoute(serverSlug, agent.id)}
        >
            <EntityAvatar name={agent.displayName} size="sm" src={agent.avatarUrl} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                <p className="truncate font-medium text-foreground text-sm">{agent.displayName}</p>
                <p className="truncate text-muted text-sm">
                    {execution.runtime} · {execution.model}
                </p>
            </div>
            <Chip color={availabilityBadgeColor(agent.availability)} size="sm" variant="soft">
                {availabilityLabel(agent.availability)}
            </Chip>
        </Link>
    );
}
