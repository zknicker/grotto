import { Button, Chip, Dropdown, Label, Tooltip, toast } from '@heroui/react';
import {
    ArrowDown01Icon,
    SidebarRightIcon,
    UserMultiple02Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import type { Agent, Chat } from '@tavern/api';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChannelIconBox } from '../../../components/chats/channel-icon-box.tsx';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import {
    useChannelArchive,
    useChannelDelete,
    useChannelUnarchive,
} from '../../../hooks/servers/use-channel-lifecycle.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { DeleteDialog } from '../../../routes/app/delete-dialog.tsx';
import { ChannelAgentsDialog } from '../../chats/channel-agents-dialog.tsx';
import { ChannelAppearanceDialog } from '../../chats/channel-appearance-dialog.tsx';
import { ChannelRenameDialog } from '../../chats/channel-rename-dialog.tsx';
import { ChatViewSwitcher, type ChatViewTab } from '../../chats/chat-view-tabs.tsx';
import { availabilityLabel } from '../../members/agent-avatar.tsx';
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
    chat: Chat;
    chatName: string;
    onToggleArtifacts: () => void;
    onViewTabChange: (tab: ChatViewTab) => void;
    server: ServerDetail;
    viewTab: ChatViewTab;
}) {
    const agents = useAgents(chat.serverId);
    const peerAgent =
        chat.kind === 'dm' && chat.peerAgentId
            ? (agents.data?.find((agent) => agent.id === chat.peerAgentId) ?? null)
            : null;

    return (
        // The chat's name and the views of it are one unit on the leading edge:
        // adjacency is what says the tabs belong to this chat. The switcher
        // rides in `meta` so it stays glued to the name instead of being pushed
        // right with the actions.
        <SectionHeader
            leading={
                chat.kind === 'channel' ? (
                    <ChannelActions chat={chat} chatName={chatName} server={server} />
                ) : (
                    <EntityAvatar
                        name={peerAgent?.displayName ?? chatName}
                        size="sm"
                        src={peerAgent?.avatarUrl ?? null}
                    />
                )
            }
            meta={
                <>
                    {peerAgent ? (
                        <span className="shrink-0 text-muted text-xs">
                            <DmAgentStatus agent={peerAgent} />
                        </span>
                    ) : null}
                    {chat.kind === 'dm' && chat.peerAgentRetired ? (
                        <Chip size="sm">Retired</Chip>
                    ) : chat.archivedAt ? (
                        <Chip size="sm">Archived</Chip>
                    ) : null}
                </>
            }
            title={chat.kind === 'dm' ? chatName : undefined}
        >
            {/* A channel's name lives inside the actions trigger, so the page
                would otherwise have no heading at all. DMs get theirs from the
                title slot above. */}
            {chat.kind === 'channel' ? <h1 className="sr-only">{chatName}</h1> : null}
            <ChatViewSwitcher onValueChange={onViewTabChange} value={viewTab} />
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

function DmAgentStatus({ agent }: { agent: Agent }) {
    return availabilityLabel(agent.availability);
}

// Editing a channel is three separate decisions, so each one gets its own
// small dialog instead of one dialog that asks for everything at once.
type ChannelEditDialog = 'agents' | 'appearance' | 'rename';

function ChannelActions({
    chat,
    chatName,
    server,
}: {
    chat: Chat;
    chatName: string;
    server: ServerDetail;
}) {
    const navigate = useNavigate();
    const archive = useChannelArchive();
    const unarchive = useChannelUnarchive();
    const deleteChannel = useChannelDelete();
    const [editDialog, setEditDialog] = React.useState<ChannelEditDialog | null>(null);
    const [confirmingDelete, setConfirmingDelete] = React.useState(false);
    const count =
        chat.kind === 'channel'
            ? chat.participantAgentIds.length + chat.participantUserIds.length
            : chat.participantUserIds.length;

    if (chat.kind !== 'channel') {
        return null;
    }

    // Everyone can reach participants; only managers can reshape the channel.
    const canManage = server.role === 'owner' || server.role === 'admin';
    const lifecyclePending = archive.isPending || unarchive.isPending || deleteChannel.isPending;
    const runLifecycleAction = (key: React.Key) => {
        if (key === 'rename' || key === 'appearance' || key === 'agents') {
            setEditDialog(key);
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

    const closeEditDialog = () => setEditDialog(null);

    return (
        <>
            <Dropdown>
                <Button
                    aria-label={`${chatName} — channel actions`}
                    // Match the sidebar row's hover pill: 2 units of inner
                    // padding so the hash sits as close to the pill edge there as
                    // it does here, and an equal negative margin so the ink still
                    // starts on the band gutter, level across the divider.
                    className="-ms-2 min-w-0 gap-2 px-2"
                    size="sm"
                    variant="ghost"
                >
                    <ChannelIconBox color={chat.color} icon={chat.icon} size="topbar" />
                    <span className="truncate font-semibold text-sm">{chatName}</span>
                    <Icon
                        aria-hidden="true"
                        className="text-muted"
                        icon={ArrowDown01Icon}
                        size={15}
                    />
                </Button>
                <Dropdown.Popover placement="bottom start">
                    <Dropdown.Menu onAction={runLifecycleAction}>
                        <Dropdown.Item
                            id="rename"
                            isDisabled={Boolean(chat.archivedAt)}
                            textValue="Rename channel"
                        >
                            <Label>Rename channel</Label>
                        </Dropdown.Item>
                        <Dropdown.Item
                            id="appearance"
                            isDisabled={Boolean(chat.archivedAt)}
                            textValue="Icon and color"
                        >
                            <Label>Icon &amp; color</Label>
                        </Dropdown.Item>
                        <Dropdown.Item
                            id="agents"
                            isDisabled={Boolean(chat.archivedAt)}
                            textValue="Agents"
                        >
                            <Label>Agents</Label>
                            <span className="ms-auto flex shrink-0 items-center gap-1 text-muted text-xs tabular-nums">
                                <Icon aria-hidden="true" icon={UserMultiple02Icon} size={14} />
                                {count}
                            </span>
                        </Dropdown.Item>
                        {chat.isAll || !canManage ? null : (
                            <Dropdown.Item
                                id={chat.archivedAt ? 'restore' : 'archive'}
                                isDisabled={lifecyclePending}
                                textValue={chat.archivedAt ? 'Restore channel' : 'Archive channel'}
                            >
                                <Label>
                                    {chat.archivedAt ? 'Restore channel' : 'Archive channel'}
                                </Label>
                            </Dropdown.Item>
                        )}
                        {chat.isAll || !canManage ? null : (
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
            {/* Each edit dialog mounts on demand, so its draft starts from the
                channel as it is right now. */}
            {editDialog === 'rename' ? (
                <ChannelRenameDialog chat={chat} onClose={closeEditDialog} />
            ) : null}
            {editDialog === 'appearance' ? (
                <ChannelAppearanceDialog chat={chat} onClose={closeEditDialog} />
            ) : null}
            {editDialog === 'agents' ? (
                <ChannelAgentsDialog chat={chat} onClose={closeEditDialog} />
            ) : null}
            {confirmingDelete ? (
                <DeleteDialog
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
