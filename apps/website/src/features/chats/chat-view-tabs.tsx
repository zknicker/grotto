import {
    Attachment01Icon,
    BubbleChatIcon,
    CheckListIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { PaneTopbar } from '../../components/ui/pane.tsx';
import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from '../../components/ui/tabs-subtle.tsx';

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

export function ChatViewTabs({
    onValueChange,
    value,
}: {
    onValueChange: (value: ChatViewTab) => void;
    value: ChatViewTab;
}) {
    return (
        <PaneTopbar className="gap-0 px-0">
            <TabsSubtle
                className="h-full min-w-0 flex-1"
                onValueChange={(nextValue) => onValueChange(nextValue as ChatViewTab)}
                value={value}
            >
                <TabsSubtleList
                    aria-label="Chat views"
                    className="h-full px-3 py-0"
                    variant="underline"
                >
                    {chatViewTabs.map((tab) => (
                        <TabsSubtleItem
                            icon={tab.icon}
                            key={tab.value}
                            label={tab.label}
                            size="sm"
                            value={tab.value}
                        />
                    ))}
                </TabsSubtleList>
            </TabsSubtle>
        </PaneTopbar>
    );
}
