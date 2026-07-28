import type { AgentCharacter } from '@tavern/api/agent-appearance';

export interface OverviewAgent {
    effectiveCharacter: AgentCharacter;
    effectivePrimaryColor: string | null;
    id: string;
    name: string;
}

export interface OverviewPresenceEntry {
    agentId: string;
    animate?: boolean;
    label?: string;
    state: 'busy' | 'idle';
    tone?: 'success' | 'warning';
}
