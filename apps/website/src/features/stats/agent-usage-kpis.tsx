import { Button, Chip } from '@heroui/react';
import { KPI } from '@heroui-pro/react/kpi';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import type { AgentUsage } from './token-usage-view.ts';
import { formatTokens } from './usage-format.ts';

export function AgentUsageKpis({
    agents,
    onSelect,
    selectedAgentId,
}: {
    agents: AgentUsage[];
    onSelect: (agentId: null | string) => void;
    selectedAgentId: null | string;
}) {
    const totalTokens = agents.reduce((sum, agent) => sum + agent.totalTokens, 0);
    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3">
            <Button
                aria-pressed={selectedAgentId === null}
                className="h-full w-full min-w-0 p-0 text-start"
                onPress={() => onSelect(null)}
                variant="ghost"
            >
                <KPI
                    className={
                        selectedAgentId === null
                            ? 'h-full w-full ring-2 ring-accent'
                            : 'h-full w-full'
                    }
                >
                    <KPI.Header>
                        <div className="flex -space-x-2">
                            {agents.slice(0, 3).map((agent) => (
                                <EntityAvatar
                                    className="ring-2 ring-surface"
                                    key={agent.agentId}
                                    name={agent.agentName}
                                    size="sm"
                                    src={agent.agentAvatarUrl}
                                />
                            ))}
                        </div>
                        <KPI.Title className="text-base">All Agents</KPI.Title>
                    </KPI.Header>
                    <KPI.Content>
                        <KPI.Value
                            maximumFractionDigits={1}
                            notation="compact"
                            value={totalTokens}
                        />
                        <Chip size="sm" variant="soft">
                            {agents.length} {agents.length === 1 ? 'agent' : 'agents'}
                        </Chip>
                    </KPI.Content>
                    <KPI.Footer className="truncate text-sm">
                        Combined usage across every configuration
                    </KPI.Footer>
                </KPI>
            </Button>
            {agents.map((agent) => (
                <Button
                    aria-pressed={selectedAgentId === agent.agentId}
                    className="h-full w-full min-w-0 p-0 text-start"
                    key={agent.agentId}
                    onPress={() => onSelect(agent.agentId)}
                    variant="ghost"
                >
                    <KPI
                        className={
                            selectedAgentId === agent.agentId
                                ? 'h-full w-full ring-2 ring-accent'
                                : 'h-full w-full'
                        }
                    >
                        <KPI.Header>
                            <EntityAvatar
                                name={agent.agentName}
                                size="sm"
                                src={agent.agentAvatarUrl}
                            />
                            <KPI.Title className="text-base">{agent.agentName}</KPI.Title>
                            <p className="ml-auto text-muted text-sm">@{agent.agentHandle}</p>
                        </KPI.Header>
                        <KPI.Content>
                            <KPI.Value
                                maximumFractionDigits={1}
                                notation="compact"
                                value={agent.totalTokens}
                            />
                            <Chip size="sm" variant="soft">
                                <span
                                    className="size-2 rounded-full"
                                    style={{ backgroundColor: agent.color }}
                                />
                                <Chip.Label>
                                    {totalTokens > 0
                                        ? `${((agent.totalTokens / totalTokens) * 100).toFixed(1)}%`
                                        : '0%'}
                                </Chip.Label>
                            </Chip>
                        </KPI.Content>
                        <KPI.Footer className="text-sm">
                            {formatTokens(agent.outputTokens)} output tokens
                        </KPI.Footer>
                    </KPI>
                </Button>
            ))}
        </div>
    );
}
