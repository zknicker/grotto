import { Button, SearchField } from '@heroui/react';
import { ListView } from '@heroui-pro/react';
import * as React from 'react';
import { useSearchServerChat } from '../../hooks/servers/use-search-server-chat.ts';

export function ServerChatSearch({
    onOpenChat,
    serverId,
}: {
    onOpenChat(chatId: string): void;
    serverId: string;
}) {
    const [draft, setDraft] = React.useState('');
    const [query, setQuery] = React.useState('');
    const search = useSearchServerChat(serverId, query);
    const matches = search.data ?? [];

    return (
        <div className="border-border border-b px-6 py-3">
            <form
                className="flex gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    setQuery(draft.trim());
                }}
            >
                <SearchField
                    aria-label="Search messages"
                    fullWidth
                    onChange={setDraft}
                    value={draft}
                >
                    <SearchField.Group>
                        <SearchField.SearchIcon />
                        <SearchField.Input placeholder="Search messages" />
                        <SearchField.ClearButton />
                    </SearchField.Group>
                </SearchField>
                <Button type="submit" variant="outline">
                    Search
                </Button>
            </form>
            {query.length > 0 ? (
                <div className="mt-2">
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
        </div>
    );
}
