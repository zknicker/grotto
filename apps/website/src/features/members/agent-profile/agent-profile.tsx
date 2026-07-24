import {
    Activity01Icon,
    BubbleChatIcon,
    Folder01Icon,
    Notification03Icon,
    UserCircleIcon,
    Wrench01Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import { useState } from 'react';
import {
    TabsSubtle,
    TabsSubtleItem,
    TabsSubtleList,
    TabsSubtlePanel,
} from '../../../components/ui/tabs-subtle.tsx';
import { useAgentList } from '../../../hooks/agents/use-agent-list.ts';
import type { AgentListOutput } from '../../../lib/trpc.tsx';
import { cn } from '../../../lib/utils.ts';
import { AgentActivityTab } from './activity-tab.tsx';
import { AgentProfileHeader } from './agent-profile-header.tsx';
import { AgentAppsTab } from './apps-tab.tsx';
import { AgentChatTab } from './chat-tab.tsx';
import { AgentProfileTab } from './profile-tab.tsx';
import { AgentRemindersTab } from './reminders-tab.tsx';
import { AgentWorkspaceTab } from './workspace-tab.tsx';

const tabs = [
    { icon: UserCircleIcon, label: 'Profile', value: 'profile' },
    { icon: Activity01Icon, label: 'Activity', value: 'activity' },
    { icon: BubbleChatIcon, label: 'Chat', value: 'chat' },
    { icon: Notification03Icon, label: 'Reminders', value: 'reminders' },
    { icon: Folder01Icon, label: 'Workspace', value: 'workspace' },
    { icon: Wrench01Icon, label: 'Tools', value: 'tools' },
] as const;

type AgentProfileTabId = (typeof tabs)[number]['value'];

// Per-agent tab memory: the pane arbitration hides/unmounts the profile when
// the artifact panel wins, and reopening must not lose the selected tab
// (T3: latest opener wins without clearing either pane's state).
const activeTabByAgent = new Map<string, AgentProfileTabId>();

export function AgentProfile({
    agentId,
    hostChatId,
    onClose,
    variant,
}: {
    agentId: string;
    hostChatId?: string;
    onClose?: () => void;
    variant: 'page' | 'pane';
}) {
    const agentsQuery = useAgentList();
    const agent = agentsQuery.data?.agents.find((candidate) => candidate.id === agentId) ?? null;
    const [activeTab, setActiveTabState] = useState<AgentProfileTabId>(
        () => activeTabByAgent.get(agentId) ?? 'profile'
    );
    const setActiveTab = (tab: AgentProfileTabId) => {
        activeTabByAgent.set(agentId, tab);
        setActiveTabState(tab);
    };

    if (agentsQuery.isPending) {
        return <p className="p-6 text-muted-foreground text-sm">Loading agent profile...</p>;
    }
    if (!agent) {
        return <p className="p-6 text-muted-foreground text-sm">Member not found.</p>;
    }

    return (
        <TabsSubtle
            className="h-full min-h-0 w-full gap-0"
            onValueChange={(value) => setActiveTab(value as AgentProfileTabId)}
            value={activeTab}
        >
            <AgentProfileHeader
                agent={agent}
                hostChatId={hostChatId}
                onClose={onClose}
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
                <ActiveTab agent={agent} tab={activeTab} variant={variant} />
            </TabsSubtlePanel>
        </TabsSubtle>
    );
}

function ActiveTab({
    agent,
    tab,
    variant,
}: {
    agent: AgentListOutput['agents'][number];
    tab: AgentProfileTabId;
    variant: 'page' | 'pane';
}) {
    switch (tab) {
        case 'profile':
            return <AgentProfileTab agent={agent} variant={variant} />;
        case 'activity':
            return <AgentActivityTab agentId={agent.id} />;
        case 'chat':
            return <AgentChatTab agentId={agent.id} />;
        case 'reminders':
            return <AgentRemindersTab agentId={agent.id} />;
        case 'workspace':
            return <AgentWorkspaceTab agentId={agent.id} />;
        case 'tools':
            return <AgentAppsTab agent={agent} />;
    }
}
