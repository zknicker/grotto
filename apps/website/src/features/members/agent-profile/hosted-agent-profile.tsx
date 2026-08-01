import { Button, Tabs, Tooltip } from '@heroui/react';
import {
    Activity01Icon,
    BubbleChatIcon,
    Cancel01Icon,
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
import { SectionBar } from '../../shell/section-header.tsx';
import { PageTopbar } from '../../shell/shell-topbar.tsx';
import { HostedAgentIdentity } from './hosted-agent-profile-header.tsx';
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
        <div className="flex h-full min-h-0 w-full flex-col">
            {variant === 'page' ? (
                <PageTopbar>
                    <AgentTabBand
                        activeTab={activeTab}
                        agent={agent}
                        onClose={onClose}
                        onTabChange={setActiveTab}
                    />
                </PageTopbar>
            ) : (
                <SectionBar>
                    <AgentTabBand
                        activeTab={activeTab}
                        agent={agent}
                        onClose={onClose}
                        onTabChange={setActiveTab}
                    />
                </SectionBar>
            )}
            <div
                className={cn(
                    'min-h-0 flex-1',
                    activeTab === 'workspace' ? 'overflow-hidden' : 'overflow-y-auto'
                )}
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
            </div>
        </div>
    );
}

/**
 * Identity + section tabs + optional close, sized by the surrounding band.
 * The Tabs list container must stay a DIRECT child of Tabs — the secondary
 * variant styles select `.tabs--secondary > .tabs__list-container` — so the
 * Tabs root itself carries the flex sizing, and the content panel lives
 * outside (the section switch is controlled state, not Tabs.Panel).
 */
function AgentTabBand({
    activeTab,
    agent,
    onClose,
    onTabChange,
}: {
    activeTab: HostedAgentTab;
    agent: HostedAgent;
    onClose?: () => void;
    onTabChange: (tab: HostedAgentTab) => void;
}) {
    return (
        <div className="flex h-full min-w-0 flex-1 items-stretch gap-5">
            <div className="flex min-w-0 shrink-0 items-center">
                <HostedAgentIdentity agent={agent} />
            </div>
            <Tabs
                className="-mb-px min-w-0 flex-1 self-end"
                onSelectionChange={(key) => onTabChange(key as HostedAgentTab)}
                selectedKey={activeTab}
                variant="secondary"
            >
                <Tabs.ListContainer>
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
            </Tabs>
            {onClose ? (
                <div className="flex shrink-0 items-center">
                    <Tooltip>
                        <Button
                            aria-label="Close"
                            isIconOnly
                            onPress={onClose}
                            size="sm"
                            variant="ghost"
                        >
                            <Icon aria-hidden="true" icon={Cancel01Icon} size={16} />
                        </Button>
                        <Tooltip.Content>Close</Tooltip.Content>
                    </Tooltip>
                </div>
            ) : null}
        </div>
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
