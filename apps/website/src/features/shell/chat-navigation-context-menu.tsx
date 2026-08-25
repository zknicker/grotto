import type { Agent, Chat } from '@grotto/api';
import { Label } from '@heroui/react';
import { ContextMenu } from '@heroui-pro/react';
import {
    ArrowUpRight01Icon,
    CheckListIcon,
    ColorsIcon,
    Edit02Icon,
    PaintBrush03Icon,
    UserCircleIcon,
    UserMultiple02Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { channelColorOptions } from '../../components/chats/channel-color-options.ts';
import { Icon } from '../../components/ui/icon.tsx';
import { ChannelAgentsDialog } from '../chats/channel-agents-dialog.tsx';
import { ChannelAppearanceDialog } from '../chats/channel-appearance-dialog.tsx';
import { ChannelRenameDialog } from '../chats/channel-rename-dialog.tsx';
import { agentRoute, serverChatRoute, tasksRoute } from '../servers/server-routes.ts';

type ChannelEditDialog = 'agents' | 'appearance' | 'rename';

export function ChatNavigationContextMenu({
    agent,
    chat,
    children,
    onChangeChannelColor,
    slug,
}: {
    agent: Agent | null;
    chat: Chat;
    children: React.ReactNode;
    onChangeChannelColor?: (chat: Chat, color: string) => void;
    slug: string;
}) {
    const navigate = useNavigate();
    const [editDialog, setEditDialog] = React.useState<ChannelEditDialog | null>(null);
    const chatName =
        chat.kind === 'channel'
            ? (chat.name ?? 'channel')
            : (agent?.displayName ?? chat.peerAgentDisplayName ?? 'DM');

    const onAction = (key: React.Key) => {
        const action = String(key);
        if (action === 'open') {
            navigate(serverChatRoute(slug, chat.id));
            return;
        }
        if (action === 'tasks') {
            navigate(`${tasksRoute(slug)}?chat=${encodeURIComponent(chat.id)}`);
            return;
        }
        if (action === 'profile' && agent) {
            navigate(agentRoute(slug, agent.id));
            return;
        }
        if (action === 'rename' || action === 'appearance' || action === 'agents') {
            setEditDialog(action);
            return;
        }
        if (chat.kind === 'channel' && action.startsWith(colorPrefix)) {
            onChangeChannelColor?.(chat, action.slice(colorPrefix.length));
        }
    };

    const closeDialog = () => setEditDialog(null);

    return (
        <>
            <ContextMenu>
                <ContextMenu.Trigger className="flex min-w-0 flex-1 items-center gap-2">
                    {children}
                </ContextMenu.Trigger>
                <ContextMenu.Popover>
                    <ContextMenu.Menu onAction={onAction}>
                        <ContextMenu.Item id="open" textValue={`Open ${chatName}`}>
                            <Icon aria-hidden="true" icon={ArrowUpRight01Icon} size={16} />
                            <Label>Open {chat.kind === 'channel' ? 'channel' : 'chat'}</Label>
                        </ContextMenu.Item>
                        <ContextMenu.Item id="tasks" textValue="View tasks">
                            <Icon aria-hidden="true" icon={CheckListIcon} size={16} />
                            <Label>View tasks</Label>
                        </ContextMenu.Item>
                        {chat.kind === 'dm' ? (
                            <ContextMenu.Item
                                id="profile"
                                isDisabled={!agent}
                                textValue="View agent profile"
                            >
                                <Icon aria-hidden="true" icon={UserCircleIcon} size={16} />
                                <Label>View agent profile</Label>
                            </ContextMenu.Item>
                        ) : (
                            <ChannelContextItems
                                chat={chat}
                                disabled={!onChangeChannelColor}
                                onAction={onAction}
                            />
                        )}
                    </ContextMenu.Menu>
                </ContextMenu.Popover>
            </ContextMenu>
            {chat.kind === 'channel' && editDialog === 'rename' ? (
                <ChannelRenameDialog chat={chat} onClose={closeDialog} />
            ) : null}
            {chat.kind === 'channel' && editDialog === 'appearance' ? (
                <ChannelAppearanceDialog chat={chat} onClose={closeDialog} />
            ) : null}
            {chat.kind === 'channel' && editDialog === 'agents' ? (
                <ChannelAgentsDialog chat={chat} onClose={closeDialog} />
            ) : null}
        </>
    );
}

function ChannelContextItems({
    chat,
    disabled,
    onAction,
}: {
    chat: Chat;
    disabled: boolean;
    onAction: (key: React.Key) => void;
}) {
    return (
        <>
            <ContextMenu.Separator />
            <ContextMenu.Item
                id="rename"
                isDisabled={Boolean(chat.archivedAt)}
                textValue="Rename channel"
            >
                <Icon aria-hidden="true" icon={Edit02Icon} size={16} />
                <Label>Rename channel</Label>
            </ContextMenu.Item>
            <ContextMenu.Item
                id="appearance"
                isDisabled={Boolean(chat.archivedAt)}
                textValue="Icon and color"
            >
                <Icon aria-hidden="true" icon={PaintBrush03Icon} size={16} />
                <Label>Icon &amp; color…</Label>
            </ContextMenu.Item>
            <ContextMenu.SubmenuTrigger>
                <ContextMenu.Item
                    id="color"
                    isDisabled={Boolean(chat.archivedAt) || disabled}
                    textValue="Color"
                >
                    <Icon aria-hidden="true" icon={ColorsIcon} size={16} />
                    <Label>Color</Label>
                    <ContextMenu.SubmenuIndicator />
                </ContextMenu.Item>
                <ContextMenu.Popover>
                    <ContextMenu.Menu onAction={onAction}>
                        {channelColorOptions.map((option) => (
                            <ContextMenu.Item
                                id={`${colorPrefix}${option.id}`}
                                key={option.id}
                                textValue={option.label}
                            >
                                <span
                                    aria-hidden="true"
                                    className="size-4 rounded-full"
                                    style={{ backgroundColor: option.value }}
                                />
                                <Label>{option.label}</Label>
                                {chat.color === option.id ? <ContextMenu.ItemIndicator /> : null}
                            </ContextMenu.Item>
                        ))}
                    </ContextMenu.Menu>
                </ContextMenu.Popover>
            </ContextMenu.SubmenuTrigger>
            <ContextMenu.Item id="agents" isDisabled={Boolean(chat.archivedAt)} textValue="Agents">
                <Icon aria-hidden="true" icon={UserMultiple02Icon} size={16} />
                <Label>Agents</Label>
            </ContextMenu.Item>
        </>
    );
}

const colorPrefix = 'color:';
