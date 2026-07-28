import { PencilEdit02Icon } from '@hugeicons/core-free-icons';
import { ArchiveIcon, ArrowDown01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { resolveTavernChatName } from '../../components/chats/chat-display.ts';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '../../components/ui/menu.tsx';
import { useAgentAppearanceLookup } from '../../hooks/agents/use-agent-appearance.ts';
import { useChatArchive } from '../../hooks/chats/use-chat-archive.ts';
import { useCapability } from '../../hooks/connections/use-capability.ts';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { getChannelColorStyle } from '../shell/channel-color-options.ts';
import { ToolbarDevMenu } from '../shell/toolbar-dev-menu.tsx';
import { ToolbarDivider } from '../shell/toolbar-divider.tsx';
import { AgentFace } from './agent-face.tsx';
import { AgentPresenceBadge } from './agent-presence.tsx';
import { ChannelEditDialog } from './channel-edit-dialog.tsx';
import { type ChatListItem, getChatAgentId } from './chat-list-data.ts';
import { ChatPaneToggleButton } from './chat-pane-toggle-button.tsx';
import { ChatParticipantsControl } from './chat-participants-control.tsx';

/**
 * The chat's dynamic topbar: room identity on the left — channels get a
 * name dropdown with channel actions plus the clickable description — and
 * the dev menu, participant count, and pane toggle on the right. Height
 * matches the artifact panel's chrome row.
 */
export function ChatRoomTopbar({ chat }: { chat: ChatListItem }) {
    const title = formatRoomTitle(chat);
    const isChannel = chat.type === 'tavern' && chat.conversationKind === 'channel';
    const [editOpen, setEditOpen] = React.useState(false);

    return (
        <>
            <ChatRoomTopbarPresentation
                actions={
                    <>
                        <ChatDevMenu chatId={chat.id} />
                        <ChatParticipantsControl chat={chat} />
                        <ToolbarDivider />
                        <ChatPaneToggleButton chatId={chat.id} />
                    </>
                }
                identity={
                    <>
                        <RoomIcon chat={chat} />
                        {isChannel ? (
                            <ChannelNameMenu
                                chat={chat}
                                onEdit={() => setEditOpen(true)}
                                title={title}
                            />
                        ) : (
                            <h1 className="min-w-0 truncate font-semibold text-foreground text-sm">
                                {title}
                            </h1>
                        )}
                        <AgentPresenceBadge chat={chat} />
                        {chat.archived ? <Badge variant="secondary">Archived</Badge> : null}
                        {isChannel && chat.description ? (
                            <button
                                className="no-drag min-w-0 truncate text-left text-muted-foreground text-sm hover:text-foreground"
                                onClick={() => setEditOpen(true)}
                                title="Edit channel description"
                                type="button"
                            >
                                {chat.description}
                            </button>
                        ) : null}
                    </>
                }
            />
            {isChannel ? (
                <ChannelEditDialog chat={chat} onClose={() => setEditOpen(false)} open={editOpen} />
            ) : null}
        </>
    );
}

export function ChatRoomTopbarPresentation({
    actions,
    identity,
}: {
    actions: React.ReactNode;
    identity: React.ReactNode;
}) {
    return (
        <header
            className="relative z-40 grid h-[var(--content-topbar-height)] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center border-[var(--content-card-border)] border-b bg-background"
            data-slot="chat-room-topbar"
            data-window-drag-region=""
        >
            <div className="flex min-w-0 items-center gap-2 pr-2 pl-3">{identity}</div>
            <div className="no-drag flex min-w-0 items-center justify-end gap-1.5 px-2">
                {actions}
            </div>
        </header>
    );
}

// The channel name doubles as the channel menu: edit identity copy or
// archive the room. Participants live behind the people count instead.
function ChannelNameMenu({
    chat,
    onEdit,
    title,
}: {
    chat: ChatListItem;
    onEdit: () => void;
    title: string;
}) {
    const archiveChat = useChatArchive();

    return (
        <Menu>
            <MenuTrigger className="no-drag flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 hover:bg-accent">
                <h1 className="min-w-0 truncate font-semibold text-foreground text-sm">{title}</h1>
                <Icon
                    className="size-3.5 shrink-0 text-muted-foreground"
                    icon={ArrowDown01Icon}
                    strokeWidth={2}
                />
            </MenuTrigger>
            <MenuPopup align="start">
                <MenuItem onClick={onEdit}>
                    <Icon icon={PencilEdit02Icon} />
                    Edit channel
                </MenuItem>
                <MenuItem
                    disabled={chat.archived}
                    onClick={() => archiveChat.mutate({ chatId: chat.id })}
                >
                    <Icon icon={ArchiveIcon} />
                    Archive channel
                </MenuItem>
            </MenuPopup>
        </Menu>
    );
}

// Development-stack-only simulated-turn helpers, gated on the runtime's
// devToolkit capability like the desktop chrome toolbar.
function ChatDevMenu({ chatId }: { chatId: string }) {
    const devToolkit = useCapability('devToolkit');

    if (!devToolkit.healthy) {
        return null;
    }

    return <ToolbarDevMenu chatId={chatId} />;
}

// Channels keep the colored hash box; DMs are represented by their agent's
// face, matching the sidebar row (24px art in a 20px slot for optical parity).
const topbarFaceStyle = { flexShrink: 0, height: 24, overflow: 'visible', width: 24 } as const;

function RoomIcon({ chat }: { chat: ChatListItem }) {
    const lookupAppearance = useAgentAppearanceLookup();
    const dark = useResolvedThemeOptional() === 'dark';
    const channelStyle = getChannelColorStyle(chat.tabAppearance.color);

    if (chat.conversationKind === 'channel') {
        return <ChannelIconBox size="topbar" style={channelStyle} />;
    }

    const appearance = lookupAppearance(getChatAgentId(chat));

    if (appearance.character === 'none') {
        return <ChannelIconBox size="topbar" style={channelStyle} />;
    }

    return (
        <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
            <AgentFace
                animate={false}
                dark={dark}
                head={appearance.character}
                ink={resolveAgentInk(dark, appearance.primaryColor)}
                size={24}
                style={topbarFaceStyle}
            />
        </span>
    );
}

function formatRoomTitle(chat: ChatListItem) {
    const title = resolveTavernChatName(chat).trim();

    return chat.conversationKind === 'channel' ? title.replace(/^#+/u, '') || title : title;
}
