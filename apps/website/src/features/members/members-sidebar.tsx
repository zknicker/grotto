import { Button, Tooltip } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import { Plus } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { useAgents } from '../../hooks/members/use-agents.ts';
import { useMembers } from '../../hooks/servers/use-members.ts';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { humanDisplayName } from '../servers/human-identity.ts';
import { agentRoute, humanRoute } from '../servers/server-routes.ts';
import { ShellSidebarPageContent } from '../shell/shell-sidebar.tsx';
import { AgentAvatar } from './agent-avatar.tsx';
import { CreateAgentDialog } from './create-agent-dialog.tsx';

/** Members section sidebar: the Agent and Human rosters as navigation. */
export function MembersSidebar({ isActive, server }: { isActive: boolean; server: ServerSummary }) {
    const navigate = useNavigate();
    const agentMatch = useMatch('/s/:slug/members/agents/:agentId/:tab');
    const humanMatch = useMatch('/s/:slug/members/humans/:userId');
    const agents = useAgents(isActive ? server.id : undefined);
    const directory = useMembers(server.id, { enabled: isActive });
    const [creatingAgent, setCreatingAgent] = React.useState(false);
    const selectedAgentId = agentMatch?.params.agentId;
    const selectedHumanId = humanMatch?.params.userId;
    const canOperate = server.role === 'owner' || server.role === 'admin';
    const agentItems = agents.data ?? [];
    const humans = directory.data?.members ?? [];

    return (
        <ShellSidebarPageContent
            band={
                <div className="flex w-full items-center justify-between pe-1">
                    <Sidebar.GroupLabel>
                        Agents{agents.data ? ` · ${agentItems.length}` : ''}
                    </Sidebar.GroupLabel>
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
                </div>
            }
        >
            <Sidebar.Group>
                {agents.isPending ? (
                    <div aria-busy="true">
                        <span className="sr-only">Loading Agents</span>
                    </div>
                ) : agents.error ? (
                    <p className="px-2 py-1 text-muted text-sm" role="alert">
                        Couldn’t load Agents
                    </p>
                ) : (
                    <Sidebar.Menu aria-label="Agents" className="gap-0">
                        {agentItems.map((agent) => (
                            <Sidebar.MenuItem
                                href={agentRoute(server.slug, agent.id)}
                                id={agent.id}
                                isCurrent={agent.id === selectedAgentId}
                                key={agent.id}
                                textValue={agent.displayName}
                            >
                                <Sidebar.MenuIcon>
                                    <AgentAvatar agent={agent} size={24} />
                                </Sidebar.MenuIcon>
                                <Sidebar.MenuItemContent>
                                    <Sidebar.MenuLabel>{agent.displayName}</Sidebar.MenuLabel>
                                </Sidebar.MenuItemContent>
                            </Sidebar.MenuItem>
                        ))}
                    </Sidebar.Menu>
                )}
            </Sidebar.Group>
            <Sidebar.Group>
                <Sidebar.GroupLabel>
                    Humans{directory.data ? ` · ${humans.length}` : ''}
                </Sidebar.GroupLabel>
                {!directory.data && directory.isPending ? (
                    <div aria-busy="true">
                        <span className="sr-only">Loading humans</span>
                    </div>
                ) : (
                    <Sidebar.Menu aria-label="Humans" className="gap-0">
                        {humans.map((member) => (
                            <Sidebar.MenuItem
                                href={humanRoute(server.slug, member.userId)}
                                id={member.userId}
                                isCurrent={selectedHumanId === member.userId}
                                key={member.userId}
                                textValue={humanDisplayName(member)}
                            >
                                <Sidebar.MenuIcon>
                                    <EntityAvatar
                                        name={humanDisplayName(member)}
                                        size={24}
                                        src={member.avatarUrl}
                                    />
                                </Sidebar.MenuIcon>
                                <Sidebar.MenuItemContent>
                                    <Sidebar.MenuLabel>
                                        {humanDisplayName(member)}
                                    </Sidebar.MenuLabel>
                                    <Sidebar.MenuChip>{member.role}</Sidebar.MenuChip>
                                </Sidebar.MenuItemContent>
                            </Sidebar.MenuItem>
                        ))}
                    </Sidebar.Menu>
                )}
            </Sidebar.Group>
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
        </ShellSidebarPageContent>
    );
}
