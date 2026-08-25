import type { Agent } from '@grotto/api';
import { Chip, Separator } from '@heroui/react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { AgentAvatar, availabilityLabel } from '../members/agent-avatar.tsx';
import { settingsAgentRoute } from './server-routes.ts';

/**
 * The Agents on one Server, in the Members directory beside the humans.
 *
 * Both are Server participants carrying a Server role — an Agent's lives on the
 * agent record rather than in `server_memberships`, but it is the same
 * Owner/Admin/Member vocabulary — so a directory that listed only humans named
 * half its subject.
 *
 * Rows are read-only on purpose. An Agent's role is fixed at creation (no
 * update procedure exists for it) and deletion belongs to the Agent's own
 * Danger section, so the row identifies and links rather than pretending to
 * manage.
 */
export function ServerAgentList({ agents, serverSlug }: { agents: Agent[]; serverSlug: string }) {
    return (
        <>
            {agents.map((agent, index) => (
                <React.Fragment key={agent.id}>
                    {index > 0 ? <Separator /> : null}
                    <Link
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 outline-none hover:bg-default/40 focus-visible:ring-2 focus-visible:ring-focus"
                        to={settingsAgentRoute(serverSlug, agent.id)}
                    >
                        <span className="flex min-w-0 items-center gap-2.5">
                            <AgentAvatar agent={agent} size={24} />
                            <span className="min-w-0 truncate font-medium text-foreground text-sm">
                                {agent.displayName}
                            </span>
                            <Chip size="sm" variant="secondary">
                                <Chip.Label className="capitalize">{agent.role}</Chip.Label>
                            </Chip>
                            <span className="truncate text-muted text-sm">@{agent.handle}</span>
                        </span>
                        <span className="shrink-0 text-muted text-sm">
                            {availabilityLabel(agent.availability)}
                        </span>
                    </Link>
                </React.Fragment>
            ))}
        </>
    );
}
