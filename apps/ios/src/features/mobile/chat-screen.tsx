import { HashtagIcon, Menu01Icon, Search01Icon } from '@hugeicons-pro/core-solid-rounded';
import { ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useRouter } from 'expo-router';
import { Button } from 'heroui-native/button';

import { AgentAvatar } from './agent-avatar';
import { AppIcon } from './app-icon';
import { AppLayout } from './app-layout';
import { ChatTimeline } from './chat-timeline';
import { Composer } from './composer';
import { agents, getChatTitle } from './fixtures';
import { IconButton } from './icon-button';
import type { ChatSummary } from './types';

export function ChatScreen({
    chat,
    isSidebarOpen,
    onToggleSidebar,
}: {
    chat: ChatSummary;
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
}) {
    const router = useRouter();
    const title = getChatTitle(chat.id);
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
                    <ChatIdentity chat={chat} />
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
                <ChatTimeline />
            </AppLayout.Content>
            <AppLayout.Footer>
                <Composer chatTitle={title} isChannel={chat.kind === 'channel'} />
            </AppLayout.Footer>
        </AppLayout.Root>
    );
}

function ChatIdentity({ chat }: { chat: ChatSummary }) {
    if (chat.kind === 'channel') {
        return <AppIcon icon={HashtagIcon} size={18} tone="muted" />;
    }

    const agent = agents.find((candidate) => candidate.id === chat.peerAgentId);
    return agent ? <AgentAvatar agent={agent} size={24} /> : null;
}
