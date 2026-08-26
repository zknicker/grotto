import { Description, Label, ListBox, Select } from '@heroui/react';
import type { CSSProperties } from 'react';
import { EntityAvatar, type EntityAvatarProps } from '../../components/ui/entity-avatar.tsx';
import type { AgentUsage } from './token-usage-view.ts';
import { formatTokens } from './usage-format.ts';

const ALL_AGENTS = 'all';

/** Rail scale: an identity mark the trigger can carry without growing around it. */
const triggerMarkSize = 20;

/**
 * Pill chrome instead of field chrome.
 *
 * HeroUI dresses input-family controls as fields — the `×1.5` radius tier and a
 * `--field-border` hairline — and buttons as pills, at `×3` with no border. A
 * stock Select beside a ToggleButtonGroup therefore reads as the heavier, larger
 * control even at the same background and near-identical height, because an
 * outline enlarges what it wraps.
 *
 * This one is a toolbar filter, not form input, and DESIGN.md files Toolbar
 * under the pill tier. Both differences resolve through the variables HeroUI
 * exposes for exactly this, scoped to this control so real form fields keep
 * their field chrome. `variant="secondary"` already drops the third piece, the
 * field shadow, and lands the same `--default` background as the pill.
 */
const toolbarFilterChrome = {
    '--border-width-field': '0',
    '--field-radius': 'calc(var(--radius) * 3)',
} as CSSProperties;

/**
 * Whose usage the dashboard is showing.
 *
 * This was one KPI card per Agent in an auto-fit grid — fine at two Agents, and
 * three stacked rows of cards above the chart at ten. It was also doing two
 * jobs: choosing a scope, and comparing Agents. The comparison already lives
 * further down the same page in Token usage detail, broken down by Agent,
 * runtime and model, so this keeps only the choosing — at constant height, for
 * any number of Agents.
 *
 * The totals ride along as each option's description, so the dropdown still
 * answers "who is burning tokens" without a card per Agent.
 *
 * The list carries full-size marks; the trigger uses the rail-scale one, so the
 * control keeps its own field height instead of being pushed taller by an
 * avatar and towering over the range beside it.
 */
export function AgentUsageScopePicker({
    agents,
    onSelect,
    selectedAgentId,
}: {
    agents: AgentUsage[];
    onSelect: (agentId: null | string) => void;
    selectedAgentId: null | string;
}) {
    const totalTokens = agents.reduce((sum, agent) => sum + agent.totalTokens, 0);
    const selected = agents.find((agent) => agent.agentId === selectedAgentId);

    return (
        <Select
            aria-label="Token usage scope"
            className="w-56"
            onChange={(value) => onSelect(value === ALL_AGENTS ? null : String(value))}
            style={toolbarFilterChrome}
            value={selectedAgentId ?? ALL_AGENTS}
            variant="secondary"
        >
            <Select.Trigger>
                <Select.Value>
                    {() =>
                        selected ? (
                            <span className="flex min-w-0 items-center gap-2">
                                <EntityAvatar
                                    name={selected.agentName}
                                    size={triggerMarkSize}
                                    src={selected.agentAvatarUrl}
                                />
                                <span className="truncate">{selected.agentName}</span>
                            </span>
                        ) : (
                            <span className="flex min-w-0 items-center gap-2">
                                <AllAgentsMark agents={agents} size={triggerMarkSize} />
                                <span className="truncate">All Agents</span>
                            </span>
                        )
                    }
                </Select.Value>
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox>
                    <ListBox.Item id={ALL_AGENTS} textValue="All Agents">
                        <AllAgentsMark agents={agents} />
                        <div className="flex min-w-0 flex-col">
                            <Label>All Agents</Label>
                            <Description>
                                {formatTokens(totalTokens)} across {agents.length}{' '}
                                {agents.length === 1 ? 'Agent' : 'Agents'}
                            </Description>
                        </div>
                        <ListBox.ItemIndicator />
                    </ListBox.Item>
                    {agents.map((agent) => (
                        <ListBox.Item
                            id={agent.agentId}
                            key={agent.agentId}
                            textValue={agent.agentName}
                        >
                            <EntityAvatar
                                name={agent.agentName}
                                size="sm"
                                src={agent.agentAvatarUrl}
                            />
                            <div className="flex min-w-0 flex-col">
                                <Label>{agent.agentName}</Label>
                                <Description>
                                    {formatTokens(agent.totalTokens)} · @{agent.agentHandle}
                                </Description>
                            </div>
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}

/** The whole roster as one mark, so "everyone" reads as a face rather than a word. */
function AllAgentsMark({
    agents,
    size = 'sm',
}: {
    agents: AgentUsage[];
    size?: EntityAvatarProps['size'];
}) {
    return (
        <span className="flex shrink-0 -space-x-2">
            {agents.slice(0, 3).map((agent) => (
                <EntityAvatar
                    className="ring-2 ring-surface"
                    key={agent.agentId}
                    name={agent.agentName}
                    size={size}
                    src={agent.agentAvatarUrl}
                />
            ))}
        </span>
    );
}
