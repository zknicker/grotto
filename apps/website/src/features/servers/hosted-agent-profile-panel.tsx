import type { HostedAgent } from '@tavern/api';
import {
    closeAgentProfilePane,
    useAgentProfilePane,
} from '../../hooks/pane/use-agent-profile-pane.ts';
import { useChatSidePane } from '../../hooks/pane/use-chat-side-pane.ts';
import type { ServerDetail } from '../../lib/grotto-server.tsx';
import { ChatSidePaneShell } from '../chats/chat-side-pane-shell.tsx';
import { HostedAgentProfile } from '../members/agent-profile/hosted-agent-profile.tsx';

export function HostedAgentProfilePanel({
    agents,
    chatId,
    server,
}: {
    agents: HostedAgent[];
    chatId: string;
    server: ServerDetail;
}) {
    const agentId = useAgentProfilePane(chatId);
    const activeSidePane = useChatSidePane(chatId);
    const agent = agents.find((candidate) => candidate.id === agentId) ?? null;

    return (
        <ChatSidePaneShell
            label="Agent profile"
            open={activeSidePane === 'profile' && agent !== null}
        >
            {(width) =>
                agent ? (
                    <div
                        className="flex h-full min-h-0 flex-col"
                        style={{ width: width ?? undefined }}
                    >
                        <HostedAgentProfile
                            agent={agent}
                            key={agent.id}
                            onClose={() => closeAgentProfilePane(chatId)}
                            server={server}
                            variant="pane"
                        />
                    </div>
                ) : null
            }
        </ChatSidePaneShell>
    );
}
