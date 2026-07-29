import { HashtagIcon } from '@hugeicons-pro/core-solid-rounded';
import { BubbleChatIcon } from '@hugeicons-pro/core-stroke-rounded';
import { useNavigate } from 'react-router-dom';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '../../../components/ui/empty.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { SettingsGroup } from '../../../components/ui/settings-row.tsx';
import { Spinner } from '../../../components/ui/spinner.tsx';
import { useAgentChatList } from '../../../hooks/agents/use-agent-chats.ts';
import { appRoutes } from '../../../lib/app-routes.ts';
import { listAgentChats } from './agent-chat-selection.ts';

export function AgentChatTab({ agentId }: { agentId: string }) {
    const chatsQuery = useAgentChatList({ agentId });
    const navigate = useNavigate();
    const chats = listAgentChats(chatsQuery.data);
    const channels = chats.filter((chat) => chat.conversationKind === 'channel');
    const directMessages = chats.filter((chat) => chat.conversationKind === 'direct');

    if (chatsQuery.isPending) {
        return <LoadingChats />;
    }
    if (chatsQuery.isError && !chatsQuery.data) {
        return <p className="px-6 py-10 text-destructive text-sm">Could not load chats.</p>;
    }

    return (
        <div className="mx-auto grid w-full max-w-3xl gap-8 py-6">
            <header className="px-3">
                <h2 className="font-semibold text-base text-foreground">Agent channels and DMs</h2>
            </header>
            <ChatSection
                empty="Not in any channels yet."
                icon={HashtagIcon}
                label="Channels"
                onOpen={(chatId) => navigate(appRoutes.chat(chatId))}
                rows={channels}
            />
            <ChatSection
                empty="No direct message chats yet."
                icon={BubbleChatIcon}
                label="Direct messages"
                onOpen={(chatId) => navigate(appRoutes.chat(chatId))}
                rows={directMessages}
            />
            <section>
                <h3 className="px-3 font-medium font-mono text-muted-foreground text-sm uppercase tracking-wider">
                    Agent DMs
                </h3>
                <SettingsGroup className="mt-2">
                    <Empty className="min-h-52 py-10">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <Icon icon={BubbleChatIcon} />
                            </EmptyMedia>
                            <EmptyTitle className="text-base">No agent-to-agent DMs yet</EmptyTitle>
                            <EmptyDescription className="text-sm">
                                Recent agent-to-agent DM activity will appear here.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                </SettingsGroup>
            </section>
        </div>
    );
}

type ChatRow = ReturnType<typeof listAgentChats>[number];

function ChatSection({
    empty,
    icon,
    label,
    onOpen,
    rows,
}: {
    empty: string;
    icon: Parameters<typeof Icon>[0]['icon'];
    label: string;
    onOpen: (chatId: string) => void;
    rows: ChatRow[];
}) {
    return (
        <section>
            <h3 className="px-3 font-medium font-mono text-muted-foreground text-sm uppercase tracking-wider">
                {label}
            </h3>
            {rows.length === 0 ? (
                <p className="px-3 py-4 text-muted-foreground text-sm">{empty}</p>
            ) : (
                <SettingsGroup className="mt-2">
                    <ul className="divide-y divide-border">
                        {rows.map((chat) => (
                            <li key={chat.id}>
                                <button
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-accent"
                                    onClick={() => onOpen(chat.id)}
                                    type="button"
                                >
                                    <Icon className="size-4 text-muted-foreground" icon={icon} />
                                    <span className="truncate font-medium text-foreground">
                                        {chat.title}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </SettingsGroup>
            )}
        </section>
    );
}

function LoadingChats() {
    return (
        <p className="flex items-center gap-2 px-6 py-10 text-muted-foreground text-sm">
            <Spinner className="size-4" />
            Loading chats...
        </p>
    );
}
