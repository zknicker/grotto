import { Button, Tooltip } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import {
    Activity01Icon,
    Cancel01Icon,
    Folder01Icon,
    Notification03Icon,
    UserCircleIcon,
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
import {
    HostedAgentActivityTab,
    HostedAgentOverviewTab,
    HostedAgentRemindersTab,
    HostedAgentWorkspaceTab,
} from './hosted-agent-tabs.tsx';

const tabs = [
    { icon: UserCircleIcon, label: 'Overview', value: 'overview' },
    { icon: Activity01Icon, label: 'Activity', value: 'activity' },
    { icon: Notification03Icon, label: 'Reminders', value: 'reminders' },
    { icon: Folder01Icon, label: 'Workspace', value: 'workspace' },
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
        () => activeTabByAgent.get(agent.id) ?? 'overview'
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
                        onClose={onClose}
                        onTabChange={setActiveTab}
                    />
                </PageTopbar>
            ) : (
                <SectionBar>
                    <AgentTabBand
                        activeTab={activeTab}
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

/** The Agent band: section switcher centred, actions trailing. */
function AgentTabBand({
    activeTab,
    onClose,
    onTabChange,
}: {
    activeTab: HostedAgentTab;
    onClose?: () => void;
    onTabChange: (tab: HostedAgentTab) => void;
}) {
    // Identity is carried by the Overview header and the roster, so the band
    // holds only the section switcher, aligned to the content's leading edge.
    return (
        <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex min-w-0 items-center">
                <Segment
                    aria-label="Agent sections"
                    onSelectionChange={(key) => onTabChange(key as HostedAgentTab)}
                    selectedKey={activeTab}
                    size="sm"
                    variant="ghost"
                >
                    {tabs.map((tab) => (
                        <Segment.Item id={tab.value} key={tab.value}>
                            <Icon aria-hidden="true" icon={tab.icon} size={15} />
                            {tab.label}
                        </Segment.Item>
                    ))}
                </Segment>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
                {onClose ? (
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
                ) : null}
            </div>
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
        case 'overview':
            return <HostedAgentOverviewTab agent={agent} onDeleted={onDeleted} server={server} />;
        case 'activity':
            return <HostedAgentActivityTab agent={agent} server={server} />;
        case 'reminders':
            return <HostedAgentRemindersTab agent={agent} server={server} />;
        case 'workspace':
            return <HostedAgentWorkspaceTab agent={agent} server={server} />;
    }
}
