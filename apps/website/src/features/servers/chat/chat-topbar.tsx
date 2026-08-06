import { Button, Chip, Tooltip } from '@heroui/react';
import { SidebarRightIcon, UserMultiple02Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent, HostedChat } from '@tavern/api';
import * as React from 'react';
import { ChannelIconBox } from '../../../components/chats/channel-icon-box.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useChannelUpdate } from '../../../hooks/servers/use-channel-update.ts';
import { ChannelDialog } from '../../chats/channel-dialog.tsx';
import { ChatViewSwitcher, type ChatViewTab } from '../../chats/chat-view-tabs.tsx';
import { SectionHeader } from '../../shell/section-header.tsx';

export function ChatTopbar({
    artifactVisible,
    chat,
    chatName,
    onToggleArtifacts,
    onViewTabChange,
    retired,
    viewTab,
}: {
    artifactVisible: boolean;
    chat: HostedChat;
    chatName: string;
    onToggleArtifacts: () => void;
    onViewTabChange: (tab: ChatViewTab) => void;
    retired: boolean;
    viewTab: ChatViewTab;
}) {
    const agents = useAgents(chat.serverId);

    return (
        <SectionHeader
            center={<ChatViewSwitcher onValueChange={onViewTabChange} value={viewTab} />}
            leading={chat.kind === 'channel' ? <ChannelIconBox size="topbar" /> : null}
            meta={retired ? <Chip size="sm">Retired</Chip> : null}
            title={chatName}
        >
            <ChannelParticipants agents={agents.data ?? []} chat={chat} />
            <Tooltip>
                <Button
                    aria-label={artifactVisible ? 'Hide artifacts' : 'Show artifacts'}
                    isIconOnly
                    onPress={onToggleArtifacts}
                    size="sm"
                    variant={artifactVisible ? 'secondary' : 'ghost'}
                >
                    <Icon aria-hidden="true" icon={SidebarRightIcon} size={18} />
                </Button>
                <Tooltip.Content>
                    {artifactVisible ? 'Hide artifacts' : 'Show artifacts'}
                </Tooltip.Content>
            </Tooltip>
        </SectionHeader>
    );
}

function ChannelParticipants({ agents, chat }: { agents: HostedAgent[]; chat: HostedChat }) {
    const updateChannel = useChannelUpdate();
    const [editing, setEditing] = React.useState(false);
    const count =
        chat.kind === 'channel'
            ? chat.participantAgentIds.length + chat.participantUserIds.length
            : chat.participantUserIds.length;

    if (chat.kind !== 'channel') {
        return (
            <span className="flex items-center gap-1 text-muted text-xs">
                <Icon aria-hidden="true" className="size-4" icon={UserMultiple02Icon} />
                {count}
            </span>
        );
    }

    return (
        <>
            <Tooltip>
                <Button
                    aria-label="Edit participants"
                    onPress={() => {
                        updateChannel.reset();
                        setEditing(true);
                    }}
                    size="sm"
                    variant="ghost"
                >
                    <Icon aria-hidden="true" icon={UserMultiple02Icon} size={16} />
                    {count}
                </Button>
                <Tooltip.Content>Edit participants</Tooltip.Content>
            </Tooltip>
            <ChannelDialog
                agents={agents.map((agent) => ({
                    avatarUrl: agent.avatarUrl,
                    id: agent.id,
                    name: agent.displayName,
                }))}
                agentsPending={false}
                errorMessage={updateChannel.error?.message ?? null}
                initialAgentIds={chat.participantAgentIds}
                initialDisplayName={chat.name ?? ''}
                isPending={updateChannel.isPending}
                onClose={() => setEditing(false)}
                onSubmit={async ({ agentIds, displayName }) => {
                    await updateChannel.mutateAsync({
                        agentIds,
                        chatId: chat.id,
                        name: displayName,
                        serverId: chat.serverId,
                    });
                    setEditing(false);
                }}
                open={editing}
                submitLabel="Save"
                title="Edit channel"
            />
        </>
    );
}
