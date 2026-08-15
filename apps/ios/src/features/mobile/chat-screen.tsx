import { HashtagIcon, Menu01Icon, Search01Icon } from '@hugeicons-pro/core-solid-rounded';
import { ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useAgents, useChats } from '@tavern/app-client';
import { useRouter } from 'expo-router';
import { Button } from 'heroui-native/button';

import { AgentAvatar } from './agent-avatar.tsx';
import { AppIcon } from './app-icon.tsx';
import { AppLayout } from './app-layout.tsx';
import { ChatTimeline } from './chat-timeline.tsx';
import { ChatComposer } from './composer.tsx';
import { IconButton } from './icon-button.tsx';
import { getChatTitle, toAgentSummary, toChatSummary } from './mobile-data.ts';
import type { AgentSummary, ChatSummary } from './types.ts';

export function ChatScreen({
    chatId,
    isSidebarOpen,
    onToggleSidebar,
    serverId,
}: {
    chatId: string | undefined;
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
    serverId: string;
}) {
    const router = useRouter();
    const chats = useChats(serverId);
    const agents = useAgents(serverId).data?.map(toAgentSummary) ?? [];
    const chat = chats.data?.find((candidate) => candidate.id === chatId);
    const chatSummary = chat ? toChatSummary(chat) : null;
    const title = getChatTitle(chatSummary ?? undefined, agents);
    return (
        <AppLayout.Root>
            <AppLayout.Header>
                <IconButton
                    icon={Menu01Icon}
                    label={isSidebarOpen ? 'Close navigation' : 'Open navigation'}
                    onPress={onToggleSidebar}
                />
                <Button
                    accessibilityLabel={`Open ${title} details`}
                    className="min-w-0 flex-1 justify-start px-1"
                    onPress={() =>
                        router.push({ pathname: '/section/[id]', params: { id: 'chat-details' } })
                    }
                    size="sm"
                    variant="ghost"
                >
                    <ChatIdentity agents={agents} chat={chatSummary} />
                    <Button.Label
                        className="min-w-0 shrink font-semibold text-foreground"
                        numberOfLines={1}
                    >
                        {title}
                    </Button.Label>
                    <AppIcon icon={ArrowRight01Icon} size={14} tone="muted" />
                </Button>
                <IconButton
                    icon={Search01Icon}
                    label={`Search ${title}`}
                    onPress={() =>
                        router.push({ pathname: '/section/[id]', params: { id: 'search' } })
                    }
                />
            </AppLayout.Header>
            <AppLayout.Content>
                <ChatTimeline chatId={chatId} serverId={serverId} />
            </AppLayout.Content>
            <AppLayout.Footer>
                {chatSummary ? (
                    <ChatComposer
                        chatId={chatSummary.id}
                        chatTitle={title}
                        isChannel={chatSummary.kind === 'channel'}
                        key={chatSummary.id}
                        serverId={serverId}
                    />
                ) : null}
            </AppLayout.Footer>
        </AppLayout.Root>
    );
}

function ChatIdentity({ agents, chat }: { agents: AgentSummary[]; chat: ChatSummary | null }) {
    if (!chat) {
        return null;
    }
    if (chat.kind === 'channel') {
        return <AppIcon icon={HashtagIcon} size={18} tone="muted" />;
    }

    const agent = agents.find((candidate) => candidate.id === chat.peerAgentId);
    return agent ? <AgentAvatar agent={agent} size={24} /> : null;
}
