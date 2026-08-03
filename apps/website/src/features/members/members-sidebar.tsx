import { Button, Tooltip } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import { Plus } from '@hugeicons/core-free-icons';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { useServerMembers } from '../../hooks/servers/use-server-members.ts';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { humanDisplayName } from '../servers/human-identity.ts';
import { serverMembersRoute } from '../servers/server-routes.ts';
import { ShellSidebarPageContent } from '../shell/shell-sidebar.tsx';
import { CreateHostedAgentDialog } from './create-hosted-agent-dialog.tsx';
import { HostedAgentRailAvatar } from './hosted-agent-avatar.tsx';

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
    const location = useLocation();
    const navigate = useNavigate();
    const directory = useServerMembers(server.id, { enabled: isActive });
    const [creatingAgent, setCreatingAgent] = React.useState(false);
    const membersRoute = serverMembersRoute(server.slug);
    const humansRoute = `${membersRoute}/humans`;
    const selectedHumanId = location.pathname.startsWith(`${humansRoute}/`)
        ? location.pathname.slice(`${humansRoute}/`.length)
        : null;
    const selectedAgentId = resolveSelectedAgentId(location.pathname, membersRoute);
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
                                href={`${membersRoute}/agents/${agent.id}`}
                                id={agent.id}
                                isCurrent={agent.id === selectedAgentId}
                                key={agent.id}
                                textValue={agent.displayName}
                            >
                                <Sidebar.MenuIcon>
                                    <HostedAgentRailAvatar agent={agent} />
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
                            href={`${humansRoute}/${member.userId}`}
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
            <CreateHostedAgentDialog
                agents={agents}
                onCreated={(createdAgentId) => {
                    setCreatingAgent(false);
                    navigate(`${membersRoute}/agents/${createdAgentId}`);
                }}
                onOpenChange={setCreatingAgent}
                open={creatingAgent}
                serverId={server.id}
            />
        </ShellSidebarPageContent>
    );
}

function resolveSelectedAgentId(pathname: string, membersRoute: string) {
    const prefix = `${membersRoute}/agents/`;
    return pathname.startsWith(prefix)
        ? decodeURIComponent(pathname.slice(prefix.length)).split('/')[0]
        : undefined;
}
