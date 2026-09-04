import type { Agent } from '@grotto/api';
import { ListView } from '@heroui-pro/react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import {
    type CurrentAgentActivity,
    filterCurrentAgentActivityByLifecycle,
    formatCurrentAgentActivityLabel,
} from '../../../hooks/agents/current-agent-activity.ts';
import { useOptionalCurrentAgentActivity } from '../../../hooks/agents/use-current-agent-activity.tsx';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { AgentAvatar } from '../../members/agent-avatar.tsx';
import { useAgentLifecycle } from '../agent-lifecycle.tsx';
import { useServerContext } from '../server-context.ts';
import { settingsAgentRoute } from '../server-routes.ts';
import { InboxSection, InboxSectionEmpty, InboxSectionPending } from './inbox-section.tsx';

interface HappeningNowRow {
    agent: Agent | null;
    id: string;
    label: string;
    name: string;
}

/**
 * Work running right now, whether or not this human started it. The Agent
 * activity provider already owns the read and its live events, so this reads
 * the same snapshot the sidebar strip does. Cloud Agent work joins it once
 * that record exists.
 */
export function InboxHappeningNow() {
    const { server } = useServerContext();
    const navigate = useNavigate();
    const currentActivity = useOptionalCurrentAgentActivity();
    const lifecycles = useAgentLifecycle();
    const agents = useAgents(server.id);
    const activities = currentActivity?.activities ?? [];
    const rows = React.useMemo(
        () =>
            happeningNowRows(
                filterCurrentAgentActivityByLifecycle(activities, lifecycles),
                agents.data ?? []
            ),
        [activities, agents.data, lifecycles]
    );

    return (
        <InboxSection title="Happening now">
            {currentActivity?.isSnapshotReady === true ? (
                rows.length === 0 ? (
                    <InboxSectionEmpty description="No agents are working right now." />
                ) : (
                    <ListView
                        aria-label="Agents working now"
                        items={rows}
                        onAction={(key) => navigate(settingsAgentRoute(server.slug, String(key)))}
                        variant="secondary"
                    >
                        {(row) => (
                            <ListView.Item id={row.id} textValue={row.name}>
                                <ListView.ItemContent>
                                    {row.agent ? (
                                        <AgentAvatar agent={row.agent} size={24} />
                                    ) : (
                                        <EntityAvatar name={row.name} size={24} src={null} />
                                    )}
                                    <div className="flex min-w-0 flex-col">
                                        <ListView.Title>{row.name}</ListView.Title>
                                        <ListView.Description>{row.label}</ListView.Description>
                                    </div>
                                </ListView.ItemContent>
                            </ListView.Item>
                        )}
                    </ListView>
                )
            ) : (
                <InboxSectionPending label="Loading current Agent work" />
            )}
        </InboxSection>
    );
}

function happeningNowRows(
    activities: readonly CurrentAgentActivity[],
    agents: readonly Agent[]
): HappeningNowRow[] {
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));

    return activities.map((activity) => {
        const agent = agentById.get(activity.agentId) ?? null;
        return {
            agent,
            id: activity.agentId,
            label: formatCurrentAgentActivityLabel(activity),
            name: agent?.displayName ?? `Agent ${activity.agentId.slice(-6)}`,
        };
    });
}
