import type { Agent } from '@grotto/api';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import type { Ref } from 'react';
import { Link } from 'react-router-dom';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import {
    type CurrentAgentActivity,
    filterCurrentAgentActivityByLifecycle,
    formatCurrentAgentActivityLabel,
    splitCurrentAgentActivity,
} from '../../hooks/agents/current-agent-activity.ts';
import { useOptionalCurrentAgentActivity } from '../../hooks/agents/use-current-agent-activity.tsx';
import { useAgents } from '../../hooks/members/use-agents.ts';
import { springs } from '../../lib/springs.ts';
import { AgentAvatar } from '../members/agent-avatar.tsx';
import { useAgentLifecycle } from '../servers/agent-lifecycle.tsx';
import { settingsAgentRoute } from '../servers/server-routes.ts';

type ActivityAgent =
    | { kind: 'live'; value: Agent }
    | {
          avatarUrl: Agent['avatarUrl'];
          displayName: Agent['displayName'];
          id: Agent['id'];
          kind: 'fallback';
      };

export interface AgentActivityStripRow {
    activity: CurrentAgentActivity;
    agent: ActivityAgent;
}

const easeOut = [0.23, 1, 0.32, 1] as const;

export function SidebarAgentActivityStrip({ serverId, slug }: { serverId: string; slug: string }) {
    const currentActivity = useOptionalCurrentAgentActivity();
    const agents = useAgents(serverId);
    const lifecycles = useAgentLifecycle();
    const activities = filterCurrentAgentActivityByLifecycle(
        currentActivity?.activities ?? [],
        lifecycles
    );
    const agentById = new Map((agents.data ?? []).map((agent) => [agent.id, agent]));
    const { hiddenCount, visible } = splitCurrentAgentActivity(activities);
    const rows = visible.map((activity) => ({
        activity,
        agent: resolveActivityAgent(agentById.get(activity.agentId), activity.agentId),
    }));

    if (currentActivity?.isSnapshotReady !== true) {
        return null;
    }

    return <AgentActivityStrip hiddenCount={hiddenCount} rows={rows} slug={slug} />;
}

/** Coordinated presentation for the live multi-Agent activity list. */
export function AgentActivityStrip({
    hiddenCount,
    rows,
    slug,
}: {
    hiddenCount: number;
    rows: readonly AgentActivityStripRow[];
    slug: string;
}) {
    const shouldReduceMotion = useReducedMotion();

    return (
        <section
            aria-label="Current Agent activity"
            className="w-full"
            data-slot="agent-activity-strip"
        >
            <LayoutGroup id={`agent-activity-strip-${slug}`}>
                <div className="flex flex-col gap-0.5">
                    <AnimatePresence initial={false} mode="popLayout">
                        {rows.map((row) => (
                            <AgentActivityRow
                                key={`${row.activity.agentId}:${row.activity.runId}`}
                                row={row}
                                shouldReduceMotion={shouldReduceMotion === true}
                                slug={slug}
                            />
                        ))}
                        {hiddenCount > 0 ? (
                            <motion.span
                                animate={{ opacity: 1 }}
                                className="px-2 py-1 text-muted text-sm"
                                exit={{ opacity: 0 }}
                                initial={{ opacity: 0 }}
                                key="hidden-agent-activity-count"
                                layout={!shouldReduceMotion}
                                transition={springs.fast}
                            >
                                {hiddenCount} more working
                            </motion.span>
                        ) : null}
                    </AnimatePresence>
                </div>
            </LayoutGroup>
        </section>
    );
}

function AgentActivityRow({
    ref,
    row,
    shouldReduceMotion,
    slug,
}: {
    ref?: Ref<HTMLDivElement>;
    row: AgentActivityStripRow;
    shouldReduceMotion: boolean;
    slug: string;
}) {
    const agent = row.agent.kind === 'live' ? row.agent.value : row.agent;
    const label = formatCurrentAgentActivityLabel(row.activity);

    return (
        <motion.div
            animate={{ opacity: 1, transform: 'translateY(0)' }}
            className="min-w-0"
            data-agent-activity-row={row.activity.agentId}
            exit={
                shouldReduceMotion
                    ? { opacity: 0, transition: springs.fast }
                    : {
                          opacity: 0,
                          transform: 'translateY(-4px)',
                          transition: springs.fast,
                      }
            }
            initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(4px)' }
            }
            layout={shouldReduceMotion ? false : 'position'}
            ref={ref}
            transition={{
                default: { ...springs.moderate, bounce: 0 },
                layout: { ...springs.moderate, bounce: 0 },
            }}
        >
            <Link
                aria-label={`${agent.displayName}: ${label}`}
                className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-muted text-sm outline-none hover:bg-background-hover focus-visible:ring-2 focus-visible:ring-focus"
                to={settingsAgentRoute(slug, row.activity.agentId)}
            >
                {row.agent.kind === 'live' ? (
                    <AgentAvatar agent={row.agent.value} size={24} />
                ) : (
                    <EntityAvatar
                        name={row.agent.displayName}
                        size={24}
                        src={row.agent.avatarUrl}
                    />
                )}
                <span className="relative min-w-0 flex-1 overflow-hidden">
                    <AnimatePresence initial={false} mode="popLayout">
                        <motion.span
                            animate={{ opacity: 1, transform: 'translateY(0)' }}
                            className="block truncate"
                            data-agent-activity-label={label}
                            exit={
                                shouldReduceMotion
                                    ? { opacity: 0 }
                                    : { opacity: 0, transform: 'translateY(-3px)' }
                            }
                            initial={
                                shouldReduceMotion
                                    ? { opacity: 0 }
                                    : { opacity: 0, transform: 'translateY(3px)' }
                            }
                            key={label}
                            transition={{ duration: shouldReduceMotion ? 0 : 0.12, ease: easeOut }}
                        >
                            {label}
                        </motion.span>
                    </AnimatePresence>
                </span>
            </Link>
        </motion.div>
    );
}

function resolveActivityAgent(agent: Agent | undefined, id: string): ActivityAgent {
    return agent
        ? { kind: 'live', value: agent }
        : { avatarUrl: null, displayName: 'Agent', id, kind: 'fallback' };
}
