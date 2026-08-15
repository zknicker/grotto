import { Chip } from '@heroui/react';
import { DataGrid, type DataGridColumn, ItemCardGroup } from '@heroui-pro/react';
import { useNavigate } from 'react-router-dom';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { useAgents } from '../../hooks/members/use-agents.ts';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import type { GrottoOutputs } from '../../lib/grotto-server.tsx';
import { availabilityBadgeColor } from '../members/agent-avatar.tsx';
import { agentRoute } from '../servers/server-routes.ts';
import { agentExecutionLabels, availabilityLabel } from './presentation.ts';

type Agent = GrottoOutputs['agent']['list'][number];
type Computer = GrottoOutputs['computer']['list'][number];

interface ComputerAgentRow {
    availability: Agent['availability'];
    avatarUrl: string | null;
    displayName: string;
    id: string;
    model: string;
    runtime: string;
}

export function ComputerAgents({
    computerId,
    serverId,
    serverSlug,
}: {
    computerId: string;
    serverId: string;
    serverSlug: string;
}) {
    const navigate = useNavigate();
    const agents = useAgents(serverId);
    const computers = useComputers(serverId);
    const computer = computers.data?.find((candidate) => candidate.id === computerId);
    const items = (agents.data ?? []).filter((agent) => agent.computerId === computerId);

    if (!computer) {
        return null;
    }

    const rows = computerAgentRows(items, computer.reportedInventory);

    return (
        <section className="py-5">
            <ItemCardGroup variant="transparent">
                <ItemCardGroup.Header>
                    <ItemCardGroup.Title>
                        Agents on This Computer
                        {agents.data ? (
                            <span className="ms-2 text-muted tabular-nums">{rows.length}</span>
                        ) : null}
                    </ItemCardGroup.Title>
                </ItemCardGroup.Header>
                {!agents.data && agents.isPending ? (
                    <div aria-busy="true" className="min-h-14">
                        <span className="sr-only">Loading Agents on this Computer</span>
                    </div>
                ) : rows.length > 0 ? (
                    <ComputerAgentGrid
                        onOpenAgent={(agentId) => navigate(agentRoute(serverSlug, agentId))}
                        rows={rows}
                    />
                ) : (
                    <p className="text-muted text-sm">No Agents on this Computer.</p>
                )}
            </ItemCardGroup>
        </section>
    );
}

export function ComputerAgentGrid({
    onOpenAgent,
    rows,
}: {
    onOpenAgent: (agentId: string) => void;
    rows: ComputerAgentRow[];
}) {
    return (
        <DataGrid
            aria-label="Agents on this Computer"
            columns={agentColumns}
            contentClassName="min-w-160"
            data={rows}
            getRowId={(item) => item.id}
            onRowAction={(key) => onOpenAgent(String(key))}
        />
    );
}

function computerAgentRows(
    agents: Agent[],
    inventory: Computer['reportedInventory']
): ComputerAgentRow[] {
    return agents.map((agent) => {
        const execution = agentExecutionLabels(agent, inventory);
        return {
            avatarUrl: agent.avatarUrl,
            availability: agent.availability,
            displayName: agent.displayName,
            id: agent.id,
            model: execution.model,
            runtime: execution.runtime,
        };
    });
}

const agentColumns: DataGridColumn<ComputerAgentRow>[] = [
    {
        allowsSorting: true,
        cell: (item) => (
            <div className="flex min-w-0 items-center gap-3">
                <EntityAvatar
                    className="shrink-0"
                    name={item.displayName}
                    size="sm"
                    src={item.avatarUrl}
                />
                <p className="truncate font-medium text-base">{item.displayName}</p>
            </div>
        ),
        header: 'Agent',
        headerClassName: 'text-sm',
        id: 'displayName',
        isRowHeader: true,
        minWidth: 180,
        sortFn: (a, b) => a.displayName.localeCompare(b.displayName),
    },
    {
        accessorKey: 'runtime',
        allowsSorting: true,
        cellClassName: 'text-sm text-muted',
        header: 'Runtime',
        headerClassName: 'text-sm',
        id: 'runtime',
        minWidth: 120,
    },
    {
        accessorKey: 'model',
        allowsSorting: true,
        cellClassName: 'text-sm text-muted',
        header: 'Model',
        headerClassName: 'text-sm',
        id: 'model',
        minWidth: 160,
    },
    {
        align: 'end',
        cell: (item) => (
            <Chip color={availabilityBadgeColor(item.availability)} size="lg" variant="soft">
                {availabilityLabel(item.availability)}
            </Chip>
        ),
        header: 'Status',
        headerClassName: 'text-sm',
        id: 'availability',
        minWidth: 100,
    },
];
