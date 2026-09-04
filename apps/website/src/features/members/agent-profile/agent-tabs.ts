export const agentTabs = ['overview', 'activity', 'automations', 'tools', 'workspace'] as const;

export type AgentTab = (typeof agentTabs)[number];

export function isAgentTab(value: string | undefined): value is AgentTab {
    return agentTabs.some((tab) => tab === value);
}
