import assert from 'node:assert/strict';
import test from 'node:test';
import { settingsNavItems, settingsNavSections } from './navigation.ts';

test('settings navigation uses current agent configuration vocabulary', () => {
    const labels: string[] = settingsNavItems.map((item) => item.label);
    assert.ok(!labels.includes('Memory'));
    assert.ok(!labels.includes('Tools'));
    assert.ok(!labels.includes('Channels'));
    assert.ok(!labels.includes('MCP'));
    assert.ok(!labels.includes('Agent'));
    assert.ok(!labels.includes('NOTES.md'));
    assert.ok(!labels.includes('SOUL.md'));
    assert.ok(!labels.includes('Toolsets'));
    assert.ok(!labels.includes('Connectors'));
    assert.ok(!labels.includes('McpServers'));
});

test('settings navigation exposes Server administration', () => {
    assert.ok(settingsNavItems.some((item) => item.id === 'server' && item.label === 'General'));
    assert.ok(settingsNavItems.some((item) => item.id === 'members' && item.label === 'Members'));
});

/**
 * Sections group by who a setting belongs to. A section that mixed subjects is
 * what this replaced, so the grouping itself is the contract — not just the
 * item list.
 */
test('settings navigation groups by subject, and every item belongs to one', () => {
    const sectionIds: string[] = settingsNavSections.map((section) => section.id);
    assert.deepEqual(sectionIds, ['account', 'server', 'agents']);

    const grouped: string[] = settingsNavSections
        .flatMap((section) => section.itemIds as readonly string[])
        .slice()
        .sort();
    const all: string[] = settingsNavItems.map((item) => item.id).sort();
    assert.deepEqual(grouped, all);
});

test('device and Server settings are not filed together', () => {
    const itemIds = (id: string): string[] => {
        const section = settingsNavSections.find((candidate) => candidate.id === id);
        return [...((section?.itemIds ?? []) as readonly string[])].sort();
    };
    const account = itemIds('account');
    assert.ok(account.includes('preferences'));
    assert.ok(!account.includes('server'));
    // The four pages that answer "what can an Agent reach" stay together.
    assert.deepEqual(itemIds('agents'), ['browser', 'connections', 'models', 'skills']);
});

test('settings navigation keeps operational usage out of configuration', () => {
    const ids: string[] = settingsNavItems.map((item) => item.id);
    assert.ok(!ids.includes('stats'));
});
