import {
    Checkbox,
    CheckboxGroup,
    Description,
    FieldError,
    Label,
    ScrollShadow,
    SearchField,
    Spinner,
} from '@heroui/react';
import * as React from 'react';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';

export interface ChannelAgentOption {
    avatarUrl: string | null;
    id: string;
    name: string;
}

/** The roster of Agents in a channel, shared by channel creation and editing. */
export function ChannelAgentPicker({
    agents,
    agentsPending,
    isDisabled,
    onSelectedAgentIdsChange,
    selectedAgentIds,
}: {
    agents: ChannelAgentOption[];
    agentsPending: boolean;
    isDisabled: boolean;
    onSelectedAgentIdsChange: (agentIds: string[]) => void;
    selectedAgentIds: string[];
}) {
    const [query, setQuery] = React.useState('');
    const trimmedQuery = query.trim().toLowerCase();
    const visibleAgents = trimmedQuery
        ? agents.filter((agent) => agent.name.toLowerCase().includes(trimmedQuery))
        : agents;
    const missingSelection = !agentsPending && agents.length > 0 && selectedAgentIds.length === 0;

    return (
        // CheckboxGroup's own anatomy: Label, Description, the controls, then
        // FieldError. Keeping Label inside gives the group its accessible name,
        // and keeping FieldError outside the scroll area means a validation
        // message cannot scroll out of view behind a long roster.
        <CheckboxGroup
            className="gap-1"
            isDisabled={isDisabled}
            isInvalid={missingSelection}
            onChange={(nextAgentIds) =>
                onSelectedAgentIdsChange(normalizeChannelAgentIds(nextAgentIds))
            }
            value={selectedAgentIds}
            variant="secondary"
        >
            <Label>Agents</Label>
            <Description>A channel keeps at least one Agent.</Description>
            {agents.length > searchableAgentCount ? (
                <SearchField
                    aria-label="Filter agents"
                    className="mt-1"
                    onChange={setQuery}
                    value={query}
                    variant="secondary"
                >
                    <SearchField.Group>
                        <SearchField.SearchIcon />
                        <SearchField.Input placeholder="Filter agents..." />
                        <SearchField.ClearButton />
                    </SearchField.Group>
                </SearchField>
            ) : null}
            {agents.length > 0 ? (
                // Rows, not cards: an Agent is an avatar and a name. Bounded so
                // the dialog is the same size at 2 Agents and at 200.
                <ScrollShadow className="mt-1 max-h-56 overflow-y-auto">
                    <div className="flex flex-col gap-2 **:data-[slot=checkbox]:mt-0">
                        {visibleAgents.map((agent) => (
                            <Checkbox key={agent.id} value={agent.id}>
                                <Checkbox.Content className="items-center gap-3">
                                    <Checkbox.Control>
                                        <Checkbox.Indicator />
                                    </Checkbox.Control>
                                    <EntityAvatar
                                        name={agent.name}
                                        size="sm"
                                        src={agent.avatarUrl}
                                    />
                                    {agent.name}
                                </Checkbox.Content>
                            </Checkbox>
                        ))}
                    </div>
                </ScrollShadow>
            ) : null}
            {!agentsPending && agents.length > 0 && visibleAgents.length === 0 ? (
                <Description>No agents match.</Description>
            ) : null}
            {agentsPending ? (
                <div className="mt-1 flex items-center gap-2 text-muted text-sm">
                    <Spinner color="current" size="sm" />
                    Loading agents
                </div>
            ) : null}
            {!agentsPending && agents.length === 0 ? (
                <Description>No agents available.</Description>
            ) : null}
            <FieldError>Choose at least one Agent.</FieldError>
        </CheckboxGroup>
    );
}

const searchableAgentCount = 8;

export function normalizeChannelAgentIds(agentIds: string[]) {
    return [...new Set(agentIds.map((agentId) => agentId.trim()).filter(Boolean))];
}
