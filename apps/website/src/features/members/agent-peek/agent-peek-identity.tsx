import type { Agent, ComputerInventory } from '@grotto/api';
import { Chip } from '@heroui/react';
import { Link } from 'react-router-dom';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import { useComputers } from '../../../hooks/servers/use-computers.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import {
    agentExecutionLabels,
    availabilityLabel,
    computerLabel,
} from '../../computers/presentation.ts';
import { serverComputersRoute } from '../../servers/server-routes.ts';
import { resolveAgentHoverExecution } from '../agent-hover-card.tsx';
import { type AgentPeekExecution, formatExecutionDetail } from './agent-peek-model.ts';

/**
 * Who this Agent is, at the density the hover card established: the mark, the
 * name with its role and availability, the handle, two lines of description,
 * and one line naming where and on what it runs. Every fact appears once.
 */
export function AgentPeekIdentity({ agent, server }: { agent: Agent; server: ServerDetail }) {
    const computers = useComputers(server.id);
    const computer = computers.data?.find((candidate) => candidate.id === agent.computerId);
    const execution = resolvePeekExecution(agent, computer?.reportedInventory ?? null);
    const computerNode = computer ? (
        <Link
            className="min-w-0 truncate text-accent hover:underline"
            to={`${serverComputersRoute(server.slug)}?computer=${encodeURIComponent(agent.computerId)}`}
        >
            {computerLabel(computer)}
        </Link>
    ) : computers.isPending ? null : (
        <span>Computer unavailable</span>
    );

    return (
        <header className="flex min-w-0 flex-col gap-3">
            <div className="flex min-w-0 items-center gap-3">
                {/* The stock 48px step, so the mark's radius stays paired with
                    its box (docs/internals/avatars.md). Availability is the
                    text beside the name, not a second dot on the mark. */}
                <EntityAvatar
                    className="shrink-0"
                    name={agent.displayName}
                    size="lg"
                    src={agent.avatarUrl}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <strong className="min-w-0 truncate font-semibold text-base text-foreground">
                            {agent.displayName}
                        </strong>
                        <Chip
                            color={agent.role === 'member' ? 'default' : 'accent'}
                            size="sm"
                            variant="soft"
                        >
                            <Chip.Label className="capitalize">{agent.role}</Chip.Label>
                        </Chip>
                        <span className="shrink-0 text-muted text-sm">
                            {availabilityLabel(agent.availability)}
                        </span>
                    </div>
                    <span className="min-w-0 truncate text-muted text-sm">@{agent.handle}</span>
                </div>
            </div>
            {agent.description ? (
                <p className="line-clamp-2 min-w-0 text-muted text-sm">{agent.description}</p>
            ) : null}
            <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-muted text-sm">
                {/* Sync-first: while the roster is still loading this line is
                    the execution alone rather than a guessed Computer name. */}
                {computerNode}
                {computerNode ? <span aria-hidden="true">·</span> : null}
                <span className="min-w-0 truncate">{formatExecutionDetail(execution)}</span>
            </p>
        </header>
    );
}

function resolvePeekExecution(
    agent: Agent,
    inventory: ComputerInventory | null
): AgentPeekExecution {
    const execution = resolveAgentHoverExecution(agent);

    if (execution.kind !== 'effective') {
        return execution;
    }

    const labels = agentExecutionLabels(
        { desiredModelId: execution.modelId, desiredRuntimeId: execution.runtimeId },
        inventory
    );

    return { kind: 'effective', model: labels.model, runtime: labels.runtime };
}
