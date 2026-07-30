import { emitAgentUpdated } from '../api/invalidation-events.ts';
import { getAgentProfile, saveAgentProfile } from '../storage/agent-profiles.ts';
import { listAgents } from '../storage/agents.ts';

/**
 * Dev-stack demo agents get pinned non-blob avatars so the blob stays
 * visually reserved for Cove. Only fills the gap — a character the operator
 * chose is never overwritten.
 */
export async function pinDevelopmentDemoAgentAvatars() {
    if (process.env.TAVERN_DEV_STACK !== '1') {
        return;
    }
    const demoCharacters: Record<string, string> = { Otto: 'robot', Wren: 'bird' };
    const agents = await listAgents();
    let pinned = 0;

    for (const agent of agents) {
        const character = demoCharacters[agent.name];
        if (!character) {
            continue;
        }
        const profile = await getAgentProfile({ agentId: agent.id, runtimeId: agent.runtimeId });
        if (profile?.character) {
            continue;
        }
        await saveAgentProfile({ agentId: agent.id, character, runtimeId: agent.runtimeId });
        pinned += 1;
    }
    if (pinned > 0) {
        emitAgentUpdated();
    }
}
