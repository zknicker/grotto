import type { AgentInboxItem, HausAgentMessage } from '@haus/api';

export function inboxSender(input: {
    attention: boolean;
    message?: HausAgentMessage;
    source: string;
    target: string;
}): Pick<AgentInboxItem, 'senderHandle' | 'senderType'> {
    if (input.attention) {
        return { senderHandle: 'haus', senderType: 'system' };
    }
    if (input.source === 'human') {
        const senderHandle = input.message?.sender.handle ?? humanHandleFromDmTarget(input.target);
        if (!senderHandle) {
            throw new Error('A human delivery sender does not have an active Server handle.');
        }
        return { senderHandle, senderType: 'human' };
    }
    const agentHandle = input.source.startsWith('agent:')
        ? input.source.slice('agent:'.length)
        : null;
    const senderHandle =
        agentHandle ?? (input.source === 'task_assignment' ? 'haus' : input.source);
    if (!senderHandle) {
        throw new Error('A human delivery sender does not have an active Server handle.');
    }
    return {
        senderHandle,
        senderType: input.source === 'trigger' ? 'trigger' : agentHandle ? 'agent' : 'system',
    };
}

function humanHandleFromDmTarget(target: string): string | null {
    if (!target.startsWith('dm:@')) {
        return null;
    }
    return target.slice('dm:@'.length).split(':')[0] || null;
}
