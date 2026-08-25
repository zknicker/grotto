import type { Agent } from '@grotto/api';
import { Button, Tooltip } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import {
    Activity01Icon,
    Cancel01Icon,
    Folder01Icon,
    Notification03Icon,
    ToolsIcon,
    UserCircleIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { cn } from '../../../lib/utils.ts';
import { SectionBar, shellNavigationIconSize } from '../../shell/section-header.tsx';
import { PageTopbar } from '../../shell/shell-topbar.tsx';
import {
    AgentActivity,
    AgentOverview,
    AgentReminders,
    AgentTools,
    AgentWorkspace,
} from './agent-content.tsx';
import type { AgentTab } from './agent-tabs.ts';
import { isAgentTab } from './agent-tabs.ts';

const tabOptions = [
    { icon: UserCircleIcon, label: 'Overview', value: 'overview' },
    { icon: Activity01Icon, label: 'Activity', value: 'activity' },
    { icon: Notification03Icon, label: 'Reminders', value: 'reminders' },
    { icon: ToolsIcon, label: 'Tools', value: 'tools' },
    { icon: Folder01Icon, label: 'Workspace', value: 'workspace' },
] as const;

export function AgentProfilePage({
    agent,
    onDeleted,
    onTabChange,
    server,
    tab,
}: {
    agent: Agent;
    onDeleted: () => void;
    onTabChange: (tab: AgentTab) => void;
    server: ServerDetail;
    tab: AgentTab;
}) {
    return (
        <AgentProfileFrame
            content={
                <AgentTabContent agent={agent} onDeleted={onDeleted} server={server} tab={tab} />
            }
            navigation={
                <PageTopbar>
                    <div className="mx-auto flex w-full min-w-0 max-w-3xl justify-center">
                        <AgentProfileTabs centered onTabChange={onTabChange} tab={tab} />
                    </div>
                </PageTopbar>
            }
            tab={tab}
        />
    );
}

export function AgentProfilePane({
    agent,
    onClose,
    server,
}: {
    agent: Agent;
    onClose: () => void;
    server: ServerDetail;
}) {
    const [tab, setTab] = React.useState<AgentTab>('overview');

    return (
        <AgentProfileFrame
            content={
                <AgentTabContent agent={agent} onDeleted={onClose} server={server} tab={tab} />
            }
            navigation={
                <SectionBar>
                    <AgentProfileTabs onClose={onClose} onTabChange={setTab} tab={tab} />
                </SectionBar>
            }
            tab={tab}
        />
    );
}

function AgentProfileFrame({
    content,
    navigation,
    tab,
}: {
    content: React.ReactNode;
    navigation: React.ReactNode;
    tab: AgentTab;
}) {
    return (
        <div className="flex h-full min-h-0 w-full flex-col">
            {navigation}
            <div
                className={cn(
                    'min-h-0 flex-1 [scrollbar-gutter:stable]',
                    tab === 'workspace' ? 'overflow-hidden' : 'overflow-y-auto'
                )}
            >
                {content}
            </div>
        </div>
    );
}

function AgentProfileTabs({
    centered = false,
    onClose,
    onTabChange,
    tab,
}: {
    centered?: boolean;
    onClose?: () => void;
    onTabChange: (tab: AgentTab) => void;
    tab: AgentTab;
}) {
    return (
        <div className={cn('flex min-w-0 flex-1 items-center gap-3', centered && 'justify-center')}>
            <Segment
                aria-label="Agent sections"
                onSelectionChange={(key) => {
                    const next = String(key);
                    if (isAgentTab(next)) {
                        onTabChange(next);
                    }
                }}
                selectedKey={tab}
                size="sm"
                variant="ghost"
            >
                {tabOptions.map((option) => (
                    <Segment.Item id={option.value} key={option.value}>
                        <Icon aria-hidden="true" icon={option.icon} size={15} />
                        {option.label}
                    </Segment.Item>
                ))}
            </Segment>
            {onClose ? (
                <div className="ml-auto shrink-0">
                    <Tooltip>
                        <Button
                            aria-label="Close"
                            isIconOnly
                            onPress={onClose}
                            size="sm"
                            variant="ghost"
                        >
                            <Icon
                                aria-hidden="true"
                                icon={Cancel01Icon}
                                size={shellNavigationIconSize}
                            />
                        </Button>
                        <Tooltip.Content>Close</Tooltip.Content>
                    </Tooltip>
                </div>
            ) : null}
        </div>
    );
}

function AgentTabContent({
    agent,
    onDeleted,
    server,
    tab,
}: {
    agent: Agent;
    onDeleted: () => void;
    server: ServerDetail;
    tab: AgentTab;
}) {
    switch (tab) {
        case 'overview':
            return <AgentOverview agent={agent} onDeleted={onDeleted} server={server} />;
        case 'activity':
            return <AgentActivity agent={agent} server={server} />;
        case 'reminders':
            return <AgentReminders agent={agent} server={server} />;
        case 'tools':
            return <AgentTools agent={agent} server={server} />;
        case 'workspace':
            return <AgentWorkspace agent={agent} server={server} />;
    }
}
