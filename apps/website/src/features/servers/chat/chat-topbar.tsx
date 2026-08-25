import type { Agent, Chat } from '@grotto/api';
import { Button, Chip, Dropdown, Header, Label, Separator, Tooltip, toast } from '@heroui/react';
import {
    ArchiveIcon,
    ArchiveRestoreIcon,
    ArrowDown01Icon,
    Attachment01Icon,
    CheckListIcon,
    Delete02Icon,
    Edit02Icon,
    PaintBrush03Icon,
    SidebarRightIcon,
    UserMultiple02Icon,
} from '@hugeicons-pro/core-stroke-rounded';
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
import { SectionHeader, shellNavigationIconSize } from '../../shell/section-header.tsx';
import { serverRoute, tasksRoute } from '../server-routes.ts';

export function ChatTopbar({
    artifactVisible,
    chat,
    chatName,
    onOpenFiles,
    onToggleArtifacts,
    server,
}: {
    artifactVisible: boolean;
    chat: Chat;
    chatName: string;
    onOpenFiles: () => void;
    onToggleArtifacts: () => void;
    server: ServerDetail;
}) {
    const agents = useAgents(chat.serverId);
    const peerAgent =
        chat.kind === 'dm' && chat.peerAgentId
            ? (agents.data?.find((agent) => agent.id === chat.peerAgentId) ?? null)
            : null;

    return (
        <SectionHeader
            leading={
                chat.kind === 'channel' ? (
                    <ChannelActions
                        chat={chat}
                        chatName={chatName}
                        onOpenFiles={onOpenFiles}
                        server={server}
                    />
                ) : (
                    <DmActions
                        chat={chat}
                        chatName={chatName}
                        onOpenFiles={onOpenFiles}
                        peerAgent={peerAgent}
                        server={server}
                    />
                )
            }
            meta={<ChatTopbarMeta chat={chat} />}
        >
            {/* Both chat kinds carry their name inside the actions trigger, so
                the page needs an explicit heading for assistive tech. */}
            <h1 className="sr-only">{chatName}</h1>
            <Tooltip>
                <Button
                    aria-label={artifactVisible ? 'Hide artifacts' : 'Show artifacts'}
                    isIconOnly
                    onPress={onToggleArtifacts}
                    size="sm"
                    variant={artifactVisible ? 'secondary' : 'ghost'}
                >
                    <Icon
                        aria-hidden="true"
                        icon={SidebarRightIcon}
                        size={shellNavigationIconSize}
                    />
                </Button>
                <Tooltip.Content>
                    {artifactVisible ? 'Hide artifacts' : 'Show artifacts'}
                </Tooltip.Content>
            </Tooltip>
        </SectionHeader>
    );
}

export function ChatTopbarMeta({
    chat,
}: {
    chat: Pick<Chat, 'archivedAt' | 'kind' | 'peerAgentRetired'>;
}) {
    if (chat.kind === 'dm' && chat.peerAgentRetired) {
        return <Chip size="sm">Retired</Chip>;
    }
    if (chat.archivedAt) {
        return <Chip size="sm">Archived</Chip>;
    }
    return null;
}

// Editing a channel is three separate decisions, so each one gets its own
// small dialog instead of one dialog that asks for everything at once.
type ChannelEditDialog = 'agents' | 'appearance' | 'rename';

/** The chat-scoped surfaces every chat menu offers: its tasks and its files. */
function ChatSurfaceItems() {
    return (
        <>
            <Dropdown.Item id="tasks" textValue="View tasks">
                <Icon icon={CheckListIcon} size={16} />
                <Label>View tasks</Label>
            </Dropdown.Item>
            <Dropdown.Item id="files" textValue="Files">
                <Icon icon={Attachment01Icon} size={16} />
                <Label>Files</Label>
            </Dropdown.Item>
        </>
    );
}

