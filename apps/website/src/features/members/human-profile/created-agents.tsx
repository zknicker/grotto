import { Chip, Separator } from '@heroui/react';
import type { Agent } from '@tavern/api';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { agentRoute } from '../../servers/server-routes.ts';
import { SettingsGroup, SettingsSection } from '../../settings/layout/settings-page.tsx';
import { availabilityBadgeColor } from '../agent-avatar.tsx';

/** Agents created by one human, with its own focused list read. */
export function CreatedAgents({
    serverId,
    serverSlug,
    userId,
}: {
    serverId: string;
    serverSlug: string;
    userId: string;
}) {
    const agents = useAgents(serverId);
    const created = (agents.data ?? []).filter((agent) => agent.createdByUserId === userId);

    return (
        <SettingsSection
            action={
                agents.data ? (
                    <Chip size="sm" variant="soft">
                        <Chip.Label>{created.length}</Chip.Label>
                    </Chip>
                ) : null
            }
            title="Created Agents"
        >
            {!agents.data && agents.isPending ? (
                <div aria-busy="true" className="min-h-24">
                    <span className="sr-only">Loading created Agents</span>
                </div>
            ) : created.length === 0 ? (
                <p className="px-1 text-muted text-sm">No Agents created by this human yet.</p>
            ) : (
                <SettingsGroup>
                    {created.map((agent, index) => (
                        <React.Fragment key={agent.id}>
                            {index > 0 ? <Separator /> : null}
                            <CreatedAgentRow agent={agent} slug={serverSlug} />
                        </React.Fragment>
                    ))}
                </SettingsGroup>
            )}
        </SettingsSection>
    );
}

function CreatedAgentRow({ agent, slug }: { agent: Agent; slug: string }) {
    const navigate = useNavigate();

    return (
        <button
            className="flex w-full cursor-[var(--cursor-interactive)] items-center gap-3 px-5 py-3.5 text-left outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus"
            onClick={() => navigate(agentRoute(slug, agent.id))}
            type="button"
        >
            <EntityAvatar name={agent.displayName} size="sm" src={agent.avatarUrl} />
            <span className="min-w-0 truncate font-medium text-foreground text-sm">
                {agent.displayName}
            </span>
            <Chip
                className="ml-auto capitalize"
                color={availabilityBadgeColor(agent.availability)}
                size="sm"
                variant="soft"
            >
                {agent.availability}
            </Chip>
        </button>
    );
}
