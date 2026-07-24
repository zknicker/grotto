import { createAgent } from '../agent-settings/service.ts';
import { emitAgentUpdated } from '../api/invalidation-events.ts';
import { getAgentProfile, saveAgentProfile } from '../storage/agent-profiles.ts';
import { listAgents } from '../storage/agents.ts';

/**
 * Cove — the shipped default agent (WS8, ADR 0018). A production first run
 * has zero agents (nothing bootstraps lazily), so the server creates the
 * onboarding guide through the normal create path: guide-seeded workspace,
 * blob avatar. Any existing agent suppresses it, so deleting Cove after the
 * team exists never resurrects it. Dev stacks seed demo agents instead, and
 * the e2e harness owns its own fixture — both skip this.
 */
export async function ensureShippedDefaultAgent() {
    if (isDevOrTestStack()) {
        return { created: false };
    }
    const agents = await listAgents();
    if (agents.length > 0) {
        return { created: false };
    }

    // createAgent pins the guide's blob avatar and seeds the guide workspace.
    await createAgent({
        archetype: 'guide',
        bio: 'Onboarding guide — helps you shape your team and start real work',
        name: 'Cove',
    });
    return { created: true };
}

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

function isDevOrTestStack() {
    return process.env.TAVERN_DEV_STACK === '1' || process.env.NODE_ENV === 'test';
}
