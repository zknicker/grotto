import { Segment } from '@heroui-pro/react';
import {
    Attachment01Icon,
    BubbleChatIcon,
    CheckListIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';

const chatViewTabs = [
    { icon: BubbleChatIcon, label: 'Chat', value: 'chat' },
    { icon: CheckListIcon, label: 'Tasks', value: 'tasks' },
    { icon: Attachment01Icon, label: 'Files', value: 'files' },
] as const;

export type ChatViewTab = (typeof chatViewTabs)[number]['value'];

export function supportsChatViewTabs(chat: { conversationKind: string; type: string }) {
    return (
        chat.type === 'tavern' &&
        (chat.conversationKind === 'channel' || chat.conversationKind === 'direct')
    );
}

/**
 * In-band view switcher between the chat transcript, its tasks, and its
 * files: a compact ghost Segment — the active view carries the accent
 * pill, every view keeps its icon and label visible.
 */
export function ChatViewSwitcher({
    onValueChange,
    value,
}: {
    onValueChange: (value: ChatViewTab) => void;
    value: ChatViewTab;
}) {
    return (
        <Segment
            aria-label="Chat views"
            onSelectionChange={(key) => onValueChange(key as ChatViewTab)}
            selectedKey={value}
            size="md"
            variant="ghost"
        >
            {chatViewTabs.map((tab) => (
                <Segment.Item id={tab.value} key={tab.value}>
                    <Icon aria-hidden="true" icon={tab.icon} size={15} />
                    {tab.label}
                </Segment.Item>
            ))}
        </Segment>
    );
}
