import { Add01Icon, Archive02Icon, HashtagIcon } from '@hugeicons-pro/core-solid-rounded';
import { ArrowDown01Icon, ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useAgents, useChats } from '@tavern/app-client';
import { Button } from 'heroui-native/button';
import { type ReactNode, useState } from 'react';
import { View } from 'react-native';
import { AppIcon } from '../../components/app-icon.tsx';
import { AgentAvatar } from './agent-avatar';
import { toAgentSummary, toChatSummary } from './mobile-data';
import type { AgentSummary, ChatSummary } from './types';

export function ChatNavigation({
    activeChat,
    onCreateChannel,
    onOpenArchived,
    onSelectChat,
    serverId,
}: {
    activeChat: string | undefined;
    onCreateChannel: () => void;
    onOpenArchived: () => void;
    onSelectChat: (id: string) => void;
    serverId: string;
}) {
    const [areChannelsOpen, setAreChannelsOpen] = useState(true);
    const [areDirectMessagesOpen, setAreDirectMessagesOpen] = useState(true);
    const agentQuery = useAgents(serverId);
    const chatQuery = useChats(serverId);
    const agents = agentQuery.data?.map(toAgentSummary) ?? [];
    const chats = chatQuery.data?.map(toChatSummary).filter(isChatSummary) ?? [];
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const channels = chats.filter((chat) => chat.kind === 'channel');
    const directMessages = chats.filter((chat) => chat.kind === 'dm');

    return (
        <View className="gap-1">
            <NavigationSection
                action={
                    <Button
                        accessibilityLabel="New channel"
                        className="h-8 min-h-8 w-8 min-w-8"
                        isIconOnly
                        onPress={onCreateChannel}
                        size="sm"
                        variant="ghost"
                    >
                        <AppIcon icon={Add01Icon} tone="muted" />
                    </Button>
                }
                isOpen={areChannelsOpen}
                label="Channels"
                onToggle={() => setAreChannelsOpen((current) => !current)}
            >
                <ChatRows
                    activeChat={activeChat}
                    agentById={agentById}
                    chats={channels}
                    onSelectChat={onSelectChat}
                />
            </NavigationSection>
            <NavigationSection
                isOpen={areDirectMessagesOpen}
                label="Direct messages"
                onToggle={() => setAreDirectMessagesOpen((current) => !current)}
            >
                <ChatRows
                    activeChat={activeChat}
                    agentById={agentById}
                    chats={directMessages}
                    onSelectChat={onSelectChat}
                />
            </NavigationSection>
            <Button
                className="-ml-3 w-full justify-start"
                onPress={onOpenArchived}
                size="sm"
                variant="ghost"
            >
                <View className="w-6 items-center">
                    <AppIcon icon={Archive02Icon} />
                </View>
                <Button.Label>Archived</Button.Label>
            </Button>
        </View>
    );
}

function isChatSummary(chat: ChatSummary | null): chat is ChatSummary {
    return chat !== null;
}

function NavigationSection({
    action,
    children,
    isOpen,
    label,
    onToggle,
}: {
    action?: ReactNode;
    children: ReactNode;
    isOpen: boolean;
    label: string;
    onToggle: () => void;
}) {
    return (
        <View>
            <View className="flex-row items-center">
                <Button
                    accessibilityLabel={`${isOpen ? 'Collapse' : 'Expand'} ${label}`}
                    className="h-8 min-h-8 flex-1 justify-start px-0"
                    onPress={onToggle}
                    size="sm"
                    variant="ghost"
                >
                    <AppIcon
                        icon={isOpen ? ArrowDown01Icon : ArrowRight01Icon}
                        size={12}
                        tone="muted"
                    />
                    <Button.Label className="text-muted">{label}</Button.Label>
                </Button>
                {action}
            </View>
            {isOpen ? <View>{children}</View> : null}
        </View>
    );
}

function ChatRows({
    activeChat,
    agentById,
    chats: rows,
    onSelectChat,
}: {
    activeChat: string | undefined;
    agentById: Map<string, AgentSummary>;
    chats: ChatSummary[];
    onSelectChat: (id: string) => void;
}) {
    return rows.map((chat) => {
        const agent = chat.kind === 'dm' ? agentById.get(chat.peerAgentId) : undefined;
        const name = chat.kind === 'channel' ? chat.name : (agent?.displayName ?? 'Direct message');
        const isActive = activeChat === chat.id;
        return (
            <View className="relative -ml-3" key={chat.id}>
                {chat.unread ? (
                    <View
                        accessibilityElementsHidden
                        className="absolute top-1/2 -left-4.25 z-10 size-2.5 -translate-y-1/2 rounded-full bg-foreground"
                        pointerEvents="none"
                    />
                ) : null}
                <Button
                    className="w-full justify-start"
                    onPress={() => onSelectChat(chat.id)}
                    size="sm"
                    variant={isActive ? 'tertiary' : 'ghost'}
                >
                    <ChatIcon agent={agent} />
                    <Button.Label
                        className={
                            chat.unread
                                ? 'flex-1 text-left font-semibold text-foreground'
                                : 'flex-1 text-left'
                        }
                        numberOfLines={1}
                    >
                        {name}
                    </Button.Label>
                </Button>
            </View>
        );
    });
}

function ChatIcon({ agent }: { agent: AgentSummary | undefined }) {
    if (!agent) {
        return (
            <View className="size-6 items-center justify-center">
                <AppIcon icon={HashtagIcon} />
            </View>
        );
    }

    return <AgentAvatar agent={agent} />;
}
