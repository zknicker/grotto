import { Button, Tooltip } from '@heroui/react';
import { Plus } from '@hugeicons/core-free-icons';
import { Activity01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Link, useMatch, useNavigate } from 'react-router-dom';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { useAgents } from '../../hooks/members/use-agents.ts';
import { useMembers } from '../../hooks/servers/use-members.ts';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { cn } from '../../lib/utils.ts';
import { humanDisplayName } from '../servers/human-identity.ts';
import { agentRoute, humanRoute, membersRoute } from '../servers/server-routes.ts';
import { AgentAvatar } from './agent-avatar.tsx';
import { CreateAgentDialog } from './create-agent-dialog.tsx';

/**
 * The Agent and Human rosters, as the Members page's own navigation column.
 *
 * This used to be a shell sidebar page, which meant arriving at Members
 * replaced the chat navigation. Only Settings does that now, so the roster
 * lives on the page it belongs to.
 */
export function MemberRoster({ server }: { server: ServerSummary }) {
    const navigate = useNavigate();
    const agentsOverviewMatch = useMatch('/s/:slug/members');
    const agentMatch = useMatch('/s/:slug/members/agents/:agentId/:tab');
    const humanMatch = useMatch('/s/:slug/members/humans/:userId');
    const agents = useAgents(server.id);
    const directory = useMembers(server.id);
    const [creatingAgent, setCreatingAgent] = React.useState(false);
    const selectedAgentId = agentMatch?.params.agentId;
    const selectedHumanId = humanMatch?.params.userId;
    const canOperate = server.role === 'owner' || server.role === 'admin';
    const agentItems = agents.data ?? [];
    const humans = directory.data?.members ?? [];

    return (
        <div className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-separator border-e px-3 py-4">
            <section aria-label="Agents" className="flex flex-col gap-1">
                <header className="flex items-center justify-between ps-2 pe-1">
                    <h2 className="font-medium text-muted text-xs">
                        Agents{agents.data ? ` · ${agentItems.length}` : ''}
                    </h2>
                    {canOperate ? (
                        <Tooltip delay={0}>
                            <Button
                                aria-label="Create Agent"
                                isIconOnly
                                onPress={() => setCreatingAgent(true)}
                                size="sm"
                                variant="ghost"
                            >
                                <Icon aria-hidden="true" icon={Plus} size={16} />
                            </Button>
                            <Tooltip.Content>Create Agent</Tooltip.Content>
                        </Tooltip>
                    ) : null}
                </header>
                <RosterRow
                    isCurrent={Boolean(agentsOverviewMatch)}
                    label="Overview"
                    leading={<Icon aria-hidden="true" icon={Activity01Icon} size={16} />}
                    to={membersRoute(server.slug)}
                />
                {agentItems.map((agent) => (
                    <RosterRow
                        isCurrent={agent.id === selectedAgentId}
                        key={agent.id}
                        label={agent.displayName}
                        leading={<AgentAvatar agent={agent} size={24} />}
                        to={agentRoute(server.slug, agent.id)}
                    />
                ))}
                {agents.error ? (
                    <p className="px-2 py-1 text-muted text-sm" role="alert">
                        Couldn’t load Agents
                    </p>
                ) : null}
            </section>
            <section aria-label="Humans" className="flex flex-col gap-1">
                <h2 className="ps-2 font-medium text-muted text-xs">
                    Humans{directory.data ? ` · ${humans.length}` : ''}
                </h2>
                {humans.map((member) => (
                    <RosterRow
                        isCurrent={selectedHumanId === member.userId}
                        key={member.userId}
                        label={humanDisplayName(member)}
                        leading={
                            <EntityAvatar
                                name={humanDisplayName(member)}
                                size={24}
                                src={member.avatarUrl}
                            />
                        }
                        to={humanRoute(server.slug, member.userId)}
                        trailing={member.role}
                    />
                ))}
            </section>
            <CreateAgentDialog
                agents={agentItems}
                onCreated={(createdAgentId) => {
                    setCreatingAgent(false);
                    navigate(agentRoute(server.slug, createdAgentId));
                }}
                onOpenChange={setCreatingAgent}
                open={creatingAgent}
                serverId={server.id}
            />
        </div>
    );
}

/** A roster entry. These navigate, so they are links rather than buttons. */
function RosterRow({
    isCurrent,
    label,
    leading,
    to,
    trailing,
}: {
    isCurrent: boolean;
    label: string;
    leading: React.ReactNode;
    to: string;
    trailing?: string;
}) {
    return (
        <Link
            aria-current={isCurrent ? 'page' : undefined}
            className={cn(
                'flex w-full min-w-0 cursor-[var(--cursor-interactive)] items-center gap-2.5 rounded-2xl px-2 py-1.5 text-start text-sm',
                isCurrent ? 'bg-surface-secondary text-foreground' : 'hover:bg-surface-hover'
            )}
            to={to}
        >
            {leading}
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {trailing ? <span className="shrink-0 text-muted text-xs">{trailing}</span> : null}
        </Link>
    );
}
