import { Tabs } from '@heroui/react';
import {
    Activity01Icon,
    BubbleChatIcon,
    Folder01Icon,
    Link04Icon,
    Notification03Icon,
    UserCircleIcon,
    Wrench01Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { cn } from '../../../lib/utils.ts';
import { serverMembersRoute } from '../../servers/server-routes.ts';
import { HostedAgentProfileHeader } from './hosted-agent-profile-header.tsx';
import {
    HostedAgentActivityTab,
    HostedAgentAppsTab,
    HostedAgentChatTab,
    HostedAgentMcpTab,
    HostedAgentProfileTab,
    HostedAgentRemindersTab,
    HostedAgentWorkspaceTab,
} from './hosted-agent-tabs.tsx';

const tabs = [
    { icon: UserCircleIcon, label: 'Profile', value: 'profile' },
    { icon: Activity01Icon, label: 'Activity', value: 'activity' },
    { icon: BubbleChatIcon, label: 'Chat', value: 'chat' },
    { icon: Notification03Icon, label: 'Reminders', value: 'reminders' },
    { icon: Folder01Icon, label: 'Workspace', value: 'workspace' },
    { icon: Link04Icon, label: 'Apps', value: 'apps' },
    { icon: Wrench01Icon, label: 'MCP', value: 'mcp' },
] as const;

type HostedAgentTab = (typeof tabs)[number]['value'];
const activeTabByAgent = new Map<string, HostedAgentTab>();

export function HostedAgentProfile({
    agent,
    onClose,
    server,
    variant,
}: {
    agent: HostedAgent;
    onClose?: () => void;
    server: ServerDetail;
    variant: 'page' | 'pane';
}) {
    const navigate = useNavigate();
    const [activeTab, setActiveTabState] = React.useState<HostedAgentTab>(
        () => activeTabByAgent.get(agent.id) ?? 'profile'
    );
    const setActiveTab = (value: HostedAgentTab) => {
        activeTabByAgent.set(agent.id, value);
        setActiveTabState(value);
    };

    return (
        <Tabs
            className="h-full min-h-0 w-full gap-0"
            onSelectionChange={(key) => setActiveTab(key as HostedAgentTab)}
            selectedKey={activeTab}
            variant="secondary"
        >
            <HostedAgentProfileHeader
                agent={agent}
                onClose={onClose}
                server={server}
                variant={variant}
            />
            <Tabs.ListContainer
                className={cn('shrink-0', variant === 'page' ? 'px-5 sm:px-7' : 'px-3')}
            >
                <Tabs.List aria-label="Agent sections">
                    {tabs.map((tab) => (
                        <Tabs.Tab id={tab.value} key={tab.value}>
                            <span className="flex items-center gap-2">
                                <Icon aria-hidden="true" icon={tab.icon} size={16} />
                                {tab.label}
                            </span>
                            <Tabs.Indicator />
                        </Tabs.Tab>
                    ))}
                </Tabs.List>
            </Tabs.ListContainer>
            <Tabs.Panel
                className={cn(
                    'mt-0 min-h-0 flex-1 p-0',
                    activeTab === 'workspace' ? 'overflow-hidden' : 'overflow-y-auto'
                )}
                id={activeTab}
            >
                <ActiveTab
                    agent={agent}
                    onDeleted={() => {
                        if (variant === 'pane') {
                            onClose?.();
                            return;
                        }
                        navigate(serverMembersRoute(server.slug), { replace: true });
                    }}
                    server={server}
                    tab={activeTab}
                />
            </Tabs.Panel>
        </Tabs>
    );
}

function ActiveTab({
    agent,
    onDeleted,
    server,
    tab,
}: {
    agent: HostedAgent;
    onDeleted: () => void;
    server: ServerDetail;
    tab: HostedAgentTab;
}) {
    switch (tab) {
        case 'profile':
            return <HostedAgentProfileTab agent={agent} onDeleted={onDeleted} server={server} />;
        case 'activity':
            return <HostedAgentActivityTab agent={agent} server={server} />;
        case 'chat':
            return <HostedAgentChatTab agent={agent} server={server} />;
        case 'reminders':
            return <HostedAgentRemindersTab agent={agent} server={server} />;
        case 'workspace':
            return <HostedAgentWorkspaceTab agent={agent} server={server} />;
        case 'apps':
            return <HostedAgentAppsTab />;
        case 'mcp':
            return <HostedAgentMcpTab agent={agent} server={server} />;
    }
}
