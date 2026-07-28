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
import {
    TabsSubtle,
    TabsSubtleItem,
    TabsSubtleList,
    TabsSubtlePanel,
} from '../../../components/ui/tabs-subtle.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { cn } from '../../../lib/utils.ts';
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
    const [activeTab, setActiveTabState] = React.useState<HostedAgentTab>(
        () => activeTabByAgent.get(agent.id) ?? 'profile'
    );
    const setActiveTab = (value: HostedAgentTab) => {
        activeTabByAgent.set(agent.id, value);
        setActiveTabState(value);
    };

    return (
        <TabsSubtle
            className="h-full min-h-0 w-full gap-0"
            onValueChange={(value) => setActiveTab(value as HostedAgentTab)}
            value={activeTab}
        >
            <HostedAgentProfileHeader
                agent={agent}
                onClose={onClose}
                server={server}
                variant={variant}
            />
            <div
                className={cn(
                    'shrink-0 border-[var(--content-card-border)] border-b',
                    variant === 'page' ? 'px-5' : 'px-3'
                )}
            >
                <TabsSubtleList className="max-w-full overflow-x-auto" variant="underline">
                    {tabs.map((tab) => (
                        <TabsSubtleItem
                            icon={tab.icon}
                            key={tab.value}
                            label={tab.label}
                            size="sm"
                            value={tab.value}
                        />
                    ))}
                </TabsSubtleList>
            </div>
            <TabsSubtlePanel
                className={cn(
                    'min-h-0',
                    activeTab === 'workspace' ? 'overflow-hidden' : 'overflow-y-auto px-3'
                )}
                value={activeTab}
            >
                <ActiveTab agent={agent} server={server} tab={activeTab} />
            </TabsSubtlePanel>
        </TabsSubtle>
    );
}

function ActiveTab({
    agent,
    server,
    tab,
}: {
    agent: HostedAgent;
    server: ServerDetail;
    tab: HostedAgentTab;
}) {
    switch (tab) {
        case 'profile':
            return <HostedAgentProfileTab agent={agent} server={server} />;
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
