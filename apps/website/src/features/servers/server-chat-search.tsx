import * as React from 'react';
import { Input } from '../../components/ui/input.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
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

    return (
        <div className="border-border border-b px-6 py-3">
            <form
                className="flex gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    setQuery(draft.trim());
                }}
            >
                <Input
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Search messages"
                    type="search"
                    value={draft}
                />
                <Button size="sm" type="submit" variant="outline">
                    Search
                </Button>
            </form>
            {query.length > 0 ? (
                <div className="mt-2 flex flex-col gap-1">
                    {search.data?.length === 0 ? (
                        <p className="text-muted-foreground text-xs">No matching messages.</p>
                    ) : (
                        search.data?.map((message) => (
                            <Button
                                className="h-auto justify-start whitespace-normal px-2 py-1 text-left"
                                key={message.id}
                                onClick={() => onOpenChat(message.chatId)}
                                size="xs"
                                variant="ghost"
                            >
                                {message.content}
                            </Button>
                        ))
                    )}
                </div>
            ) : null}
        </div>
    );
}
