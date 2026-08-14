export type AgentAvailability = 'error' | 'idle' | 'offline' | 'stopped' | 'working';

interface ActorSummaryBase {
    avatarUrl: string | null;
    displayName: string;
    id: string;
}

export interface AgentSummary extends ActorSummaryBase {
    availability: AgentAvailability;
    kind: 'agent';
}

export interface HumanSummary extends ActorSummaryBase {
    kind: 'human';
}

export type ActorSummary = AgentSummary | HumanSummary;

export interface ServerSummary {
    agentCount: number;
    avatarUrl: string | null;
    id: string;
    memberCount: number;
    name: string;
}

interface ChatSummaryBase {
    id: string;
    unread: number;
}

export interface ChannelSummary extends ChatSummaryBase {
    kind: 'channel';
    name: string;
}

export interface AgentDmSummary extends ChatSummaryBase {
    kind: 'dm';
    peerAgentId: string;
}

export type ChatSummary = AgentDmSummary | ChannelSummary;
