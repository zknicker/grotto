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
 * files: a ghost Segment using HeroUI's icon-expand pattern — the active
 * view is an accent pill with icon + label, inactive views collapse to
 * icons.
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
            size="sm"
            variant="ghost"
        >
            {chatViewTabs.map((tab) => (
                <Segment.Item className="w-auto" id={tab.value} key={tab.value} style={{ gap: 0 }}>
                    {({ isSelected }: { isSelected: boolean }) => (
                        <>
                            <Icon aria-hidden="true" icon={tab.icon} size={15} />
                            <span
                                className="inline-grid transition-all duration-200 ease-out motion-reduce:transition-none"
                                style={{
                                    gridTemplateColumns: isSelected ? '1fr' : '0fr',
                                    minWidth: 0,
                                    opacity: isSelected ? 1 : 0,
                                }}
                            >
                                <span
                                    className="overflow-hidden whitespace-nowrap transition-[padding] duration-200 ease-out motion-reduce:transition-none"
                                    style={{
                                        minWidth: 0,
                                        paddingInlineStart: isSelected ? '0.375rem' : 0,
                                    }}
                                >
                                    {tab.label}
                                </span>
                            </span>
                        </>
                    )}
                </Segment.Item>
            ))}
        </Segment>
    );
}
