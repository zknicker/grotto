import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';

const [
    agentRuntimeHub,
    agentRuntimeSkills,
    invalidationEvents,
    inventoryJob,
    inventorySync,
    hubService,
    skillService,
] = await Promise.all([
    import('../agent-runtime/skill-hub.ts'),
    import('../agent-runtime/skills.ts'),
    import('../api/invalidation-events.ts'),
    import('./inventory-job.ts'),
    import('./inventory-sync.ts'),
    import('./hub-service.ts'),
    import('./service.ts'),
]);

afterEach(() => {
    mock.restore();
});

test('installSkillHubSkill returns conflicts without refreshing inventory', async () => {
    const installSpy = spyOn(agentRuntimeHub, 'installAgentRuntimeSkillHubSkill').mockResolvedValue(
        {
            conflict: true,
            exitCode: null,
            log: ['tavern-workflow was edited since install. Reinstall with force to replace it.'],
            ok: false,
        }
    );
    const refreshSpy = spyOn(inventorySync, 'refreshRuntimeSkillInventory').mockResolvedValue({
        changed: false,
        refreshed: 0,
    });
    const enqueueSpy = spyOn(inventoryJob, 'enqueueRuntimeSkillInventoryRefresh').mockResolvedValue(
        null
    );
    const emitSpy = spyOn(invalidationEvents, 'emitSkillInvalidationCascade').mockImplementation(
        () => undefined
    );

    const result = await hubService.installSkillHubSkill({
        force: true,
        identifier: 'builtin:tavern-workflow',
    });

    assert.equal(result.conflict, true);
    assert.deepEqual(installSpy.mock.calls[0]?.[0], {
        force: true,
        identifier: 'builtin:tavern-workflow',
    });
    assert.equal(refreshSpy.mock.calls.length, 0);
    assert.equal(enqueueSpy.mock.calls.length, 0);
    assert.equal(emitSpy.mock.calls.length, 0);
});

test('resetSkill refreshes inventory and emits skill invalidation', async () => {
    spyOn(agentRuntimeSkills, 'resetAgentRuntimeSkill').mockResolvedValue({
        hash: 'hash_123',
        skillId: 'visuals',
    });
    const refreshSpy = spyOn(inventorySync, 'refreshRuntimeSkillInventory').mockResolvedValue({
        changed: true,
        refreshed: 1,
    });
    const emitSpy = spyOn(invalidationEvents, 'emitSkillInvalidationCascade').mockImplementation(
        () => undefined
    );

    const result = await skillService.resetSkill({ skillId: 'visuals' });

    assert.deepEqual(result, {
        hash: 'hash_123',
        skillId: 'visuals',
    });
    assert.equal(refreshSpy.mock.calls.length, 1);
    assert.equal(emitSpy.mock.calls.length, 1);
});
