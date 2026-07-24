import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { hasAgentHostToolGrant, setAgentHostToolGrant } from './host-tools.ts';
import { setRuntimeSkillEnabled } from './skill-library.ts';

describe('agent grants', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        upsertStoredAgent({
            agent: {
                enabledSkillIds: ['research'],
                id: 'agent-1',
                isAdmin: false,
                name: 'AgentOne',
                primaryColor: null,
                workspaceFolder: '/tmp/agent-one',
            },
        });
    });

    afterEach(() => closeDb());

    it('grants web fetch by default while Browser remains explicit', () => {
        expect(hasAgentHostToolGrant('agent-1', 'web_fetch')).toBe(true);
        expect(hasAgentHostToolGrant('agent-1', 'browser')).toBe(false);
        setAgentHostToolGrant('agent-1', 'browser', true);
        expect(hasAgentHostToolGrant('agent-1', 'browser')).toBe(true);
    });

    it('lists affected agents and permanently clears assignments when a skill is disabled', () => {
        expect(setRuntimeSkillEnabled('research', false)).toEqual([
            { id: 'agent-1', name: 'AgentOne' },
        ]);
        expect(
            getDb()
                .prepare(
                    `SELECT 1 FROM agent_skill_assignments
                     WHERE agent_id = 'agent-1' AND skill_id = 'research'`
                )
                .get()
        ).toBeNull();
        setRuntimeSkillEnabled('research', true);
        expect(
            getDb()
                .prepare(
                    `SELECT 1 FROM agent_skill_assignments
                     WHERE agent_id = 'agent-1' AND skill_id = 'research'`
                )
                .get()
        ).toBeNull();
    });
});
