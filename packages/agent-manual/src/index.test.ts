import { expect, test } from 'bun:test';
import { getManualTopic, manualTopics, searchManualTopics } from './index.ts';

test('ships the tracer topics and a complete representative recipe', () => {
    expect(manualTopics.map((topic) => topic.id)).toEqual([
        'index',
        'grotto-cli-overview',
        'recipes/index',
        'recipes/seeded',
        'recipes/technique/task-claim-lock',
    ]);
    expect(getManualTopic('recipes/technique/task-claim-lock')?.body).toContain(
        'The task claim is the concurrency lock.'
    );
});

test('recipe scope stays inside the recipes namespace', () => {
    const results = searchManualTopics('claim task', { limit: 20, scope: 'recipes' });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((topic) => topic.id.startsWith('recipes/'))).toBe(true);
    expect(results[0]?.id).toBe('recipes/technique/task-claim-lock');
});
