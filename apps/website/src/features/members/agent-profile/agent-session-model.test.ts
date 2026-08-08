import { expect, test } from 'bun:test';
import { fullResetCopy } from './agent-session-model.ts';

test('describes the factory state restored for each Agent kind', () => {
    expect(fullResetCopy('ordinary')).toEqual({
        confirmation:
            "This starts a fresh session and permanently wipes the Agent's workspace, MEMORY.md, skills, and runtime-local state. A minimal MEMORY.md and factory-managed skills are restored. Identity, Chat history, model configuration, and connections are kept.",
        description: 'Start fresh and restore a minimal MEMORY.md and factory-managed skills.',
    });
    expect(fullResetCopy('cove')).toEqual({
        confirmation:
            "This starts a fresh session and permanently wipes Cove's workspace, MEMORY.md, skills, and runtime-local state. Cove's factory onboarding workspace and factory-managed skills are restored. Identity, Chat history, model configuration, and connections are kept.",
        description:
            "Start fresh and restore Cove's factory onboarding workspace and factory-managed skills.",
    });
});
