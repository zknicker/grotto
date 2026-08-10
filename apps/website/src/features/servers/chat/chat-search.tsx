import { SearchField } from '@heroui/react';
import { ListView } from '@heroui-pro/react';
import * as React from 'react';
import { useChatSearch } from '../../../hooks/servers/use-chat-search.ts';
import { SectionHeader } from '../../shell/section-header.tsx';
import { PageTopbar } from '../../shell/shell-topbar.tsx';

export function ChatSearch({
    onOpenChat,
    serverId,
}: {
    onOpenChat(chatId: string): void;
    serverId: string;
}) {
    const [draft, setDraft] = React.useState('');
    const [query, setQuery] = React.useState('');
    const search = useChatSearch(serverId, query);
    const matches = search.data ?? [];

    return (
        <section aria-label="Search" className="flex min-h-0 flex-1 flex-col">
            <PageTopbar>
                <SectionHeader title="Search">
                    <SearchField
                        aria-label="Search messages"
                        className="w-72 max-w-[50vw]"
                        onChange={setDraft}
                        onClear={() => setQuery('')}
                        onSubmit={(value) => setQuery(value.trim())}
                        value={draft}
                    >
                        <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder="Search messages..." />
                            <SearchField.ClearButton />
                        </SearchField.Group>
                    </SearchField>
                </SectionHeader>
            </PageTopbar>
            {query.length > 0 ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    <ListView
                        aria-label="Message search results"
                        items={matches}
                        onAction={(key) => {
                            const match = matches.find((message) => message.id === key);
                            if (match) {
                                onOpenChat(match.chatId);
                            }
                        }}
                        renderEmptyState={() => 'No matching messages.'}
                        variant="secondary"
                    >
                        {(message) => (
                            <ListView.Item id={message.id} textValue={message.content}>
                                <ListView.ItemContent>
                                    <ListView.Title>{message.content}</ListView.Title>
                                </ListView.ItemContent>
                            </ListView.Item>
                        )}
                    </ListView>
                </div>
            ) : null}
        </section>
    );
}
