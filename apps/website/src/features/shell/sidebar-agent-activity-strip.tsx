import type { HostedAgent } from '@tavern/api';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    formatCurrentAgentActivityLabel,
    splitCurrentAgentActivity,
} from '../../hooks/agents/current-agent-activity.ts';
import { useOptionalCurrentAgentActivity } from '../../hooks/agents/use-current-agent-activity.tsx';
import { useAgents } from '../../hooks/members/use-agents.ts';
import { AgentAvatar } from '../members/agent-avatar.tsx';
import { agentRoute } from '../servers/server-routes.ts';

const fallbackAgent: Pick<HostedAgent, 'avatarUrl' | 'displayName'> = {
    avatarUrl: null,
    displayName: 'Agent',
};

export function SidebarAgentActivityStrip({ serverId, slug }: { serverId: string; slug: string }) {
    const currentActivity = useOptionalCurrentAgentActivity();
    const agents = useAgents(serverId);
    const shouldReduceMotion = useReducedMotion();
    const agentById = new Map((agents.data ?? []).map((agent) => [agent.id, agent]));
    const { hiddenCount, visible } = splitCurrentAgentActivity(currentActivity?.activities ?? []);

    if (!(currentActivity?.isSnapshotReady && visible.length > 0)) {
        return null;
    }

    return (
        <section
            aria-label="Current Agent activity"
            className="w-full border-separator border-t px-1 pt-2"
            data-slot="agent-activity-strip"
        >
            <div className="flex flex-col gap-0.5">
                <AnimatePresence initial={false} mode="popLayout">
                    {visible.map((activity) => {
                        const agent = agentById.get(activity.agentId) ?? {
                            ...fallbackAgent,
                            id: activity.agentId,
                        };
                        const label = formatCurrentAgentActivityLabel(activity);

                        return (
                            <motion.div
                                animate={{ opacity: 1, y: 0 }}
                                className="min-w-0 overflow-hidden"
                                data-agent-activity-row={activity.agentId}
                                exit={
                                    shouldReduceMotion
                                        ? { opacity: 0 }
                                        : { height: 0, opacity: 0, y: -4 }
                                }
                                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                                key={`${activity.agentId}:${activity.runId}`}
                                layout={shouldReduceMotion ? false : 'position'}
                                transition={
                                    shouldReduceMotion
                                        ? { duration: 0 }
                                        : { duration: 0.18, ease: 'easeOut' }
                                }
                            >
                                <Link
                                    aria-label={`${agent.displayName}: ${label}`}
                                    className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-muted text-xs outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus"
                                    to={agentRoute(slug, activity.agentId)}
                                >
                                    <AgentAvatar agent={agent} size={20} />
                                    <span className="min-w-0 truncate">{label}</span>
                                </Link>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                {hiddenCount > 0 ? (
                    <span className="px-2 py-1 text-muted text-xs">{hiddenCount} more working</span>
                ) : null}
            </div>
        </section>
    );
}
