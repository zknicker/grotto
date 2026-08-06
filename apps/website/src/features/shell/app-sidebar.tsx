import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgents } from '../../hooks/members/use-agents.ts';
import { useChats } from '../../hooks/servers/use-chats.ts';
import { useCreateServerChannel } from '../../hooks/servers/use-create-server-channel.ts';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { type ChannelAgentOption, ChannelDialog } from '../chats/channel-dialog.tsx';
import { serverChatRoute } from '../servers/server-routes.ts';
import { ChatNavigation } from './chat-navigation.tsx';

/** Contextual sidebar for the server: channels and DMs. */
export function AppSidebar({
    currentServer,
    selectedChatId,
}: {
    currentServer: ServerSummary;
    selectedChatId: string | undefined;
}) {
    const navigate = useNavigate();
    const agents = useAgents(currentServer.id);
    const chats = useChats(currentServer.id);
    const createChannel = useCreateServerChannel();
    const [creatingChannel, setCreatingChannel] = React.useState(false);
    const slug = currentServer.slug;
    const agentItems = agents.data ?? [];
    const chatItems = chats.data ?? [];
    const channelAgents: ChannelAgentOption[] = agentItems.map((agent) => ({
        avatarUrl: agent.avatarUrl,
        id: agent.id,
        name: agent.displayName,
    }));

    return (
        <>
            <ChatNavigation
                agents={agentItems}
                chats={chatItems}
                onCreateChannel={() => {
                    createChannel.reset();
                    setCreatingChannel(true);
                }}
                selectedChatId={selectedChatId}
                slug={slug}
            />
            <ChannelDialog
                agents={channelAgents}
                agentsPending={agents.isPending}
                errorMessage={createChannel.error?.message ?? null}
                initialAgentIds={[]}
                initialDisplayName=""
                isPending={createChannel.isPending}
                onClose={() => {
                    createChannel.reset();
                    setCreatingChannel(false);
                }}
                onSubmit={async ({ agentIds, displayName }) => {
                    const channel = await createChannel.mutateAsync({
                        agentIds,
                        name: displayName,
                        serverId: currentServer.id,
                    });
                    setCreatingChannel(false);
                    navigate(serverChatRoute(slug, channel.id));
                }}
                open={creatingChannel}
                submitLabel="Create"
                title="New channel"
            />
        </>
    );
}
