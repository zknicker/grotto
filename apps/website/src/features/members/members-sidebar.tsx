import { Button, Tooltip } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import { Plus } from '@hugeicons/core-free-icons';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { useServerMembers } from '../../hooks/servers/use-server-members.ts';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { humanDisplayName } from '../servers/human-identity.ts';
import { serverAgentRoute, serverHumanRoute } from '../servers/server-routes.ts';
import { ShellSidebarPageContent } from '../shell/shell-sidebar.tsx';
import { AgentAvatar } from './agent-avatar.tsx';
import { CreateAgentDialog } from './create-agent-dialog.tsx';

/** Members section sidebar: the Agent and Human rosters as navigation. */
export function MembersSidebar({
    agentListStatus,
    agents,
    isActive,
    server,
}: {
    agentListStatus: 'error' | 'loading' | 'ready';
    agents: HostedAgent[];
    isActive: boolean;
    server: ServerSummary;
}) {
    const navigate = useNavigate();
    const agentMatch = useMatch('/s/:slug/members/agents/:agentId/:tab');
    const humanMatch = useMatch('/s/:slug/members/humans/:userId');
    const directory = useServerMembers(server.id, { enabled: isActive });
    const [creatingAgent, setCreatingAgent] = React.useState(false);
    const selectedAgentId = agentMatch?.params.agentId;
    const selectedHumanId = humanMatch?.params.userId;
    const canOperate = server.role === 'owner' || server.role === 'admin';
    const humans = directory.data?.members ?? [];

    return (
        <ShellSidebarPageContent
            band={
                <div className="flex w-full items-center justify-between pe-1">
                    <Sidebar.GroupLabel>
                        Agents{agentListStatus === 'ready' ? ` · ${agents.length}` : ''}
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
                {agentListStatus === 'loading' ? (
                    <p className="px-2 py-1 text-muted text-sm">Loading Agents…</p>
                ) : agentListStatus === 'error' ? (
                    <p className="px-2 py-1 text-muted text-sm" role="alert">
                        Couldn’t load Agents
                    </p>
                ) : (
                    <Sidebar.Menu aria-label="Agents">
                        {agents.map((agent) => (
                            <Sidebar.MenuItem
                                href={serverAgentRoute(server.slug, agent.id)}
                                id={agent.id}
                                isCurrent={agent.id === selectedAgentId}
                                key={agent.id}
                                textValue={agent.displayName}
                            >
                                <Sidebar.MenuIcon>
                                    <AgentAvatar agent={agent} />
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
                <Sidebar.Menu aria-label="Humans">
                    {humans.map((member) => (
                        <Sidebar.MenuItem
                            href={serverHumanRoute(server.slug, member.userId)}
                            id={member.userId}
                            isCurrent={selectedHumanId === member.userId}
                            key={member.userId}
                            textValue={humanDisplayName(member)}
                        >
                            <Sidebar.MenuIcon>
                                <EntityAvatar
                                    name={humanDisplayName(member)}
                                    size={20}
                                    src={member.avatarUrl}
                                />
                            </Sidebar.MenuIcon>
                            <Sidebar.MenuItemContent>
                                <Sidebar.MenuLabel>{humanDisplayName(member)}</Sidebar.MenuLabel>
                                <Sidebar.MenuChip>{member.role}</Sidebar.MenuChip>
                            </Sidebar.MenuItemContent>
                        </Sidebar.MenuItem>
                    ))}
                </Sidebar.Menu>
            </Sidebar.Group>
            <CreateAgentDialog
                agents={agents}
                onCreated={(createdAgentId) => {
                    setCreatingAgent(false);
                    navigate(serverAgentRoute(server.slug, createdAgentId));
                }}
                onOpenChange={setCreatingAgent}
                open={creatingAgent}
                serverId={server.id}
            />
        </ShellSidebarPageContent>
    );
}
