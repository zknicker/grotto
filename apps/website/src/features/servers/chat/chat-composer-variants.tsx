import { ServerChatComposer } from './chat-composer.tsx';

export function ChatComposer(props: {
    chatId: string;
    chatName: string;
    onThreadCreated?: (threadChatId: string) => void;
    pendingChatId?: string;
    placeholder?: string;
    serverId: string;
    thread?: { anchorMessageId: string };
    variant?: 'primary' | 'secondary';
}) {
    return <ServerChatComposer {...props} target={{ chatId: props.chatId, kind: 'chat' }} />;
}

export function ImplicitAgentDmComposer({
    agentId,
    chatName,
    onMaterialized,
    serverId,
}: {
    agentId: string;
    chatName: string;
    onMaterialized: (chatId: string) => void;
    serverId: string;
}) {
    return (
        <ServerChatComposer
            chatName={chatName}
            onMaterialized={onMaterialized}
            serverId={serverId}
            target={{ agentId, kind: 'agent-dm' }}
        />
    );
}
