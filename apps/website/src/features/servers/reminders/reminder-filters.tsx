import { Label, ListBox, SearchField, Select } from '@heroui/react';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import type { ReminderConnectionState } from '../../../hooks/servers/use-reminder-events.ts';
import { AgentOptionLabel } from '../../agents/agent-option-label.tsx';
import type { ReminderFilters as ReminderFilterValues } from './reminder-model.ts';
import { useReminderView } from './use-reminder-view.ts';

const statusLabels: Record<ReminderFilterValues['status'], string> = {
    all: 'All Statuses',
    canceled: 'Canceled',
    fired: 'Fired',
    scheduled: 'Scheduled',
};

const statuses = Object.keys(statusLabels) as ReminderFilterValues['status'][];

export function ReminderFilters({
    connection,
    serverId,
}: {
    connection: ReminderConnectionState;
    serverId: string;
}) {
    const agents = useAgents(serverId);
    const { filters, setAgentId, setQuery, setStatus } = useReminderView();
    const agentItems = (agents.data ?? []).map((agent) => ({
        avatarUrl: agent.avatarUrl,
        id: agent.id,
        name: agent.displayName,
    }));
    const selectedAgent = agentItems.find((agent) => agent.id === filters.agentId) ?? null;

    return (
        <>
            <Select
                aria-label="Filter by agent"
                onChange={(value) => setAgentId(value === 'all' ? null : String(value))}
                value={filters.agentId ?? 'all'}
                variant="secondary"
            >
                <Select.Trigger>
                    <Select.Value>
                        {selectedAgent ? <AgentOptionLabel agent={selectedAgent} /> : 'All Agents'}
                    </Select.Value>
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        <ListBox.Item id="all" textValue="All Agents">
                            <Label>All Agents</Label>
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                        {agentItems.map((agent) => (
                            <ListBox.Item id={agent.id} key={agent.id} textValue={agent.name}>
                                <Label>
                                    <AgentOptionLabel agent={agent} />
                                </Label>
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>
            <Select
                aria-label="Filter by status"
                onChange={(value) => setStatus(String(value) as ReminderFilterValues['status'])}
                value={filters.status}
                variant="secondary"
            >
                <Select.Trigger>
                    <Select.Value>{statusLabels[filters.status]}</Select.Value>
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        {statuses.map((status) => (
                            <ListBox.Item id={status} key={status} textValue={statusLabels[status]}>
                                <Label>{statusLabels[status]}</Label>
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>
            <SearchField
                aria-label="Search hosted reminders"
                className="min-w-48 flex-1"
                onChange={setQuery}
                value={filters.query}
            >
                <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Search reminders..." />
                    <SearchField.ClearButton />
                </SearchField.Group>
            </SearchField>
            {connection === 'connected' ? null : (
                <span className="ms-auto shrink-0 whitespace-nowrap text-muted text-xs">
                    Reconnecting · showing last hosted state
                </span>
            )}
        </>
    );
}
