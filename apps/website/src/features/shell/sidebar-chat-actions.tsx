import { PencilEdit02Icon } from '@hugeicons/core-free-icons';
import { ColorsIcon as ColorsSolidIcon } from '@hugeicons-pro/core-solid-rounded';
import {
    ArchiveIcon,
    ArrowUpRight01Icon,
    Cancel01Icon,
    ColorsIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import {
    ContextMenu,
    ContextMenuItem,
    ContextMenuPopup,
    ContextMenuSub,
    ContextMenuSubPopup,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from '../../components/ui/context-menu.tsx';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Form } from '../../components/ui/primitives/form.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { Textarea } from '../../components/ui/textarea.tsx';
import { cn } from '../../lib/utils.ts';
import type { ChatListItem } from '../chats/chat-list-data.ts';
import { channelColorOptions } from './channel-color-options.ts';

const contextMenuIconClassName = 'size-4';

interface SidebarChatContextMenuProps {
    chat: ChatListItem;
    children: React.ReactNode;
    onArchive: (chat: ChatListItem) => void;
    onCloseTab?: (chat: ChatListItem) => void;
    onCustomizeColor?: (chat: ChatListItem, color: string | null) => void;
    onEditParticipants?: (chat: ChatListItem) => void;
    onEditSystemPrompt?: (chat: ChatListItem) => void;
    onOpenInNewWindow?: (chat: ChatListItem) => void;
    onRename: (chat: ChatListItem) => void;
    triggerClassName?: string;
}

export function SidebarChatContextMenu({
    chat,
    children,
    onArchive,
    onCloseTab,
    onCustomizeColor,
    onEditParticipants,
    onEditSystemPrompt,
    onOpenInNewWindow,
    onRename,
    triggerClassName,
}: SidebarChatContextMenuProps) {
    const canCustomizeColor = canCustomizeSidebarChatColor(chat) && onCustomizeColor;
    const canEditParticipants = canEditSidebarChatParticipants(chat) && onEditParticipants;
    const canEditSystemPrompt = canEditSidebarChatSystemPrompt(chat) && onEditSystemPrompt;
    const canCloseTab = Boolean(onCloseTab);
    const canArchive = canArchiveSidebarChat(chat);

    return (
        <ContextMenu>
            <ContextMenuTrigger className={cn('block min-w-0', triggerClassName)}>
                {children}
            </ContextMenuTrigger>
            <ContextMenuPopup>
                <ContextMenuItem
                    disabled={!canRenameSidebarChat(chat)}
                    onClick={() => onRename(chat)}
                >
                    <Icon className={contextMenuIconClassName} icon={PencilEdit02Icon} />
                    Rename chat
                </ContextMenuItem>
                {canCustomizeColor ? (
                    <ContextMenuSub>
                        <ContextMenuSubTrigger>
                            <Icon className={contextMenuIconClassName} icon={ColorsIcon} />
                            Color
                        </ContextMenuSubTrigger>
                        <ContextMenuSubPopup>
                            <ContextMenuItem onClick={() => onCustomizeColor(chat, null)}>
                                <Icon className={contextMenuIconClassName} icon={ColorsIcon} />
                                Default
                            </ContextMenuItem>
                            {channelColorOptions.map((option) => (
                                <ContextMenuItem
                                    key={option.id}
                                    onClick={() => onCustomizeColor(chat, option.value)}
                                >
                                    <Icon
                                        className={contextMenuIconClassName}
                                        icon={ColorsSolidIcon}
                                        style={{ color: option.value }}
                                    />
                                    {option.label}
                                </ContextMenuItem>
                            ))}
                        </ContextMenuSubPopup>
                    </ContextMenuSub>
                ) : null}
                {canEditSystemPrompt ? (
                    <ContextMenuItem onClick={() => onEditSystemPrompt(chat)}>
                        <Icon className={contextMenuIconClassName} icon={PencilEdit02Icon} />
                        Instructions
                    </ContextMenuItem>
                ) : null}
                {canEditParticipants ? (
                    <ContextMenuItem onClick={() => onEditParticipants(chat)}>
                        <Icon className={contextMenuIconClassName} icon={PencilEdit02Icon} />
                        Participants
                    </ContextMenuItem>
                ) : null}
                {onOpenInNewWindow ? (
                    <ContextMenuItem onClick={() => onOpenInNewWindow(chat)}>
                        <Icon className={contextMenuIconClassName} icon={ArrowUpRight01Icon} />
                        Open in new window
                    </ContextMenuItem>
                ) : null}
                {canCloseTab && onCloseTab ? (
                    <ContextMenuItem onClick={() => onCloseTab(chat)}>
                        <Icon className={contextMenuIconClassName} icon={Cancel01Icon} />
                        Close tab
                    </ContextMenuItem>
                ) : null}
                {canArchive ? (
                    <ContextMenuItem onClick={() => onArchive(chat)}>
                        <Icon className={contextMenuIconClassName} icon={ArchiveIcon} />
                        {chat.conversationKind === 'channel' ? 'Archive channel' : 'Archive chat'}
                    </ContextMenuItem>
                ) : null}
            </ContextMenuPopup>
        </ContextMenu>
    );
}

interface SidebarChatSystemPromptDialogProps {
    chat: ChatListItem | null;
    errorMessage: string | null;
    isPending: boolean;
    onClose: () => void;
    onSubmit: (systemPrompt: string | null) => Promise<void>;
}

export function SidebarChatSystemPromptDialog({
    chat,
    errorMessage,
    isPending,
    onClose,
    onSubmit,
}: SidebarChatSystemPromptDialogProps) {
    return (
        <Dialog onOpenChange={(open) => !open && onClose()} open={chat !== null}>
            <DialogContent className="max-w-lg" showCloseButton={false}>
                {chat ? (
                    <SidebarChatSystemPromptForm
                        errorMessage={errorMessage}
                        initialSystemPrompt={chat.systemPrompt ?? ''}
                        isPending={isPending}
                        key={chat.id}
                        onClose={onClose}
                        onSubmit={onSubmit}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

interface SidebarChatSystemPromptFormProps {
    errorMessage: string | null;
    initialSystemPrompt: string;
    isPending: boolean;
    onClose: () => void;
    onSubmit: (systemPrompt: string | null) => Promise<void>;
}

function SidebarChatSystemPromptForm({
    errorMessage,
    initialSystemPrompt,
    isPending,
    onClose,
    onSubmit,
}: SidebarChatSystemPromptFormProps) {
    const [systemPrompt, setSystemPrompt] = React.useState(initialSystemPrompt);
    const handleSubmit = React.useEffectEvent(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (isPending) {
            return;
        }

        await onSubmit(normalizeSidebarChatSystemPrompt(systemPrompt));
    });

    return (
        <Form className="contents" onSubmit={handleSubmit}>
            <DialogHeader className="pe-6">
                <DialogTitle>Chat instructions</DialogTitle>
                <DialogDescription>
                    Set trusted instructions the agent should follow in this chat.
                </DialogDescription>
            </DialogHeader>
            <DialogPanel className="grid gap-3">
                <div className="pt-1">
                    <Textarea
                        autoFocus
                        onChange={(event) => setSystemPrompt(event.target.value)}
                        placeholder="Keep replies concise and focus on launch planning."
                        textareaClassName="min-h-40 resize-y"
                        value={systemPrompt}
                    />
                </div>
                {errorMessage ? (
                    <Alert variant="error">
                        <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                ) : null}
            </DialogPanel>
            <DialogFooter>
                <Button onClick={onClose} size="sm" type="button" variant="ghost">
                    Cancel
                </Button>
                <Button disabled={isPending} loading={isPending} size="sm" type="submit">
                    Save
                </Button>
            </DialogFooter>
        </Form>
    );
}

interface SidebarChatRenameDialogProps {
    chat: ChatListItem | null;
    errorMessage: string | null;
    isPending: boolean;
    onClose: () => void;
    onSubmit: (displayName: string) => Promise<void>;
}

export function SidebarChatRenameDialog({
    chat,
    errorMessage,
    isPending,
    onClose,
    onSubmit,
}: SidebarChatRenameDialogProps) {
    return (
        <Dialog onOpenChange={(open) => !open && onClose()} open={chat !== null}>
            <DialogContent className="max-w-sm" showCloseButton={false}>
                {chat ? (
                    <SidebarChatRenameForm
                        errorMessage={errorMessage}
                        initialDisplayName={chat.displayName}
                        isPending={isPending}
                        key={chat.id}
                        onClose={onClose}
                        onSubmit={onSubmit}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

interface SidebarChatRenameFormProps {
    errorMessage: string | null;
    initialDisplayName: string;
    isPending: boolean;
    onClose: () => void;
    onSubmit: (displayName: string) => Promise<void>;
}

function SidebarChatRenameForm({
    errorMessage,
    initialDisplayName,
    isPending,
    onClose,
    onSubmit,
}: SidebarChatRenameFormProps) {
    const [displayName, setDisplayName] = React.useState(initialDisplayName);
    const trimmedDisplayName = displayName.trim();
    const canSubmit = trimmedDisplayName.length > 0 && !isPending;

    const handleSubmit = React.useEffectEvent(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canSubmit) {
            return;
        }

        await onSubmit(trimmedDisplayName);
    });

    return (
        <Form className="contents" onSubmit={handleSubmit}>
            <DialogHeader className="pe-6">
                <DialogTitle>Rename chat</DialogTitle>
                <DialogDescription>Choose a short name for the sidebar.</DialogDescription>
            </DialogHeader>
            <DialogPanel className="grid gap-3">
                <div className="pt-1">
                    <Input
                        autoFocus
                        onChange={(event) => setDisplayName(event.target.value)}
                        onFocus={(event) => event.currentTarget.select()}
                        value={displayName}
                    />
                </div>
                {errorMessage ? (
                    <Alert variant="error">
                        <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                ) : null}
            </DialogPanel>
            <DialogFooter>
                <Button onClick={onClose} size="sm" type="button" variant="ghost">
                    Cancel
                </Button>
                <Button disabled={!canSubmit} loading={isPending} size="sm" type="submit">
                    Save
                </Button>
            </DialogFooter>
        </Form>
    );
}

export function canRenameSidebarChat(chat: Pick<ChatListItem, 'boundAgentIds'>) {
    return chat.boundAgentIds.length > 0;
}

export function canCustomizeSidebarChatColor(
    chat: Pick<ChatListItem, 'conversationKind' | 'type'>
) {
    return chat.type === 'tavern' && chat.conversationKind === 'channel';
}

export function canEditSidebarChatSystemPrompt(chat: Pick<ChatListItem, 'type'>) {
    return chat.type === 'tavern';
}

export function canEditSidebarChatParticipants(
    chat: Pick<ChatListItem, 'conversationKind' | 'type'>
) {
    return chat.type === 'tavern' && chat.conversationKind === 'channel';
}

export function canArchiveSidebarChat(chat: Pick<ChatListItem, 'conversationKind' | 'type'>) {
    return chat.type === 'tavern' && chat.conversationKind !== 'direct';
}

export function normalizeSidebarChatSystemPrompt(systemPrompt: string) {
    const trimmedSystemPrompt = systemPrompt.trim();

    return trimmedSystemPrompt.length > 0 ? trimmedSystemPrompt : null;
}

export function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return 'Something went wrong.';
}
