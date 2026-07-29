import type { HostedAgent } from '@tavern/api';
import { AgentFace, type AgentFaceProps } from '../chats/agent-face.tsx';

export function HostedAgentFace({
    agent,
    ...props
}: Omit<AgentFaceProps, 'head'> & {
    agent: Pick<HostedAgent, 'character'>;
}) {
    return <AgentFace {...props} head={agent.character} />;
}