function DmActions({
    chat,
    chatName,
    onOpenFiles,
    peerAgent,
    server,
}: {
    chat: Chat;
    chatName: string;
    onOpenFiles: () => void;
    peerAgent: Agent | null;
    server: ServerDetail;
}) {
    const navigate = useNavigate();

    return (
        <Dropdown>
            <Button
                aria-label={`${chatName} — chat actions`}
                // Mirrors the channel trigger: pill-local padding plus the
                // negative margin that keeps the avatar on the band gutter.
                className="-ms-2 min-w-0 gap-2 px-2"
                size="sm"
                variant="ghost"
            >
                <EntityAvatar
                    name={peerAgent?.displayName ?? chatName}
                    // Sidebar-row scale: the band is chrome, so its identity
                    // mark stays smaller than the transcript's avatars below.
                    size={24}
                    src={peerAgent?.avatarUrl ?? null}
                />
                <span className="truncate font-semibold text-sm">{chatName}</span>
                <Icon aria-hidden="true" className="text-muted" icon={ArrowDown01Icon} size={15} />
            </Button>
            <Dropdown.Popover placement="bottom start">
                <Dropdown.Menu
                    onAction={(key) => {
                        if (key === 'tasks') {
                            navigate(
                                `${tasksRoute(server.slug)}?chat=${encodeURIComponent(chat.id)}`
                            );
                            return;
                        }
                        if (key === 'files') {
                            onOpenFiles();
                        }
                    }}
                >
                    <ChatSurfaceItems />
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}

function ChannelActions({
    chat,
    chatName,
    onOpenFiles,
    server,
}: {
    chat: Chat;
    chatName: string;
    onOpenFiles: () => void;
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
        if (key === 'tasks') {
            navigate(`${tasksRoute(server.slug)}?chat=${encodeURIComponent(chat.id)}`);
            return;
        }
        if (key === 'files') {
            onOpenFiles();
            return;
        }
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
                        <Dropdown.Section>
                            <Header>Channel</Header>
                            <Dropdown.Item
                                id="rename"
                                isDisabled={Boolean(chat.archivedAt)}
                                textValue="Rename channel"
                            >
                                <Icon aria-hidden="true" icon={Edit02Icon} size={16} />
                                <Label>Rename channel</Label>
                            </Dropdown.Item>
                            <Dropdown.Item
                                id="appearance"
                                isDisabled={Boolean(chat.archivedAt)}
                                textValue="Icon and color"
                            >
                                <Icon aria-hidden="true" icon={PaintBrush03Icon} size={16} />
                                <Label>Icon &amp; color</Label>
                            </Dropdown.Item>
                            <Dropdown.Item
                                id="agents"
                                isDisabled={Boolean(chat.archivedAt)}
                                textValue="Agents"
                            >
                                <Icon aria-hidden="true" icon={UserMultiple02Icon} size={16} />
                                <Label>Agents</Label>
                                <span className="ms-auto shrink-0 text-muted text-xs tabular-nums">
                                    {count}
                                </span>
                            </Dropdown.Item>
                        </Dropdown.Section>
                        <Separator />
                        <Dropdown.Section>
                            <Header>Content</Header>
                            <ChatSurfaceItems />
                        </Dropdown.Section>
                        {chat.isAll || !canManage ? null : (
                            <>
                                <Separator />
                                <Dropdown.Section>
                                    <Header>Actions</Header>
                                    <Dropdown.Item
                                        id={chat.archivedAt ? 'restore' : 'archive'}
                                        isDisabled={lifecyclePending}
                                        textValue={
                                            chat.archivedAt ? 'Restore channel' : 'Archive channel'
                                        }
                                    >
                                        <Icon
                                            icon={
                                                chat.archivedAt ? ArchiveRestoreIcon : ArchiveIcon
                                            }
                                            size={16}
                                        />
                                        <Label>
                                            {chat.archivedAt
                                                ? 'Restore channel'
                                                : 'Archive channel'}
                                        </Label>
                                    </Dropdown.Item>
                                    <Dropdown.Item
                                        id="delete"
                                        isDisabled={lifecyclePending}
                                        textValue="Delete channel"
                                        variant="danger"
                                    >
                                        <Icon icon={Delete02Icon} size={16} />
                                        <Label>Delete channel</Label>
                                    </Dropdown.Item>
                                </Dropdown.Section>
                            </>
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
