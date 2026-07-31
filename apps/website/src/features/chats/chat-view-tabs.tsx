import { Tabs } from '@heroui/react';
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

/** View switcher between the chat transcript, its tasks, and its files. */
export function ChatViewTabs({
    onValueChange,
    value,
}: {
    onValueChange: (value: ChatViewTab) => void;
    value: ChatViewTab;
}) {
    return (
        <div className="shrink-0 border-separator border-b px-2">
            <Tabs
                onSelectionChange={(key) => onValueChange(key as ChatViewTab)}
                selectedKey={value}
                variant="secondary"
            >
                <Tabs.ListContainer>
                    <Tabs.List aria-label="Chat views">
                        {chatViewTabs.map((tab) => (
                            <Tabs.Tab id={tab.value} key={tab.value}>
                                <Icon aria-hidden="true" icon={tab.icon} size={16} />
                                {tab.label}
                                <Tabs.Indicator />
                            </Tabs.Tab>
                        ))}
                    </Tabs.List>
                </Tabs.ListContainer>
            </Tabs>
        </div>
    );
}
