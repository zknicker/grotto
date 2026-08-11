import { Button, Chip, Dropdown, Label, Tooltip, toast } from '@heroui/react';
import {
    MoreHorizontalIcon,
    SidebarRightIcon,
    UserMultiple02Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent, HostedChat } from '@tavern/api';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChannelIconBox } from '../../../components/chats/channel-icon-box.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import {
    useChannelArchive,
    useChannelDelete,
    useChannelUnarchive,
} from '../../../hooks/servers/use-channel-lifecycle.ts';
import { useChannelUpdate } from '../../../hooks/servers/use-channel-update.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { HostedDeleteDialog } from '../../../routes/app/hosted-delete-dialog.tsx';
import { ChannelDialog } from '../../chats/channel-dialog.tsx';
import { ChatViewSwitcher, type ChatViewTab } from '../../chats/chat-view-tabs.tsx';
import { SectionHeader } from '../../shell/section-header.tsx';
import { serverRoute } from '../server-routes.ts';

export function ChatTopbar({
    artifactVisible,
    chat,
    chatName,
    onToggleArtifacts,
    onViewTabChange,
    server,
    viewTab,
}: {
    artifactVisible: boolean;
    chat: HostedChat;
    chatName: string;
    onToggleArtifacts: () => void;
    onViewTabChange: (tab: ChatViewTab) => void;
    server: ServerDetail;
    viewTab: ChatViewTab;
}) {
    const agents = useAgents(chat.serverId);

    return (
        <SectionHeader
            center={<ChatViewSwitcher onValueChange={onViewTabChange} value={viewTab} />}
            leading={chat.kind === 'channel' ? <ChannelIconBox size="topbar" /> : null}
            meta={
                chat.kind === 'dm' && chat.peerAgentRetired ? (
                    <Chip size="sm">Retired</Chip>
                ) : chat.archivedAt ? (
                    <Chip size="sm">Archived</Chip>
                ) : null
            }
            title={chatName}
        >
            <ChannelParticipants agents={agents.data ?? []} chat={chat} server={server} />
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

function ChannelParticipants({
    agents,
    chat,
    server,
}: {
    agents: HostedAgent[];
    chat: HostedChat;
    server: ServerDetail;
}) {
    const navigate = useNavigate();
    const updateChannel = useChannelUpdate();
    const archive = useChannelArchive();
    const unarchive = useChannelUnarchive();
    const deleteChannel = useChannelDelete();
    const [editing, setEditing] = React.useState(false);
    const [confirmingDelete, setConfirmingDelete] = React.useState(false);
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

    const canManage = server.role === 'owner' || server.role === 'admin';
    const lifecyclePending = archive.isPending || unarchive.isPending || deleteChannel.isPending;
    const runLifecycleAction = (key: React.Key) => {
        if (key === 'edit') {
            updateChannel.reset();
            setEditing(true);
            return;
        }
        if (key === 'delete') {
            deleteChannel.reset();
            setConfirmingDelete(true);
            return;
        }
        const mutation = key === 'restore' ? unarchive : archive;
        mutation
            .mutateAsync({ chatId: chat.id, serverId: chat.serverId })
            .then(() => toast.success(key === 'restore' ? 'Channel restored' : 'Channel archived'))
            .catch((error: Error) =>
                toast.danger('Channel update failed', { description: error.message })
            );
    };

    return (
        <>
            <Tooltip>
                <Button
                    aria-label="Edit participants"
                    isDisabled={Boolean(chat.archivedAt)}
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
            {canManage ? (
                <Dropdown>
                    <Tooltip>
                        <Button aria-label="Channel actions" isIconOnly size="sm" variant="ghost">
                            <Icon aria-hidden="true" icon={MoreHorizontalIcon} size={18} />
                        </Button>
                        <Tooltip.Content>Channel actions</Tooltip.Content>
                    </Tooltip>
                    <Dropdown.Popover placement="bottom end">
                        <Dropdown.Menu onAction={runLifecycleAction}>
                            <Dropdown.Item
                                id="edit"
                                isDisabled={Boolean(chat.archivedAt)}
                                textValue="Edit channel"
                            >
                                <Label>Edit channel</Label>
                            </Dropdown.Item>
                            {chat.isAll ? null : (
                                <Dropdown.Item
                                    id={chat.archivedAt ? 'restore' : 'archive'}
                                    isDisabled={lifecyclePending}
                                    textValue={
                                        chat.archivedAt ? 'Restore channel' : 'Archive channel'
                                    }
                                >
                                    <Label>
                                        {chat.archivedAt ? 'Restore channel' : 'Archive channel'}
                                    </Label>
                                </Dropdown.Item>
                            )}
                            {chat.isAll ? null : (
                                <Dropdown.Item
                                    id="delete"
                                    isDisabled={lifecyclePending}
                                    textValue="Delete channel"
                                    variant="danger"
                                >
                                    <Label>Delete channel</Label>
                                </Dropdown.Item>
                            )}
                        </Dropdown.Menu>
                    </Dropdown.Popover>
                </Dropdown>
            ) : null}
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
            {confirmingDelete ? (
                <HostedDeleteDialog
                    confirmation={chat.name ?? ''}
                    description="This permanently deletes the channel, its messages, threads, tasks, reminders, reactions, and attachments. This cannot be undone."
                    error={deleteChannel.error?.message}
                    onConfirm={() => {
                        deleteChannel
                            .mutateAsync({
                                chatId: chat.id,
                                confirmation: chat.name ?? '',
                                serverId: chat.serverId,
                            })
                            .then(() => {
                                setConfirmingDelete(false);
                                navigate(serverRoute(server.slug), { replace: true });
                            })
                            .catch(() => undefined);
                    }}
                    onOpenChange={setConfirmingDelete}
                    pending={deleteChannel.isPending}
                    title="Delete Channel"
                />
            ) : null}
        </>
    );
}
