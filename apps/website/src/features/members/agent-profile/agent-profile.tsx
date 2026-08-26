import type { Agent } from '@grotto/api';
import { Button, Tooltip } from '@heroui/react';
import { Segment } from '@heroui-pro/react';
import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { cn } from '../../../lib/utils.ts';
import { SectionBar, shellBandIconSize } from '../../shell/section-header.tsx';
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

/**
 * Text only. The icons were sized from `--spacing` by Segment's own CSS, so
 * they tracked whatever density the strip ran at rather than the label beside
 * them — and five words need no glyphs to tell them apart.
 */
const tabOptions = [
    { label: 'Overview', value: 'overview' },
    { label: 'Activity', value: 'activity' },
    { label: 'Reminders', value: 'reminders' },
    { label: 'Tools', value: 'tools' },
    { label: 'Workspace', value: 'workspace' },
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
                    {/* `flex-1`, not `w-full`: this band is shared. Inside
                        Settings the breadcrumb sits beside these tabs, and a
                        100% basis collapsed it to zero width. Trailing rather
                        than centred for the same reason — centring measures
                        the space left over after the breadcrumb, so the tabs
                        read as off-centre against the band itself. */}
                    <div className="ms-auto flex min-w-0 justify-end">
                        <AgentProfileTabs onTabChange={onTabChange} tab={tab} />
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
    onClose,
    onTabChange,
    tab,
}: {
    onClose?: () => void;
    onTabChange: (tab: AgentTab) => void;
    tab: AgentTab;
}) {
    return (
        <div className="flex min-w-0 flex-1 items-center gap-3">
            <Segment
                aria-label="Agent sections"
                onSelectionChange={(key) => {
                    const next = String(key);
                    if (isAgentTab(next)) {
                        onTabChange(next);
                    }
                }}
                selectedKey={tab}
                // `sm` is an 11px segment — badge size, sitting next to a 13px
                // breadcrumb in the same band. `md` is the body step.
                size="md"
                variant="ghost"
            >
                {tabOptions.map((option) => (
                    <Segment.Item id={option.value} key={option.value}>
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
                            <Icon aria-hidden="true" icon={Cancel01Icon} size={shellBandIconSize} />
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
