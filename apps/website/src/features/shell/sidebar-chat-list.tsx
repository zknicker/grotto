import { PencilEdit02Icon, Plus } from '@hugeicons/core-free-icons';
import { ArchiveIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { NavSectionLabel } from '../../components/ui/nav.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../components/ui/sidebar.tsx';
import { useAgentAppearanceLookup } from '../../hooks/agents/use-agent-appearance.ts';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { useChatArchive } from '../../hooks/chats/use-chat-archive.ts';
import { useChatCreate } from '../../hooks/chats/use-chat-create.ts';
import { useChatList } from '../../hooks/chats/use-chat-list.ts';
import { useChatSystemPrompt } from '../../hooks/chats/use-chat-system-prompt.ts';
import { useChatTabAppearance } from '../../hooks/chats/use-chat-tab-appearance.ts';
import { useChatUpdate } from '../../hooks/chats/use-chat-update.ts';
import { useChatRuntimeTimelineState } from '../../hooks/chats/use-timeline-context.tsx';
import {
    formatCapabilityDisabledReason,
    newChatCapabilityRequirements,
    useCapability,
} from '../../hooks/connections/use-capability.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { cn } from '../../lib/utils.ts';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace } from '../chats/agent-face.tsx';
import { useAgentPresenceEntry } from '../chats/agent-presence.tsx';
import { ChannelDialog } from '../chats/channel-dialog.tsx';
import { useChatHasDraft } from '../chats/chat-composer-draft-state.ts';
import { buildChatList, type ChatListItem, getChatAgentId } from '../chats/chat-list-data.ts';
import { buildChatPath } from '../chats/chat-path.ts';
import { getChannelColorStyle } from './channel-color-options.ts';
import {
    canRenameSidebarChat,
    getErrorMessage,
    SidebarChatContextMenu,
    SidebarChatRenameDialog,
    SidebarChatSystemPromptDialog,
} from './sidebar-chat-actions.tsx';
import {
    buildSidebarChatGroups,
    getSidebarChatTitle,
    hasLocalActiveTurn,
} from './sidebar-chat-list-model.ts';

// Inline width/height so the sidebar menu button's `[&_svg]:size-4.5` rule
// cannot shrink the face back down. The row allows overflow so authored plumes
// and tufts can bleed outside the nominal 20px sidebar icon slot.
const faceStyle = { flexShrink: 0, height: 24, overflow: 'visible', width: 24 } as const;

export function AppSidebarChatList() {
    const location = useLocation();
    const navigate = useNavigate();
    const capability = useCapability();
    const chatQuery = useChatList();
    const agentsQuery = useAgentList();
    const createChat = useChatCreate();
    const updateChat = useChatUpdate();
    const archiveChat = useChatArchive();
    const systemPrompt = useChatSystemPrompt();
    const tabAppearance = useChatTabAppearance();
    const [renamingChat, setRenamingChat] = React.useState<ChatListItem | null>(null);
    const [creatingChannel, setCreatingChannel] = React.useState(false);
    const [editingParticipantsChat, setEditingParticipantsChat] =
        React.useState<ChatListItem | null>(null);
    const [editingSystemPromptChat, setEditingSystemPromptChat] =
        React.useState<ChatListItem | null>(null);
    const sidebarChats = React.useMemo(
        () => buildSidebarChatGroups(buildChatList(chatQuery.data)),
        [chatQuery.data]
    );
    const newChatGate = capability(newChatCapabilityRequirements);
    const newChatDisabledReason = newChatGate.healthy
        ? null
        : formatCapabilityDisabledReason(newChatGate);

    const openRename = React.useCallback(
        (chat: ChatListItem) => {
            updateChat.reset();
            setRenamingChat(chat);
        },
        [updateChat]
    );

    const archiveSidebarChat = React.useCallback(
        async (chat: ChatListItem) => {
            try {
                await archiveChat.mutateAsync({ chatId: chat.id });

                if (location.pathname === buildChatPath(chat.id)) {
                    await navigate(appRoutes.activity);
                }
            } catch (error) {
                // biome-ignore lint/suspicious/noAlert: Keep sidebar failures visible without adding a global toast dependency.
                window.alert(getErrorMessage(error));
            }
        },
        [archiveChat, location.pathname, navigate]
    );
    const setChannelColor = React.useCallback(
        async (chat: ChatListItem, color: string | null) => {
            try {
                await tabAppearance.mutateAsync({
                    chatId: chat.id,
                    color,
                });
            } catch (error) {
                // biome-ignore lint/suspicious/noAlert: Keep sidebar failures visible without adding a global toast dependency.
                window.alert(getErrorMessage(error));
            }
        },
        [tabAppearance]
    );

    return (
        <>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
                <SidebarGroup className="group/channels pt-1">
                    <NavSectionLabel className="relative flex h-8 items-center px-2 py-0">
                        Channels
                        <Button
                            aria-label="New channel"
                            className="absolute top-1/2 right-[0.0625rem] -translate-y-1/2 opacity-0 group-focus-within/channels:opacity-100 group-hover/channels:opacity-100 [&_svg]:size-[1.0625rem]"
                            disabled={!newChatGate.healthy}
                            onClick={() => {
                                createChat.reset();
                                setCreatingChannel(true);
                            }}
                            size="icon-xs"
                            title={newChatDisabledReason ?? 'New channel'}
                            variant="ghost"
                        >
                            <Icon aria-hidden="true" icon={Plus} />
                        </Button>
                    </NavSectionLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {sidebarChats.channels.map((chat) => (
                                <SidebarRecentChatItem
                                    chat={chat}
                                    isActive={location.pathname === buildChatPath(chat.id)}
                                    key={chat.id}
                                    onArchive={(selectedChat) => {
                                        void archiveSidebarChat(selectedChat);
                                    }}
                                    onCustomizeColor={(selectedChat, color) => {
                                        tabAppearance.reset();
                                        void setChannelColor(selectedChat, color);
                                    }}
                                    onEditParticipants={(selectedChat) => {
                                        updateChat.reset();
                                        setEditingParticipantsChat(selectedChat);
                                    }}
                                    onEditSystemPrompt={(selectedChat) => {
                                        systemPrompt.reset();
                                        setEditingSystemPromptChat(selectedChat);
                                    }}
                                    onRename={openRename}
                                />
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup className="group/dms pt-1">
                    <NavSectionLabel className="relative flex h-8 items-center px-2 py-0">
                        Direct messages
                    </NavSectionLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {sidebarChats.directMessages.map((chat) => (
                                <SidebarRecentChatItem
                                    chat={chat}
                                    isActive={location.pathname === buildChatPath(chat.id)}
                                    key={chat.id}
                                    onArchive={(selectedChat) => {
                                        void archiveSidebarChat(selectedChat);
                                    }}
                                    onCustomizeColor={(selectedChat, color) => {
                                        tabAppearance.reset();
                                        void setChannelColor(selectedChat, color);
                                    }}
                                    onEditParticipants={(selectedChat) => {
                                        updateChat.reset();
                                        setEditingParticipantsChat(selectedChat);
                                    }}
                                    onEditSystemPrompt={(selectedChat) => {
                                        systemPrompt.reset();
                                        setEditingSystemPromptChat(selectedChat);
                                    }}
                                    onRename={openRename}
                                />
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                {sidebarChats.taskChats.length > 0 ? (
                    <SidebarGroup className="group/tasks pt-1">
                        <NavSectionLabel className="relative flex h-8 items-center px-2 py-0">
                            Task chats
                        </NavSectionLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {sidebarChats.taskChats.map((chat) => (
                                    <SidebarRecentChatItem
                                        chat={chat}
                                        isActive={location.pathname === buildChatPath(chat.id)}
                                        key={chat.id}
                                        onArchive={(selectedChat) => {
                                            void archiveSidebarChat(selectedChat);
                                        }}
                                        onCustomizeColor={(selectedChat, color) => {
                                            tabAppearance.reset();
                                            void setChannelColor(selectedChat, color);
                                        }}
                                        onEditParticipants={(selectedChat) => {
                                            updateChat.reset();
                                            setEditingParticipantsChat(selectedChat);
                                        }}
                                        onEditSystemPrompt={(selectedChat) => {
                                            systemPrompt.reset();
                                            setEditingSystemPromptChat(selectedChat);
                                        }}
                                        onRename={openRename}
                                    />
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ) : null}
                <SidebarGroup className="pt-1 pb-2">
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    className="font-normal text-sidebar-muted"
                                    isActive={location.pathname === appRoutes.archivedChats}
                                    render={<NavLink to={appRoutes.archivedChats} />}
                                    tooltip="Archived chats"
                                >
                                    <Icon aria-hidden="true" icon={ArchiveIcon} />
                                    <span>Archived</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </div>

            <SidebarChatRenameDialog
                chat={renamingChat}
                errorMessage={updateChat.error?.message ?? null}
                isPending={updateChat.isPending}
                onClose={() => {
                    if (!updateChat.isPending) {
                        updateChat.reset();
                        setRenamingChat(null);
                    }
                }}
                onSubmit={async (displayName) => {
                    if (!(renamingChat && canRenameSidebarChat(renamingChat))) {
                        return;
                    }

                    await updateChat.mutateAsync({
                        agentIds: renamingChat.boundAgentIds,
                        chatId: renamingChat.id,
                        displayName,
                    });

                    setRenamingChat(null);
                }}
            />
            <ChannelDialog
                agents={agentsQuery.data?.agents ?? []}
                agentsPending={agentsQuery.isPending}
                errorMessage={createChat.error?.message ?? null}
                initialAgentIds={[]}
                initialDisplayName=""
                isPending={createChat.isPending}
                onClose={() => {
                    createChat.reset();
                    setCreatingChannel(false);
                }}
                onSubmit={async (input) => {
                    const created = await createChat.mutateAsync(input);
                    setCreatingChannel(false);
                    await navigate(buildChatPath(created.chatId));
                }}
                open={creatingChannel}
                submitLabel="Create"
                title="New channel"
            />
            <ChannelDialog
                agents={agentsQuery.data?.agents ?? []}
                agentsPending={agentsQuery.isPending}
                errorMessage={updateChat.error?.message ?? null}
                initialAgentIds={editingParticipantsChat?.boundAgentIds ?? []}
                initialDisplayName={editingParticipantsChat?.displayName ?? ''}
                isPending={updateChat.isPending}
                onClose={() => {
                    updateChat.reset();
                    setEditingParticipantsChat(null);
                }}
                onSubmit={async (input) => {
                    if (!editingParticipantsChat) {
                        return;
                    }

                    await updateChat.mutateAsync({
                        agentIds: input.agentIds,
                        chatId: editingParticipantsChat.id,
                        displayName: editingParticipantsChat.displayName,
                    });

                    setEditingParticipantsChat(null);
                }}
                open={editingParticipantsChat !== null}
                showDisplayName={false}
                submitLabel="Save"
                title="Channel participants"
            />
            <SidebarChatSystemPromptDialog
                chat={editingSystemPromptChat}
                errorMessage={systemPrompt.error?.message ?? null}
                isPending={systemPrompt.isPending}
                onClose={() => {
                    if (!systemPrompt.isPending) {
                        systemPrompt.reset();
                        setEditingSystemPromptChat(null);
                    }
                }}
                onSubmit={async (nextSystemPrompt) => {
                    if (!editingSystemPromptChat) {
                        return;
                    }

                    await systemPrompt.mutateAsync({
                        chatId: editingSystemPromptChat.id,
                        systemPrompt: nextSystemPrompt,
                    });

                    setEditingSystemPromptChat(null);
                }}
            />
        </>
    );
}

function SidebarRecentChatItem({
    chat,
    isActive,
    onArchive,
    onCustomizeColor,
    onEditSystemPrompt,
    onEditParticipants,
    onRename,
}: {
    chat: ChatListItem;
    isActive: boolean;
    onArchive: (chat: ChatListItem) => void;
    onCustomizeColor: (chat: ChatListItem, color: string | null) => void;
    onEditParticipants: (chat: ChatListItem) => void;
    onEditSystemPrompt: (chat: ChatListItem) => void;
    onRename: (chat: ChatListItem) => void;
}) {
    const title = getSidebarChatTitle(chat);
    const path = buildChatPath(chat.id);
    const channelColorStyle = getChannelColorStyle(chat.tabAppearance.color);

    return (
        <SidebarMenuItem>
            <SidebarChatContextMenu
                chat={chat}
                onArchive={onArchive}
                onCustomizeColor={onCustomizeColor}
                onEditParticipants={onEditParticipants}
                onEditSystemPrompt={onEditSystemPrompt}
                onRename={onRename}
            >
                <SidebarMenuButton
                    className="overflow-visible font-normal group-focus-within/menu-item:bg-sidebar-accent group-focus-within/menu-item:text-sidebar-accent-foreground group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-accent-foreground"
                    isActive={isActive}
                    render={<NavLink to={path} />}
                    tooltip={title}
                >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-visible">
                        <SidebarChatIcon chat={chat} style={channelColorStyle} />
                        <span
                            className={cn(
                                'min-w-0 flex-1 truncate',
                                chat.unreadCount > 0 ? 'font-semibold' : null
                            )}
                        >
                            {title}
                        </span>
                        <SidebarChatIndicators chat={chat} isActive={isActive} />
                    </div>
                </SidebarMenuButton>
            </SidebarChatContextMenu>
        </SidebarMenuItem>
    );
}

// The right edge belongs to the unread indicator alone; presence rides the
// agent face (specs/presence.md). DMs carry the strong pill — someone is
// talking to you directly — while channel unreads stay a quiet count so
// ordinary agent chatter never out-inks the selected row.
function SidebarChatIndicators({ chat, isActive }: { chat: ChatListItem; isActive: boolean }) {
    const hasDraft = useChatHasDraft(chat.id) && !isActive;

    if (!(hasDraft || chat.unreadCount > 0)) {
        return null;
    }

    return (
        <span className="flex shrink-0 items-center gap-1.5">
            {hasDraft ? (
                <Icon
                    aria-label="Draft"
                    className="size-3 text-muted-foreground"
                    icon={PencilEdit02Icon}
                />
            ) : null}
            {chat.unreadCount > 0 ? (
                chat.conversationKind === 'channel' ? (
                    <SidebarUnreadCount count={chat.unreadCount} />
                ) : (
                    <SidebarUnreadPill count={chat.unreadCount} />
                )
            ) : null}
        </span>
    );
}

/**
 * Presence dot anchored to the DM row's agent face — green idle, easing to
 * amber while the agent is busy anywhere — so the unread pill keeps the
 * right edge to itself.
 */
function SidebarAgentPresenceDot({ chat }: { chat: ChatListItem }) {
    const timelineState = useChatRuntimeTimelineState(chat.id);
    const agentId = chat.conversationKind === 'channel' ? null : getChatAgentId(chat);
    const presence = useAgentPresenceEntry(agentId);
    const busy =
        agentId !== null && (presence?.state === 'busy' || hasLocalActiveTurn(timelineState));

    if (agentId === null || !(presence || busy)) {
        return null;
    }

    return (
        <span
            aria-hidden="true"
            className={cn(
                'absolute -right-1.5 -bottom-1 size-[9px] rounded-full ring-2 ring-sidebar transition-colors duration-300',
                busy ? 'bg-warning' : 'bg-success'
            )}
            title={busy ? 'Agent turn in progress' : undefined}
        />
    );
}

function SidebarUnreadPill({ count }: { count: number }) {
    return (
        <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 font-medium text-micro text-primary-foreground tabular-nums leading-none">
            {count > 99 ? '99+' : count}
        </span>
    );
}

function SidebarUnreadCount({ count }: { count: number }) {
    return (
        <span className="shrink-0 font-semibold text-caption text-muted-foreground tabular-nums leading-none">
            {count > 99 ? '99+' : count}
        </span>
    );
}

function SidebarChatIcon({
    chat,
    style,
}: {
    chat: ChatListItem;
    style: React.CSSProperties | undefined;
}) {
    const lookupAppearance = useAgentAppearanceLookup();
    const dark = useResolvedThemeOptional() === 'dark';

    if (chat.conversationKind === 'channel') {
        // Same 20px layout slot as the agent faces below (24px art overflowing
        // a size-5 box) so text columns align, biased 1px left to sit optically
        // even inside the hovered row.
        return <ChannelIconBox className="-mr-px -ml-[3px]" size="sidebar" style={style} />;
    }

    const appearance = lookupAppearance(getChatAgentId(chat));

    if (appearance.character !== 'none') {
        return (
            <span
                aria-hidden="true"
                className="relative flex size-5 shrink-0 items-center justify-center overflow-visible"
            >
                <AgentFace
                    animate={false}
                    dark={dark}
                    head={appearance.character}
                    ink={resolveAgentInk(dark, appearance.primaryColor)}
                    size={24}
                    style={faceStyle}
                />
                <SidebarAgentPresenceDot chat={chat} />
            </span>
        );
    }

    return (
        <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center rounded-md bg-sidebar-accent font-medium text-micro text-sidebar-muted"
        >
            {getSidebarParticipantInitial(chat)}
        </span>
    );
}

function getSidebarParticipantInitial(chat: ChatListItem) {
    const name = chat.targetParticipant?.name ?? chat.participants[0]?.name ?? chat.title;
    const normalized = name.trim();

    return (normalized[0] ?? '?').toUpperCase();
}
