export interface OverviewAgent {
    avatarUrl: string | null;
    id: string;
    name: string;
    primaryColor: string | null;
}

export interface OverviewPresenceEntry {
    agentId: string;
    label?: string;
    state: 'busy' | 'idle';
    tone?: 'success' | 'warning';
}
