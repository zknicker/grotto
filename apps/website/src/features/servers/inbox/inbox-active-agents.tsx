import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRelativeNow } from '../../../components/time/relative-time.tsx';
import { useOptionalCurrentAgentActivity } from '../../../hooks/agents/use-current-agent-activity.tsx';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useAgentLifecycle } from '../agent-lifecycle.tsx';
import { useServerContext } from '../server-context.ts';
import { agentProfileRoute, serverChatRoute } from '../server-routes.ts';
import { rankActiveAgents, toActiveAgent } from './active-agents.ts';
import { AgentWeekCard } from './agent-week-card.tsx';
import { AgentWeekStrip } from './agent-week-strip.tsx';
import { currentAgentActivityLabels } from './inbox-agent-activity.ts';
import { InboxSectionLabel } from './inbox-section.tsx';
import { useAgentWeekTurns } from './use-agent-week-turns.ts';

/**
 * The Agents worth looking at right now, as a scrolling row of week cards.
 *
 * This is deliberately not a roster. A Server can hold thirty-five Agents, and
 * a card for every one of them is a wall to scan rather than a thing to read;
 * the strip carries the handful that actually moved this week, busiest and
 * live-est first. The full directory is the sidebar's job.
 *
 * The strip is the page's only uncarded section: a small label over cards that
 * already have edges. Wrapping it in a group would put a border around
 * borders.
 */
export function InboxActiveAgents() {
    const { server } = useServerContext();
    const navigate = useNavigate();
    const agents = useAgents(server.id);
    const currentActivity = useOptionalCurrentAgentActivity();
    const lifecycles = useAgentLifecycle();
    // The week only redraws on the minute; a live step label is the one thing
    // that has to stay fresh while a card is counting up.
    const now = useRelativeNow(30_000);
    const turnsByAgent = useAgentWeekTurns(server.id);
    const activities = currentActivity?.activities ?? [];
    const labels = React.useMemo(
        () => currentAgentActivityLabels(activities, lifecycles),
        [activities, lifecycles]
    );
    const rows = React.useMemo(() => {
        if (!(agents.data && turnsByAgent)) {
            return null;
        }
        return rankActiveAgents(
            agents.data.map((agent) =>
                toActiveAgent(agent, turnsByAgent.get(agent.id), labels.get(agent.id) ?? null, now)
            )
        );
    }, [agents.data, labels, now, turnsByAgent]);

    return (
        <section className="flex flex-col gap-3">
            <InboxSectionLabel>Active this week</InboxSectionLabel>
            {rows === null ? null : rows.length === 0 ? (
                <p className="text-muted text-sm">No Agent activity this week.</p>
            ) : (
                <AgentWeekStrip>
                    {rows.map((row) => (
                        <AgentWeekCard
                            activity={row}
                            key={row.agent.id}
                            onPress={() =>
                                navigate(
                                    row.agent.dmChatId
                                        ? serverChatRoute(server.slug, row.agent.dmChatId)
                                        : agentProfileRoute(server.slug, row.agent.id)
                                )
                            }
                        />
                    ))}
                </AgentWeekStrip>
            )}
        </section>
    );
}
