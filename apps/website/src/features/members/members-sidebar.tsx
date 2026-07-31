import { Button, Tooltip } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import { Plus } from '@hugeicons/core-free-icons';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import { StatusDot } from '../../components/ui/status-dot.tsx';
import { useServerMembers } from '../../hooks/servers/use-server-members.ts';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { serverMembersRoute } from '../servers/server-routes.ts';
import { CreateHostedAgentDialog } from './create-hosted-agent-dialog.tsx';
import { HostedAgentFace } from './hosted-agent-face.tsx';

/** Members section sidebar: the Agent and Human rosters as navigation. */
export function MembersSidebar({
    agentListStatus,
    agents,
    server,
}: {
    agentListStatus: 'error' | 'loading' | 'ready';
    agents: HostedAgent[];
    server: ServerSummary;
}) {
    const location = useLocation();
    const navigate = useNavigate();
    const directory = useServerMembers(server.id);
    const [creatingAgent, setCreatingAgent] = React.useState(false);
    const membersRoute = serverMembersRoute(server.slug);
    const humansRoute = `${membersRoute}/humans`;
    const humansSelected = location.pathname.endsWith('/humans');
    const selectedAgentId = resolveSelectedAgentId(location.pathname, membersRoute);
    const canOperate = server.role === 'owner' || server.role === 'admin';
    const humans = directory.data?.members ?? [];

    return (
        <Sidebar aria-label="Members">
            <Sidebar.Header>
                <div className="px-2 py-1 font-semibold text-sm">Members</div>
            </Sidebar.Header>
            <Sidebar.Content>
                <Sidebar.Group>
                    <div className="flex items-center justify-between pe-1">
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
                                        <AgentFaceIcon agent={agent} />
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
                                href={humansRoute}
                                id={member.userId}
                                isCurrent={humansSelected}
                                key={member.userId}
                                textValue={member.userId}
                            >
                                <Sidebar.MenuIcon>
                                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-tertiary text-[9px]">
                                        {member.userId.slice(0, 2).toUpperCase()}
                                    </span>
                                </Sidebar.MenuIcon>
                                <Sidebar.MenuItemContent>
                                    <Sidebar.MenuLabel>{member.userId}</Sidebar.MenuLabel>
                                    <Sidebar.MenuChip>{member.role}</Sidebar.MenuChip>
                                </Sidebar.MenuItemContent>
                            </Sidebar.MenuItem>
                        ))}
                        <Sidebar.MenuItem
                            href={humansRoute}
                            id="manage-humans"
                            isCurrent={false}
                            textValue="Manage Humans"
                        >
                            <Sidebar.MenuItemContent>
                                <Sidebar.MenuLabel>Manage Humans…</Sidebar.MenuLabel>
                            </Sidebar.MenuItemContent>
                        </Sidebar.MenuItem>
                    </Sidebar.Menu>
                </Sidebar.Group>
            </Sidebar.Content>
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
        </Sidebar>
    );
}

function resolveSelectedAgentId(pathname: string, membersRoute: string) {
    const prefix = `${membersRoute}/agents/`;
    return pathname.startsWith(prefix)
        ? decodeURIComponent(pathname.slice(prefix.length)).split('/')[0]
        : undefined;
}

function AgentFaceIcon({ agent }: { agent: HostedAgent }) {
    return (
        <span className="relative flex size-5 shrink-0 items-center justify-center overflow-visible">
            <HostedAgentFace
                agent={agent}
                animate={false}
                size={20}
                style={{ flexShrink: 0, height: 20, overflow: 'visible', width: 20 }}
            />
            <StatusDot
                className="absolute right-0 bottom-0"
                size="md"
                status={agentStatus(agent.availability)}
                title={agent.availability}
            />
        </span>
    );
}

function agentStatus(availability: HostedAgent['availability']) {
    switch (availability) {
        case 'idle':
            return 'success' as const;
        case 'working':
            return 'warning' as const;
        case 'error':
            return 'error' as const;
        default:
            return 'muted' as const;
    }
}
