import { Button } from '@heroui/react';
import { useAgent } from '../../hooks/members/use-agent.ts';
import {
    closeAgentProfilePane,
    useAgentProfilePane,
} from '../../hooks/pane/use-agent-profile-pane.ts';
import { useChatSidePane } from '../../hooks/pane/use-chat-side-pane.ts';
import type { ServerDetail } from '../../lib/grotto-server.tsx';
import { ChatSidePaneShell } from '../chats/chat-side-pane-shell.tsx';
import { AgentLoading } from '../members/agent-profile/agent-loading.tsx';
import { AgentProfilePane } from '../members/agent-profile/agent-profile.tsx';

export function AgentProfilePanel({
    chatId,
    server,
    takeover = false,
}: {
    chatId: string;
    server: ServerDetail;
    takeover?: boolean;
}) {
    const agentId = useAgentProfilePane(chatId);
    const activeSidePane = useChatSidePane(chatId);
    const agent = useAgent(server.id, agentId ?? undefined);
    const unavailable = agent.isError && (!agent.data || agent.error.data?.code === 'NOT_FOUND');

    return (
        <ChatSidePaneShell
            label="Agent profile"
            open={activeSidePane === 'profile' && agentId !== null}
            takeover={takeover}
        >
            {(width) =>
                unavailable ? (
                    <div
                        className="m-auto flex flex-col items-center gap-3 px-6 text-center"
                        style={{ width: width ?? undefined }}
                    >
                        <div>
                            <p className="font-medium text-foreground text-sm">Agent unavailable</p>
                            <p className="mt-1 text-muted text-sm">
                                This Agent may have been removed.
                            </p>
                        </div>
                        <Button
                            onPress={() => closeAgentProfilePane(chatId)}
                            size="sm"
                            variant="secondary"
                        >
                            Close
                        </Button>
                    </div>
                ) : agent.data ? (
                    <div
                        className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
                        style={{ width: width ?? undefined }}
                    >
                        <AgentProfilePane
                            agent={agent.data}
                            key={agent.data.id}
                            onClose={() => closeAgentProfilePane(chatId)}
                            server={server}
                        />
                    </div>
                ) : (
                    <div className="m-auto w-full px-5" style={{ width: width ?? undefined }}>
                        <AgentLoading label="Loading Agent" />
                    </div>
                )
            }
        </ChatSidePaneShell>
    );
}
