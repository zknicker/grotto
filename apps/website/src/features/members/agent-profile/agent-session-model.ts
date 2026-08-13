import type { Agent } from '@tavern/api';

export function fullResetCopy(factoryKind: Agent['factoryKind']) {
    if (factoryKind === 'cove') {
        return {
            confirmation:
                "This starts a fresh session and permanently wipes Cove's workspace, MEMORY.md, skills, and runtime-local state. Cove's factory onboarding workspace and factory-managed skills are restored. Identity, Chat history, model configuration, and connections are kept.",
            description:
                "Start fresh and restore Cove's factory onboarding workspace and factory-managed skills.",
        };
    }
    return {
        confirmation:
            "This starts a fresh session and permanently wipes the Agent's workspace, MEMORY.md, skills, and runtime-local state. A minimal MEMORY.md and factory-managed skills are restored. Identity, Chat history, model configuration, and connections are kept.",
        description: 'Start fresh and restore a minimal MEMORY.md and factory-managed skills.',
    };
}
