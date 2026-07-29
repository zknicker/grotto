import type { HostedAgent, HostedChatMessage } from '@tavern/api';

export type ServerThreadAuthor =
    | { kind: 'agent'; agent: HostedAgent }
    | { kind: 'human'; label: string }
    | { kind: 'reminder'; label: string };

export function serverThreadAuthor(
    message: HostedChatMessage,
    agentsById: ReadonlyMap<string, HostedAgent>
): ServerThreadAuthor {
    if (message.author.kind === 'agent') {
        const agent = agentsById.get(message.author.agentId);
        if (agent) {
            return { agent, kind: 'agent' };
        }
        return { kind: 'human', label: 'Agent' };
    }
    if (message.author.kind === 'human') {
        return { kind: 'human', label: `Human ${message.author.userId.slice(-6)}` };
    }
    return { kind: 'reminder', label: 'Reminder' };
}
