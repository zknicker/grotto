import type { Agent } from '@haus/api';
import { ListView } from '@heroui-pro/react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRelativeNow } from '../../../components/time/relative-time.tsx';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import {
    type CurrentAgentActivity,
    filterCurrentAgentActivityByLifecycle,
    formatCurrentAgentActivityLabel,
} from '../../../hooks/agents/current-agent-activity.ts';
import { useOptionalCurrentAgentActivity } from '../../../hooks/agents/use-current-agent-activity.tsx';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useActiveCloudAgentWork } from '../../../hooks/servers/use-cloud-agent-work.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { useCloudAgentWorkView } from '../../cloud-agents/use-cloud-agent-work-view.ts';
import { AgentAvatar } from '../../members/agent-avatar.tsx';
import { useAgentLifecycle } from '../agent-lifecycle.tsx';
import { useServerContext } from '../server-context.ts';
import { agentProfileRoute } from '../server-routes.ts';
import { toHappeningNowWork } from './happening-now-work.ts';
import { HappeningNowWorkList } from './happening-now-work-list.tsx';
import { InboxSection, InboxSectionEmpty, InboxSectionPending } from './inbox-section.tsx';

interface HappeningNowRow {
    agent: Agent | null;
    id: string;
    label: string;
    name: string;
}

/**
 * Work running right now, whether or not this human started it: Cloud Agent
 * work first, because it outlives the turn that delegated it, then the Agents
 * currently in a turn. Both read the snapshot their own source already owns.
 */
export function InboxHappeningNow() {
    const { server } = useServerContext();
    const navigate = useNavigate();
    const { openWork } = useCloudAgentWorkView();
    const currentActivity = useOptionalCurrentAgentActivity();
    const lifecycles = useAgentLifecycle();
    const agents = useAgents(server.id);
    const humans = useHumanDirectory(server.id);
    const cloudAgentWork = useActiveCloudAgentWork(server.id);
    // Elapsed time ticks on the rows the same way it does on a work surface —
    // and only while a row is actually counting up.
    const now = useRelativeNow(cloudAgentWork.data?.length ? 5000 : 60_000);
    const activities = currentActivity?.activities ?? [];
    const rows = React.useMemo(
        () =>
            happeningNowRows(
                filterCurrentAgentActivityByLifecycle(activities, lifecycles),
                agents.data ?? []
            ),
        [activities, agents.data, lifecycles]
    );
    const workRows = React.useMemo(
        () => toHappeningNowWork(cloudAgentWork.data ?? [], humans, agents.data ?? [], now),
        [agents.data, cloudAgentWork.data, humans, now]
    );
    // Both reads make the same claim — that nothing is running — so the section
    // stays neutral until both have settled rather than emptying, then filling.
    const settled = currentActivity?.isSnapshotReady === true && Boolean(cloudAgentWork.data);

    if (!settled) {
        return (
            <InboxSection title="Happening now">
                <InboxSectionPending label="Loading current Agent work" />
            </InboxSection>
        );
    }

    return (
        <InboxSection title="Happening now">
            {rows.length === 0 && workRows.length === 0 ? (
                <InboxSectionEmpty description="No agents are working right now." />
            ) : (
                <>
                    {workRows.length > 0 ? (
                        <HappeningNowWorkList onOpenWork={openWork} work={workRows} />
                    ) : null}
                    {rows.length > 0 ? (
                        <ListView
                            aria-label="Agents working now"
                            items={rows}
                            onAction={(key) =>
                                navigate(agentProfileRoute(server.slug, String(key)))
                            }
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
                    ) : null}
                </>
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
