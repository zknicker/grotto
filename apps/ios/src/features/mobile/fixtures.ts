import { Image } from 'react-native';

import blippyAvatar from '../../../assets/avatars/blippy.png';
import ownerAvatar from '../../../assets/avatars/owner.jpg';
import tinyAvatar from '../../../assets/avatars/tiny.png';
import type {
    ActorSummary,
    AgentSummary,
    ChatMessage,
    ChatSummary,
    HumanSummary,
    ServerSummary,
} from './types';

export const agents: AgentSummary[] = [
    {
        availability: 'idle',
        avatarUrl: Image.resolveAssetSource(blippyAvatar).uri,
        displayName: 'Blippy',
        id: 'agent-blippy',
        kind: 'agent',
    },
    {
        availability: 'working',
        avatarUrl: Image.resolveAssetSource(tinyAvatar).uri,
        displayName: 'Tiny',
        id: 'agent-tiny',
        kind: 'agent',
    },
];

export const humans: HumanSummary[] = [
    {
        avatarUrl: Image.resolveAssetSource(ownerAvatar).uri,
        displayName: 'Zach',
        id: 'human-zach',
        kind: 'human',
    },
];

export const server: ServerSummary = {
    agentCount: agents.length,
    avatarUrl: null,
    id: 'server-grotto',
    memberCount: humans.length,
    name: 'Grotto',
};

export const actors: ActorSummary[] = [...humans, ...agents];

export const chats: ChatSummary[] = [
    {
        id: 'channel-all',
        kind: 'channel',
        name: 'all',
    },
    {
        id: 'channel-product',
        kind: 'channel',
        name: 'product',
        unread: 3,
    },
    {
        id: 'channel-onboarding',
        kind: 'channel',
        name: 'onboarding-owner',
    },
    {
        id: 'dm-blippy',
        kind: 'dm',
        peerAgentId: 'agent-blippy',
    },
    {
        id: 'dm-tiny',
        kind: 'dm',
        peerAgentId: 'agent-tiny',
        unread: 1,
    },
];

export function getChatTitle(chatId: string): string {
    const chat = chats.find((candidate) => candidate.id === chatId);
    if (!chat) {
        return chats[0]?.kind === 'channel' ? chats[0].name : 'Grotto';
    }
    if (chat.kind === 'channel') {
        return chat.name;
    }
    return agents.find((agent) => agent.id === chat.peerAgentId)?.displayName ?? 'Direct message';
}

export const messages: ChatMessage[] = [
    {
        authorId: 'human-zach',
        body: 'Morning team — what should we focus on today?',
        id: 'message-1',
        timestamp: '9:41 AM',
    },
    {
        authorId: 'agent-blippy',
        body: 'I’ll keep the plan tight and surface decisions early. The native shell can diverge at the rendering layer while the Server contract stays shared.',
        id: 'message-2',
        replies: 4,
        timestamp: '9:42 AM',
    },
    {
        authorId: 'agent-tiny',
        body: 'I’ll pressure-test the details and keep the work grounded.',
        id: 'message-3',
        timestamp: '9:43 AM',
    },
    {
        artifact: { id: 'architecture', title: 'iPhone architecture brief', kind: 'Page' },
        authorId: 'human-zach',
        body: 'Perfect. Let’s prove the daily chat loop in the simulator first.',
        id: 'message-4',
        timestamp: '9:45 AM',
    },
];
